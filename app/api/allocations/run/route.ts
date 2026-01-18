// app/api/allocations/run/route.ts
// Trigger allocation job manually or from external system

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import prisma from "@/lib/db";
import {
  runAllocationJob,
  isSeanAuthorized,
  getSeanAgent,
} from "@/lib/allocation-engine";

// POST - Run allocation job
export async function POST(request: NextRequest) {
  try {
    // Check for API key auth (for external systems) or session auth
    const apiKey = request.headers.get("x-api-key");
    const externalSystemId = request.headers.get("x-system-id");

    let isAuthorized = false;
    let userId: string | undefined;

    if (apiKey && externalSystemId) {
      // External system authentication
      // Verify API key matches env variable
      const validApiKey = process.env.SEAN_API_KEY;
      if (validApiKey && apiKey === validApiKey) {
        isAuthorized = true;

        // Log external system access
        await prisma.auditLog.create({
          data: {
            actionType: "EXTERNAL_ALLOCATION_TRIGGER",
            entityType: "AllocationJobRun",
            detailsJson: JSON.stringify({
              systemId: externalSystemId,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      }
    } else {
      // Session-based auth
      const user = await getUserFromRequest(request);
      if (user) {
        isAuthorized = true;
        userId = user.id;
      }
    }

    if (!isAuthorized) {
      return unauthorized();
    }

    // Check if Sean is authorized to allocate
    const agent = await getSeanAgent();
    if (agent.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "Sean is not active",
          agentStatus: agent.status,
          message: "Activate Sean first to run allocations",
        },
        { status: 400 }
      );
    }

    if (!(await isSeanAuthorized("ALLOCATE"))) {
      return NextResponse.json(
        {
          error: "Sean is not authorized to allocate",
          message: "Enable ALLOCATE permission in agent settings",
        },
        { status: 403 }
      );
    }

    // Parse options from body
    const body = await request.json().catch(() => ({}));
    const {
      limit = 100,
      autoConfirmAbove = agent.autoAllocateMinConfidence,
      useLLMFallback = agent.llmFallbackEnabled,
    } = body;

    // Run the allocation job
    const result = await runAllocationJob({
      userId,
      limit,
      autoConfirmAbove,
      useLLMFallback,
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} transactions. Auto-allocated: ${result.autoAllocated}, LLM-allocated: ${result.llmAllocated}, Needs review: ${result.needsReview}`,
    });
  } catch (error) {
    console.error("Run allocation job error:", error);
    return NextResponse.json(
      {
        error: "Allocation job failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET - Check if allocation should run (for cron/scheduler)
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");

    // Allow check without auth, but limit info
    const agent = await getSeanAgent();

    const response: Record<string, unknown> = {
      shouldRun:
        agent.status === "ACTIVE" &&
        agent.autoAllocateEnabled &&
        (!agent.autoAllocateNextRun || new Date() >= agent.autoAllocateNextRun),
      agentStatus: agent.status,
      autoAllocateEnabled: agent.autoAllocateEnabled,
      nextRun: agent.autoAllocateNextRun,
    };

    // Add more details if authenticated
    if (apiKey === process.env.SEAN_API_KEY) {
      const pendingCount = await prisma.bankTransaction.count({
        where: { processed: false, confirmedCategory: null },
      });

      response.pendingTransactions = pendingCount;
      response.lastRun = agent.autoAllocateLastRun;
      response.interval = agent.autoAllocateInterval;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Check allocation status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
