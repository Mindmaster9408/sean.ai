// app/api/allocations/agent/route.ts
// Sean Agent Status and Control API

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import {
  getSeanAgent,
  updateAgentStatus,
  getAllocationSummary,
} from "@/lib/allocation-engine";

// GET - Get agent status and summary
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const summary = await getAllocationSummary();

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Get agent status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Update agent status and settings
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const {
      status,
      autoAllocateEnabled,
      autoAllocateInterval,
      autoAllocateMinConfidence,
      llmFallbackEnabled,
      llmFallbackProvider,
      authorizedActions,
    } = body;

    if (status && !["ACTIVE", "INACTIVE", "PAUSED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE, INACTIVE, or PAUSED" },
        { status: 400 }
      );
    }

    await updateAgentStatus(status || "INACTIVE", {
      autoAllocateEnabled,
      autoAllocateInterval,
      autoAllocateMinConfidence,
      llmFallbackEnabled,
      llmFallbackProvider,
      authorizedActions,
    });

    const agent = await getSeanAgent();

    return NextResponse.json({
      message: "Agent updated successfully",
      agent: {
        status: agent.status,
        autoAllocateEnabled: agent.autoAllocateEnabled,
        autoAllocateInterval: agent.autoAllocateInterval,
        autoAllocateMinConfidence: agent.autoAllocateMinConfidence,
        llmFallbackEnabled: agent.llmFallbackEnabled,
        autoAllocateNextRun: agent.autoAllocateNextRun,
      },
    });
  } catch (error) {
    console.error("Update agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
