// app/api/allocations/export/route.ts
// Export allocated transactions to CSV/JSON

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import prisma from "@/lib/db";
import { ALLOCATION_CATEGORIES } from "@/lib/bank-allocations";

// GET - Export transactions
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv"; // csv | json
    const status = searchParams.get("status"); // all | processed | pending | review
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const category = searchParams.get("category");
    const includeUnconfirmed = searchParams.get("includeUnconfirmed") === "true";

    // Build query
    const where: Record<string, unknown> = {};

    if (status === "processed") {
      where.processed = true;
      where.confirmedCategory = { not: null };
    } else if (status === "pending") {
      where.processed = false;
      where.confirmedCategory = null;
    } else if (status === "review") {
      where.processed = false;
      where.suggestedCategory = { not: null };
      where.confirmedCategory = null;
    }

    if (fromDate) {
      where.date = { ...(where.date as object || {}), gte: new Date(fromDate) };
    }
    if (toDate) {
      where.date = { ...(where.date as object || {}), lte: new Date(toDate) };
    }

    if (category) {
      if (includeUnconfirmed) {
        where.OR = [
          { confirmedCategory: category },
          { suggestedCategory: category, confirmedCategory: null },
        ];
      } else {
        where.confirmedCategory = category;
      }
    }

    const transactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: 10000, // Limit to 10k records
    });

    // Build category lookup
    const categoryMap = Object.fromEntries(
      ALLOCATION_CATEGORIES.map((c) => [c.code, c.label])
    );

    if (format === "json") {
      const jsonData = transactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString().split("T")[0],
        description: tx.description,
        rawDescription: tx.rawDescription,
        amount: tx.isDebit ? -tx.amount : tx.amount,
        isDebit: tx.isDebit,
        categoryCode: tx.confirmedCategory || tx.suggestedCategory,
        categoryLabel: categoryMap[tx.confirmedCategory || tx.suggestedCategory || ""] || "",
        confidence: tx.suggestedConfidence,
        status: tx.confirmedCategory ? "confirmed" : tx.suggestedCategory ? "suggested" : "unallocated",
        processed: tx.processed,
        createdAt: tx.createdAt.toISOString(),
      }));

      return NextResponse.json({
        exported: transactions.length,
        exportedAt: new Date().toISOString(),
        transactions: jsonData,
      });
    }

    // CSV format
    const headers = [
      "Date",
      "Description",
      "Amount",
      "Debit/Credit",
      "Category Code",
      "Category",
      "Confidence",
      "Status",
      "Raw Description",
    ];

    const rows = transactions.map((tx) => [
      tx.date.toISOString().split("T")[0],
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.isDebit ? -tx.amount : tx.amount,
      tx.isDebit ? "Debit" : "Credit",
      tx.confirmedCategory || tx.suggestedCategory || "",
      categoryMap[tx.confirmedCategory || tx.suggestedCategory || ""] || "",
      tx.suggestedConfidence?.toFixed(2) || "",
      tx.confirmedCategory ? "Confirmed" : tx.suggestedCategory ? "Suggested" : "Unallocated",
      `"${tx.rawDescription.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    // Return as downloadable file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="allocations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

// POST - Export allocation rules
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const { type = "rules" } = body; // rules | summary | all

    if (type === "rules") {
      const rules = await prisma.allocationRule.findMany({
        orderBy: [{ category: "asc" }, { learnedFromCount: "desc" }],
      });

      return NextResponse.json({
        exported: rules.length,
        rules: rules.map((r) => ({
          pattern: r.pattern,
          normalizedPattern: r.normalizedPattern,
          category: r.category,
          confidence: r.confidence,
          learnedFromCount: r.learnedFromCount,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }

    if (type === "summary") {
      // Get allocation summary by category
      const byCategory = await prisma.bankTransaction.groupBy({
        by: ["confirmedCategory"],
        where: { confirmedCategory: { not: null } },
        _count: { id: true },
        _sum: { amount: true },
      });

      const categoryMap = Object.fromEntries(
        ALLOCATION_CATEGORIES.map((c) => [c.code, c.label])
      );

      return NextResponse.json({
        summary: byCategory.map((item) => ({
          categoryCode: item.confirmedCategory,
          categoryLabel: categoryMap[item.confirmedCategory || ""] || "Unknown",
          transactionCount: item._count.id,
          totalAmount: item._sum.amount,
        })),
        totalTransactions: byCategory.reduce((sum, item) => sum + item._count.id, 0),
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
