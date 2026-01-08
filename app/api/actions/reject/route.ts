import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { actionId, action, conversationId, messageId, note, reasonContext } =
      await request.json();

    // Validate that either actionId or action object is provided
    if (!actionId && !action) {
      return NextResponse.json(
        { error: "Either actionId or action object is required" },
        { status: 400 }
      );
    }

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "ACTION_REJECT",
        entityType: "Action",
        detailsJson: JSON.stringify({
          actionId: actionId || action?.id,
          action,
          conversationId,
          messageId,
          note,
          reasonContext,
          timestamp: new Date().toISOString(),
          rejectedBy: user.email,
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Action reject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
