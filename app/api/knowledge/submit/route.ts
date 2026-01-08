import { NextRequest, NextResponse } from "next/server";
import { parseTeachMessage, generateSlug, generateCitationId } from "@/lib/kb";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request); if (!user) return unauthorized(); const userId = user.id;

    // Rate limiting: max 30 submissions per hour
    const rateLimitKey = getRateLimitKey(userId, "kb-submit");
    if (!checkRateLimit(rateLimitKey, 30)) {
      return NextResponse.json(
        { error: "Rate limited: maximum 30 submissions per hour" },
        { status: 429 }
      );
    }

    const { content, conversationId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Parse the teach message
    const parsed = parseTeachMessage(content);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error || "Invalid teach format" },
        { status: 400 }
      );
    }

    const teachData = parsed.data!;

    // Generate slug and citation ID
    const slug = generateSlug(teachData.title);
    const citationId = generateCitationId(teachData.layer, slug, 1);

    // Check if this citation_id already exists
    const existing = await prisma.knowledgeItem.findUnique({
      where: { citationId },
    });

    if (existing) {
      // Create new version
      const latestVersion = await prisma.knowledgeItem.findFirst({
        where: { slug },
        orderBy: { kbVersion: "desc" },
      });

      const newVersion = (latestVersion?.kbVersion || 1) + 1;
      const newCitationId = generateCitationId(teachData.layer, slug, newVersion);

      const knowledgeItem = await prisma.knowledgeItem.create({
        data: {
          layer: teachData.layer,
          scopeType: teachData.scopeType,
          scopeClientId: teachData.scopeClientId,
          title: teachData.title,
          slug,
          contentText: teachData.contentText,
          language: teachData.language,
          tags: JSON.stringify(teachData.tags),
          primaryDomain: teachData.primaryDomain,
          secondaryDomains: JSON.stringify(teachData.secondaryDomains),
          status: "PENDING",
          kbVersion: newVersion,
          citationId: newCitationId,
          submittedByUserId: userId,
        },
      });

      // Log KB submission
      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "KB_SUBMIT",
          entityType: "KnowledgeItem",
          entityId: knowledgeItem.id,
          detailsJson: JSON.stringify({
            conversationId,
            layer: teachData.layer,
            citationId: newCitationId,
            primaryDomain: teachData.primaryDomain,
            secondaryDomains: teachData.secondaryDomains,
            isNewVersion: true,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        knowledgeItem,
        message: `Saved as PENDING knowledge for admin approval. Ref: [${newCitationId}]`,
      });
    } else {
      // Create new knowledge item
      const knowledgeItem = await prisma.knowledgeItem.create({
        data: {
          layer: teachData.layer,
          scopeType: teachData.scopeType,
          scopeClientId: teachData.scopeClientId,
          title: teachData.title,
          slug,
          contentText: teachData.contentText,
          language: teachData.language,
          tags: JSON.stringify(teachData.tags),
          primaryDomain: teachData.primaryDomain,
          secondaryDomains: JSON.stringify(teachData.secondaryDomains),
          status: "PENDING",
          kbVersion: 1,
          citationId,
          submittedByUserId: userId,
        },
      });

      // Log KB submission
      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "KB_SUBMIT",
          entityType: "KnowledgeItem",
          entityId: knowledgeItem.id,
          detailsJson: JSON.stringify({
            conversationId,
            layer: teachData.layer,
            citationId,
            primaryDomain: teachData.primaryDomain,
            secondaryDomains: teachData.secondaryDomains,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        knowledgeItem,
        message: `Saved as PENDING knowledge for admin approval. Ref: [${citationId}]`,
      });
    }
  } catch (error) {
    console.error("KB submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


