import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content,
      },
    });

    // Check if this is a Teach Mode message
    const teachMatch = content.match(/^(LEER:|TEACH:|SAVE TO KNOWLEDGE:)/i);
    const askMatch = content.match(/^ASK:\s*/i);
    let assistantResponse = "";

    if (teachMatch) {
      // Submit to knowledge API
      try {
        const submitRes = await fetch(
          `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/knowledge/submit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: `session=${request.cookies.get("session")?.value}`,
            },
            body: JSON.stringify({ content, conversationId }),
          }
        );

        if (submitRes.ok) {
          const result = await submitRes.json();
          assistantResponse = result.message;
        } else {
          const error = await submitRes.json();
          assistantResponse = ` Failed to process teach message: ${error.error}`;
        }
      } catch (error) {
        console.error("Knowledge submission error:", error);
        assistantResponse = "Failed to process teach message.";
      }
    } else if (askMatch) {
      // Use reasoning endpoint
      const question = content.substring(askMatch[0].length).trim();
      try {
        const reasonRes = await fetch(
          `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/reason`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: `session=${request.cookies.get("session")?.value}`,
            },
            body: JSON.stringify({ question, clientId: null }),
          }
        );

        if (reasonRes.ok) {
          const result = await reasonRes.json();
          assistantResponse = result.answer;
        } else {
          assistantResponse = "Failed to process question.";
        }
      } catch (error) {
        console.error("Reasoning error:", error);
        assistantResponse = "Failed to process question.";
      }
    } else {
      // For now, just acknowledge
      assistantResponse = "I am ready to help. In Phase 0, I can learn from your teachings using LEER:, TEACH:, or SAVE TO KNOWLEDGE: prefix.";
    }

    // Save assistant response
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantResponse,
      },
    });

    // Log message send action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "MESSAGE_SEND",
        entityType: "Message",
        entityId: userMessage.id,
        detailsJson: JSON.stringify({
          conversationId,
          messageLength: content.length,
          isTeachMode: !!teachMatch,
        }),
      },
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
