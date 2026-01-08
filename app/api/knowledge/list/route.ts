import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request); if (!user) return unauthorized(); const userId = user.id;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const layer = searchParams.get("layer");
    const primaryDomain = searchParams.get("primaryDomain");
    const secondaryDomain = searchParams.get("secondaryDomain");

    const where: any = {};
    if (status && status !== "all") where.status = status.toUpperCase();
    if (layer && layer !== "all") where.layer = layer;
    if (primaryDomain && primaryDomain !== "all") where.primaryDomain = primaryDomain;
    
    // For secondary domains, we need to check if the domain is in the JSON array
    // This is a simple contains check
    if (secondaryDomain) {
      where.secondaryDomains = {
        contains: secondaryDomain,
      };
    }

    // Filter CLIENT-scoped items: only show if it's for this user's client
    // For now, only return GLOBAL scope or CLIENT scope where user is the owner
    where.OR = [
      { scopeType: "GLOBAL" },
      { scopeType: "CLIENT", scopeClientId: userId }, // Only show if client ID matches user ID
    ];

    const items = await prisma.knowledgeItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        submittedBy: { select: { email: true } },
        approvedBy: { select: { email: true } },
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("List knowledge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
