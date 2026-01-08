import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request); if (!user) return unauthorized(); const userId = user.id;

    const { knowledgeItemId } = await request.json();

    if (!knowledgeItemId) {
      return NextResponse.json(
        { error: "knowledgeItemId is required" },
        { status: 400 }
      );
    }

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: knowledgeItemId },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Knowledge item not found" },
        { status: 404 }
      );
    }

    // Update knowledge item
    const updated = await prisma.knowledgeItem.update({
      where: { id: knowledgeItemId },
      data: {
        status: "APPROVED",
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });

    // Log approval
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "KB_APPROVE",
        entityType: "KnowledgeItem",
        entityId: knowledgeItemId,
        detailsJson: JSON.stringify({
          citationId: item.citationId,
          layer: item.layer,
          primaryDomain: item.primaryDomain,
          secondaryDomains: JSON.parse(item.secondaryDomains),
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Approve knowledge item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


