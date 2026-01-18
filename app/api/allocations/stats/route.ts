import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { getAllocationStats, exportAllocationRules } from "@/lib/bank-allocations";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const includeRules = searchParams.get("includeRules") === "true";

    // Get allocation stats
    const stats = await getAllocationStats();

    // Get user's transaction stats
    const [totalTransactions, processedTransactions, unprocessedTransactions] = await Promise.all([
      prisma.bankTransaction.count({ where: { userId: user.id } }),
      prisma.bankTransaction.count({ where: { userId: user.id, processed: true } }),
      prisma.bankTransaction.count({ where: { userId: user.id, processed: false } }),
    ]);

    // Category breakdown for user's transactions
    const categoryBreakdown = await prisma.bankTransaction.groupBy({
      by: ["confirmedCategory"],
      where: { userId: user.id, processed: true },
      _count: { id: true },
      _sum: { amount: true },
    });

    const response: Record<string, unknown> = {
      rules: stats,
      transactions: {
        total: totalTransactions,
        processed: processedTransactions,
        unprocessed: unprocessedTransactions,
        byCategory: categoryBreakdown.map(c => ({
          category: c.confirmedCategory,
          count: c._count.id,
          totalAmount: c._sum.amount,
        })),
      },
    };

    // Optionally include full rule export
    if (includeRules) {
      response.allRules = await exportAllocationRules();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get allocation stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
