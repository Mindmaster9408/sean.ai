// app/api/allocations/import/route.ts
// External Transaction Import API
// Receives transactions from accounting software and queues for allocation

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import prisma from "@/lib/db";

interface ImportTransaction {
  date: string; // ISO date or YYYY-MM-DD
  description: string;
  amount: number;
  isDebit?: boolean;
  reference?: string;
  bankAccount?: string;
  clientId?: string; // For multi-tenant support
}

// POST - Import transactions from external system
export async function POST(request: NextRequest) {
  try {
    // Check for API key auth (external systems) or session auth
    const apiKey = request.headers.get("x-api-key");
    const systemId = request.headers.get("x-system-id");

    let userId: string | null = null;
    let isExternalSystem = false;

    if (apiKey && systemId) {
      // External system authentication
      const validApiKey = process.env.SEAN_API_KEY;
      if (!validApiKey || apiKey !== validApiKey) {
        return NextResponse.json(
          { error: "Invalid API key" },
          { status: 401 }
        );
      }
      isExternalSystem = true;

      // Get or create a system user for tracking
      let systemUser = await prisma.user.findFirst({
        where: { email: `system-${systemId}@sean.local` },
      });

      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: { email: `system-${systemId}@sean.local` },
        });
      }
      userId = systemUser.id;
    } else {
      // Session-based auth
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized();
      userId = user.id;
    }

    const body = await request.json();

    // Support both single transaction and array
    const transactions: ImportTransaction[] = Array.isArray(body.transactions)
      ? body.transactions
      : body.transaction
      ? [body.transaction]
      : Array.isArray(body)
      ? body
      : [body];

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided" },
        { status: 400 }
      );
    }

    // Validate and import transactions
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      transactionIds: [] as string[],
    };

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // Validate required fields
      if (!tx.date || !tx.description || tx.amount === undefined) {
        results.errors.push(`Transaction ${i + 1}: Missing required fields (date, description, amount)`);
        results.skipped++;
        continue;
      }

      // Parse date
      let parsedDate: Date;
      try {
        parsedDate = new Date(tx.date);
        if (isNaN(parsedDate.getTime())) {
          throw new Error("Invalid date");
        }
      } catch {
        results.errors.push(`Transaction ${i + 1}: Invalid date format`);
        results.skipped++;
        continue;
      }

      // Check for duplicates (same date, description, amount)
      const existing = await prisma.bankTransaction.findFirst({
        where: {
          userId: userId!,
          date: parsedDate,
          rawDescription: tx.description,
          amount: tx.amount,
        },
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      // Determine if debit or credit
      const isDebit = tx.isDebit !== undefined ? tx.isDebit : tx.amount < 0;
      const absAmount = Math.abs(tx.amount);

      // Create transaction
      try {
        const created = await prisma.bankTransaction.create({
          data: {
            userId: userId!,
            date: parsedDate,
            description: tx.description.substring(0, 500),
            rawDescription: tx.description,
            amount: absAmount,
            isDebit,
            processed: false,
            // Store client ID in metadata if provided (for multi-tenant)
          },
        });

        results.imported++;
        results.transactionIds.push(created.id);
      } catch (error) {
        results.errors.push(`Transaction ${i + 1}: Database error - ${error instanceof Error ? error.message : "Unknown"}`);
        results.skipped++;
      }
    }

    // Log the import
    await prisma.auditLog.create({
      data: {
        userId,
        actionType: "TRANSACTION_IMPORT",
        entityType: "BankTransaction",
        detailsJson: JSON.stringify({
          source: isExternalSystem ? systemId : "web",
          totalReceived: transactions.length,
          imported: results.imported,
          skipped: results.skipped,
          errors: results.errors.length,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} transactions, skipped ${results.skipped}`,
      ...results,
    });
  } catch (error) {
    console.error("Transaction import error:", error);
    return NextResponse.json(
      { error: "Import failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET - Get import status/history
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    // Get recent imports
    const recentImports = await prisma.auditLog.findMany({
      where: {
        actionType: "TRANSACTION_IMPORT",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get pending transaction count
    const pendingCount = await prisma.bankTransaction.count({
      where: {
        processed: false,
        confirmedCategory: null,
      },
    });

    return NextResponse.json({
      pendingTransactions: pendingCount,
      recentImports: recentImports.map((log) => ({
        id: log.id,
        createdAt: log.createdAt,
        details: log.detailsJson ? JSON.parse(log.detailsJson) : null,
      })),
    });
  } catch (error) {
    console.error("Get import status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
