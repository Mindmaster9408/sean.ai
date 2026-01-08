import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { generateCitationId, generateSlug } from "@/lib/kb";

// Load pdf-parse at runtime to avoid build-time resolution issues
async function getPdfParser() {
  try {
    const pdfParse = await import("pdf-parse");
    // pdf-parse exports the function as default
    // @ts-expect-error
    if (typeof pdfParse.default === "function") {
      // @ts-expect-error
      return pdfParse.default;
    }
    // Last resort - return the whole module
    return pdfParse;
  } catch (error) {
    console.error("Failed to load pdf-parse:", error);
    throw new Error(`Failed to initialize PDF parser`);
  }
}

// Helper: chunk text with overlap
function chunkText(
  text: string,
  chunkSize: number = 1200,
  overlap: number = 100
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end).trim();

    if (chunk.length > 50) {
      // Only add non-trivial chunks
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start <= 0) break;
  }

  return chunks;
}

// Helper: infer domain from text (simple heuristic)
function inferDomainFromText(text: string): string {
  const t = text.toLowerCase();

  if (t.includes("vat") || t.includes("value added")) return "VAT";
  if (t.includes("income tax") || t.includes("salary") || t.includes("wage"))
    return "INCOME_TAX";
  if (
    t.includes("company tax") ||
    t.includes("corporate tax") ||
    t.includes("profit")
  )
    return "COMPANY_TAX";
  if (t.includes("payroll") || t.includes("paye")) return "PAYROLL";
  if (
    t.includes("capital gains") ||
    t.includes("cgt") ||
    t.includes("property sale")
  )
    return "CAPITAL_GAINS_TAX";
  if (t.includes("withholding") || t.includes("dividend")) return "WITHHOLDING_TAX";

  return "OTHER";
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();
    const userId = user.id;

    // Parse multipart form data
    let formData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error("FormData parse error:", error);
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate PDF mime type
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Validate file size (max 15MB)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 15MB limit" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    let buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (error) {
      console.error("File buffer error:", error);
      return NextResponse.json(
        { error: "Failed to read file" },
        { status: 400 }
      );
    }

    // Get PDF parser
    let pdfParse;
    try {
      pdfParse = await getPdfParser();
    } catch (error) {
      console.error("Failed to load PDF parser:", error);
      return NextResponse.json(
        { error: "PDF parser initialization failed" },
        { status: 500 }
      );
    }

    // Extract text from PDF using pdf-parse
    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (error) {
      console.error("PDF parsing error:", error);
      return NextResponse.json(
        { error: `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}` },
        { status: 400 }
      );
    }

    // Check if text was extracted
    if (!pdfData.text || pdfData.text.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "No text found in PDF. It may be a scanned image. OCR is not enabled yet.",
        },
        { status: 400 }
      );
    }

    const extractedText = pdfData.text.trim();
    const fileName = file.name.replace(".pdf", "").replace(/[^a-z0-9]/gi, "_");

    // Chunk the text
    const chunks = chunkText(extractedText, 1200, 100);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "PDF text could not be chunked into meaningful pieces" },
        { status: 400 }
      );
    }

    // Infer domain from full text
    const inferredDomain = inferDomainFromText(extractedText);

    // Create knowledge items for each chunk
    const createdItems = [];
    const domainCounts: Record<string, number> = {};

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const chunkNum = i + 1;

      // Infer domain for this specific chunk
      const chunkDomain = inferDomainFromText(chunkContent);
      domainCounts[chunkDomain] = (domainCounts[chunkDomain] || 0) + 1;

      // Generate title
      const title = `${fileName} - Chunk ${chunkNum} of ${chunks.length}`;
      const slug = generateSlug(`${fileName}-chunk-${chunkNum}`);
      const citationId = generateCitationId("FIRM", slug, 1);

      try {
        const item = await prisma.knowledgeItem.create({
          data: {
            layer: "FIRM",
            scopeType: "GLOBAL",
            title,
            slug,
            contentText: chunkContent,
            language: "EN",
            tags: JSON.stringify(["pdf-ingest", fileName]),
            primaryDomain: chunkDomain,
            secondaryDomains: JSON.stringify([]),
            status: "PENDING",
            kbVersion: 1,
            citationId,
            submittedByUserId: userId,
            // PDF-specific fields
            sourceType: "pdf" as const,
            sourceUrl: fileName,
            sourceSection: `chunk:${chunkNum}`,
          } as Parameters<typeof prisma.knowledgeItem.create>[0]["data"],
        });

        createdItems.push(item);
      } catch (itemError) {
        console.error(`Failed to create item for chunk ${chunkNum}:`, itemError);
        // Continue with next chunk
        continue;
      }
    }

    if (createdItems.length === 0) {
      return NextResponse.json(
        { error: "Failed to create any knowledge items from PDF" },
        { status: 500 }
      );
    }

    // Write audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "KB_INGEST_PDF",
          entityType: "KnowledgeItem",
          detailsJson: JSON.stringify({
            fileName: file.name,
            originalFileName: fileName,
            totalChunks: chunks.length,
            createdItems: createdItems.length,
            inferredDomain,
            domainCounts,
            itemIds: createdItems.map((item) => item.id),
            textLength: extractedText.length,
            pdfPages: pdfData.numpages || "unknown",
          }),
        },
      });
    } catch (auditError) {
      console.error("Audit log error:", auditError);
      // Don't fail the response if audit log fails
    }

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      totalChunks: chunks.length,
      createdItems: createdItems.length,
      inferredDomain,
      domainCounts,
      message: `Successfully created ${createdItems.length} knowledge items from PDF. All items are PENDING approval.`,
      items: createdItems.map((item) => ({
        id: item.id,
        citationId: item.citationId,
        title: item.title,
        domain: item.primaryDomain,
        sourceSection: (item as any).sourceSection || "unknown",
      })),
    });
  } catch (error) {
    console.error("PDF ingest error:", error);
    return NextResponse.json(
      { 
        error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
