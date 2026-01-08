import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { title } = await request.json();

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || "New Conversation",
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("id");

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID required" }, { status: 400 });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Delete all messages first (cascade)
    await prisma.message.deleteMany({
      where: { conversationId },
    });

    // Delete conversation
    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    // Log delete action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "CONVERSATION_DELETE",
        entityType: "Conversation",
        entityId: conversationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { conversationId, title } = await request.json();

    if (!conversationId || !title) {
      return NextResponse.json({ error: "Conversation ID and title required" }, { status: 400 });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Update conversation title
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    // Log rename action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "CONVERSATION_RENAME",
        entityType: "Conversation",
        entityId: conversationId,
        detailsJson: JSON.stringify({ oldTitle: conversation.title, newTitle: title }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Rename conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
