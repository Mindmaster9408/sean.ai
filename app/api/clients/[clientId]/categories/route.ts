// app/api/clients/[clientId]/categories/route.ts
// Client-specific custom categories

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import prisma from "@/lib/db";

// GET - List custom categories for client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { clientId } = await params;

    const categories = await prisma.clientCategory.findMany({
      where: { clientId },
      orderBy: { label: "asc" },
    });

    return NextResponse.json(
      categories.map((c) => ({
        ...c,
        keywords: JSON.parse(c.keywords),
      }))
    );
  } catch (error) {
    console.error("List categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create custom category for client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { clientId } = await params;
    const body = await request.json();
    const { code, label, keywords, parentCode } = body;

    if (!code || !label) {
      return NextResponse.json(
        { error: "Code and label are required" },
        { status: 400 }
      );
    }

    // Check if category code exists for this client
    const existing = await prisma.clientCategory.findUnique({
      where: { clientId_code: { clientId, code: code.toUpperCase() } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Category code already exists for this client" },
        { status: 400 }
      );
    }

    const category = await prisma.clientCategory.create({
      data: {
        clientId,
        code: code.toUpperCase(),
        label,
        keywords: JSON.stringify(keywords || []),
        parentCode,
      },
    });

    return NextResponse.json({
      ...category,
      keywords: JSON.parse(category.keywords),
    });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update custom category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { clientId } = await params;
    const body = await request.json();
    const { id, label, keywords, parentCode, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Category ID required" }, { status: 400 });
    }

    const category = await prisma.clientCategory.update({
      where: { id },
      data: {
        ...(label && { label }),
        ...(keywords && { keywords: JSON.stringify(keywords) }),
        ...(parentCode !== undefined && { parentCode }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      ...category,
      keywords: JSON.parse(category.keywords),
    });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete custom category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Category ID required" }, { status: 400 });
    }

    await prisma.clientCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
