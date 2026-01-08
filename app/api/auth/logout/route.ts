import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("session")?.value;
    const userId = request.headers.get("x-user-id");

    if (token) {
      await deleteSession(token);
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          actionType: "LOGOUT",
          entityType: "None",
        },
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("session");
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


