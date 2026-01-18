// app/api/cron/allocate/route.ts
// Scheduled cron endpoint for auto-allocation
// Can be called by Vercel Cron, external scheduler, or Windows Task Scheduler

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  runAllocationJob,
  getSeanAgent,
  shouldRunAutoAllocation,
} from "@/lib/allocation-engine";

// Verify cron secret for security
function verifyCronAuth(request: NextRequest): boolean {
  // Check for cron secret (Vercel style)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check for API key (custom scheduler)
  const apiKey = request.headers.get("x-api-key");
  const seanApiKey = process.env.SEAN_API_KEY;

  if (seanApiKey && apiKey === seanApiKey) {
    return true;
  }

  // Allow localhost for development
  const host = request.headers.get("host") || "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return true;
  }

  return false;
}

// GET - Check if cron should run (for external schedulers)
export async function GET(request: NextRequest) {
  try {
    const shouldRun = await shouldRunAutoAllocation();
    const agent = await getSeanAgent();

    const pendingCount = await prisma.bankTransaction.count({
      where: { processed: false, confirmedCategory: null },
    });

    return NextResponse.json({
      shouldRun,
      pendingTransactions: pendingCount,
      agent: {
        status: agent.status,
        autoAllocateEnabled: agent.autoAllocateEnabled,
        lastRun: agent.autoAllocateLastRun,
        nextRun: agent.autoAllocateNextRun,
        interval: agent.autoAllocateInterval,
      },
    });
  } catch (error) {
    console.error("Cron check error:", error);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}

// POST - Execute scheduled allocation
export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid cron authentication" },
      { status: 401 }
    );
  }

  try {
    // Check if should run
    const shouldRun = await shouldRunAutoAllocation();
    const agent = await getSeanAgent();

    if (!shouldRun) {
      return NextResponse.json({
        executed: false,
        reason: agent.status !== "ACTIVE"
          ? "Agent is not active"
          : !agent.autoAllocateEnabled
          ? "Auto-allocation is disabled"
          : "Not yet time for next run",
        nextRun: agent.autoAllocateNextRun,
      });
    }

    // Check if there are pending transactions
    const pendingCount = await prisma.bankTransaction.count({
      where: { processed: false, confirmedCategory: null },
    });

    if (pendingCount === 0) {
      // Update next run time even if no transactions
      await prisma.seanAgent.update({
        where: { id: agent.id },
        data: {
          autoAllocateLastRun: new Date(),
          autoAllocateNextRun: new Date(
            Date.now() + agent.autoAllocateInterval * 60 * 1000
          ),
        },
      });

      return NextResponse.json({
        executed: true,
        reason: "No pending transactions",
        processed: 0,
      });
    }

    // Run the allocation job
    const result = await runAllocationJob({
      limit: 200, // Process up to 200 transactions per cron run
      autoConfirmAbove: agent.autoAllocateMinConfidence,
      useLLMFallback: agent.llmFallbackEnabled,
    });

    // Log cron execution
    await prisma.auditLog.create({
      data: {
        actionType: "CRON_ALLOCATION",
        entityType: "AllocationJobRun",
        entityId: result.jobId,
        detailsJson: JSON.stringify({
          triggered: "cron",
          ...result,
        }),
      },
    });

    return NextResponse.json({
      executed: true,
      jobId: result.jobId,
      processed: result.processed,
      autoAllocated: result.autoAllocated,
      llmAllocated: result.llmAllocated,
      needsReview: result.needsReview,
      errors: result.errors,
      nextRun: agent.autoAllocateNextRun,
    });
  } catch (error) {
    console.error("Cron allocation error:", error);

    // Log failure
    await prisma.auditLog.create({
      data: {
        actionType: "CRON_ALLOCATION_FAILED",
        entityType: "SeanAgent",
        detailsJson: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      },
    });

    return NextResponse.json(
      {
        executed: false,
        error: "Allocation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
