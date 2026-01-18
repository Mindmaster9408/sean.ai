// app/api/clients/route.ts
// Client/Company Management API for multi-tenant support

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import prisma from "@/lib/db";

// GET - List all clients
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("stats") === "true";

    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: includeStats
          ? {
              select: {
                allocationRules: true,
                bankTransactions: true,
                customCategories: true,
              },
            }
          : undefined,
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("List clients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create new client
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const { name, code, description, defaultMinConfidence, autoAllocateEnabled } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.client.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Client code already exists" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        defaultMinConfidence: defaultMinConfidence || 0.8,
        autoAllocateEnabled: autoAllocateEnabled !== false,
      },
    });

    // Log creation
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "CLIENT_CREATE",
        entityType: "Client",
        entityId: client.id,
        detailsJson: JSON.stringify({ name, code: client.code }),
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Create client error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update client
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const { id, name, description, isActive, defaultMinConfidence, autoAllocateEnabled } = body;

    if (!id) {
      return NextResponse.json({ error: "Client ID required" }, { status: 400 });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(defaultMinConfidence !== undefined && { defaultMinConfidence }),
        ...(autoAllocateEnabled !== undefined && { autoAllocateEnabled }),
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Update client error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete client
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Client ID required" }, { status: 400 });
    }

    // Check if client has transactions
    const transactionCount = await prisma.bankTransaction.count({
      where: { clientId: id },
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete client with transactions",
          transactionCount,
          message: "Deactivate the client instead, or delete transactions first",
        },
        { status: 400 }
      );
    }

    await prisma.client.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Client deleted" });
  } catch (error) {
    console.error("Delete client error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
