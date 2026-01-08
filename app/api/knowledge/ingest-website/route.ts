import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { validateUrl, validateLayer } from "@/lib/validation";
import {
  validateWebsiteUrl,
  fetchWebsiteContent,
  extractTextFromHtml,
  chunkContent,
} from "@/lib/website-ingest";
import { generateCitationId, generateSlug } from "@/lib/kb";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();
    const userId = user.id;

    const { url, domain, layer } = await request.json();

    // Validate URL format
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400 }
      );
    }

    // Validate layer if provided
    if (layer) {
      const layerValidation = validateLayer(layer);
      if (!layerValidation.valid) {
        return NextResponse.json(
          { error: layerValidation.error },
          { status: 400 }
        );
      }
    }

    // Validate URL against allowlist
    const validation = validateWebsiteUrl(url);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 403 }
      );
    }

    // Fetch content
    const fetchResult = await fetchWebsiteContent(url);
    if (fetchResult.error) {
      return NextResponse.json(
        { error: `Failed to fetch: ${fetchResult.error}` },
        { status: 400 }
      );
    }

    // Extract text
    const extracted = extractTextFromHtml(fetchResult.html);
    if (extracted.text.length < 100) {
      return NextResponse.json(
        { error: "Extracted content too short (< 100 characters)" },
        { status: 400 }
      );
    }

    // Extract page title from first H1 or URL
    let pageTitle = url.split("/").pop() || "Untitled";
    if (extracted.headings.length > 0) {
      const h1 = extracted.headings.find((h) => h.level === 1);
      if (h1) pageTitle = h1.text;
    }

    // Chunk content
    const chunks = chunkContent(extracted.text, extracted.headings, pageTitle);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No meaningful chunks could be extracted" },
        { status: 400 }
      );
    }

    // Save chunks as PENDING knowledge items
    const createdItems = [];
    for (const chunk of chunks) {
      const slug = generateSlug(chunk.title);

      // Check if similar knowledge exists
      const existing = await prisma.knowledgeItem.findFirst({
        where: {
          slug,
          layer: layer || "FIRM",
          status: "APPROVED",
        },
      });

      if (existing) {
        // Skip if exact match exists
        continue;
      }

      const citationId = generateCitationId(layer || "FIRM", slug, 1);

      const item = await prisma.knowledgeItem.create({
        data: {
          layer: layer || "FIRM",
          scopeType: "GLOBAL",
          title: chunk.title,
          slug,
          contentText: chunk.content,
          language: "EN",
          tags: JSON.stringify(chunk.keywords),
          primaryDomain: domain || chunk.domain,
          secondaryDomains: JSON.stringify([]),
          status: "PENDING",
          kbVersion: 1,
          citationId,
          submittedByUserId: userId,
          // Website ingestion fields
          sourceType: "website",
          sourceUrl: url,
          sourceSection: chunk.sourceSection,
        } as any,
      });

      createdItems.push(item);
    }

    // Log ingest action
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "KB_INGEST_WEBSITE",
        entityType: "KnowledgeItem",
        detailsJson: JSON.stringify({
          url,
          domain: domain || "OTHER",
          layer: layer || "FIRM",
          chunksCreated: createdItems.length,
          totalChunks: chunks.length,
          itemIds: createdItems.map((item) => item.id),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Created ${createdItems.length} suggested knowledge items from ${url}`,
      items: createdItems.map((item) => ({
        id: item.id,
        citationId: item.citationId,
        title: item.title,
        domain: item.primaryDomain,
        sourceSection: (item as any).sourceSection,
      })),
    });
  } catch (error) {
    console.error("Website ingest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
