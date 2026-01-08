import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request); if (!user) return unauthorized(); const userId = user.id;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const clientId = searchParams.get("clientId");

    if (!query) {
      return NextResponse.json([]);
    }

    const where: any = {
      status: "APPROVED", // Only search approved items
    };

    if (clientId) {
      where.OR = [
        { scopeType: "GLOBAL" },
        { AND: [{ scopeType: "CLIENT" }, { scopeClientId: clientId }] },
      ];
    }

    const items = await prisma.knowledgeItem.findMany({
      where,
    });

    // Simple keyword search
    const keywords = query.toLowerCase().split(/\s+/);
    const results = items
      .map((item) => {
        let score = 0;
        const content = item.contentText.toLowerCase();
        const title = item.title.toLowerCase();

        keywords.forEach((keyword) => {
          if (title.includes(keyword)) score += 10;
          if (content.includes(keyword)) score += 1;
        });

        return { ...item, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 matches

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search knowledge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


