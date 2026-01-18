import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { suggestCategory, ALLOCATION_CATEGORIES } from "@/lib/bank-allocations";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { description, descriptions } = await request.json();

    // Single description
    if (description) {
      const suggestion = await suggestCategory(description);
      return NextResponse.json({
        description,
        ...suggestion,
        categories: ALLOCATION_CATEGORIES,
      });
    }

    // Batch descriptions
    if (descriptions && Array.isArray(descriptions)) {
      const results = await Promise.all(
        descriptions.map(async (desc: string) => ({
          description: desc,
          suggestion: await suggestCategory(desc),
        }))
      );
      return NextResponse.json({
        results,
        categories: ALLOCATION_CATEGORIES,
      });
    }

    return NextResponse.json(
      { error: "Provide 'description' or 'descriptions' array" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Allocation suggest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
