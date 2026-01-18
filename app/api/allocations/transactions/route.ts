import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { suggestCategory, ALLOCATION_CATEGORIES } from "@/lib/bank-allocations";

// GET - List transactions with optional filters
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const processed = searchParams.get("processed");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId: user.id };

    if (processed === "true") where.processed = true;
    if (processed === "false") where.processed = false;
    if (category) where.confirmedCategory = category;

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      total,
      limit,
      offset,
      categories: ALLOCATION_CATEGORIES,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create/import transactions
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { transactions } = await request.json();

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "transactions array required" },
        { status: 400 }
      );
    }

    const created = [];
    const errors = [];

    for (const tx of transactions) {
      try {
        // Validate required fields
        if (!tx.date || !tx.description || tx.amount === undefined) {
          errors.push({ tx, error: "Missing date, description, or amount" });
          continue;
        }

        // Get suggestion for this transaction
        const suggestion = await suggestCategory(tx.description);

        const transaction = await prisma.bankTransaction.create({
          data: {
            userId: user.id,
            date: new Date(tx.date),
            description: tx.description,
            rawDescription: tx.rawDescription || tx.description,
            amount: parseFloat(tx.amount),
            isDebit: tx.isDebit !== undefined ? tx.isDebit : parseFloat(tx.amount) < 0,
            suggestedCategory: suggestion.category,
            suggestedConfidence: suggestion.confidence,
          },
        });

        created.push({
          id: transaction.id,
          description: transaction.description,
          suggestedCategory: suggestion.category,
          suggestedConfidence: suggestion.confidence,
          categoryLabel: suggestion.categoryLabel,
          matchType: suggestion.matchType,
        });
      } catch (txError) {
        errors.push({ tx, error: String(txError) });
      }
    }

    // Log the import
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "TRANSACTIONS_IMPORT",
        entityType: "BankTransaction",
        detailsJson: JSON.stringify({
          attempted: transactions.length,
          created: created.length,
          errors: errors.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length,
      transactions: created,
      errorDetails: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error) {
    console.error("Create transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a transaction
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Verify ownership
    const tx = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!tx || tx.userId !== user.id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await prisma.bankTransaction.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
