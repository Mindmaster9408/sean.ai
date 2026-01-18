import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    // Get various stats
    const [
      totalUsers,
      totalConversations,
      totalMessages,
      totalKnowledgeItems,
      approvedKnowledge,
      pendingKnowledge,
      totalAllocations,
      processedAllocations,
      totalRules,
      recentAuditLogs,
      knowledgeByDomain,
      bootstrapCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.knowledgeItem.count(),
      prisma.knowledgeItem.count({ where: { status: "APPROVED" } }),
      prisma.knowledgeItem.count({ where: { status: "PENDING" } }),
      prisma.bankTransaction.count(),
      prisma.bankTransaction.count({ where: { processed: true } }),
      prisma.allocationRule.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { email: true } } },
      }),
      prisma.knowledgeItem.groupBy({
        by: ["primaryDomain"],
        _count: { id: true },
        where: { status: "APPROVED" },
      }),
      prisma.auditLog.count({ where: { actionType: "LLM_BOOTSTRAP" } }),
    ]);

    // Get user's own stats
    const userStats = {
      conversations: await prisma.conversation.count({ where: { userId: user.id } }),
      knowledgeSubmitted: await prisma.knowledgeItem.count({ where: { submittedByUserId: user.id } }),
      transactions: await prisma.bankTransaction.count({ where: { userId: user.id } }),
    };

    return NextResponse.json({
      system: {
        users: totalUsers,
        conversations: totalConversations,
        messages: totalMessages,
        knowledge: {
          total: totalKnowledgeItems,
          approved: approvedKnowledge,
          pending: pendingKnowledge,
        },
        allocations: {
          total: totalAllocations,
          processed: processedAllocations,
          rules: totalRules,
        },
        bootstrapCalls: bootstrapCount,
      },
      user: userStats,
      knowledgeByDomain: knowledgeByDomain.map(d => ({
        domain: d.primaryDomain,
        count: d._count.id,
      })),
      recentActivity: recentAuditLogs.map(log => ({
        id: log.id,
        action: log.actionType,
        user: log.user?.email || "System",
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
