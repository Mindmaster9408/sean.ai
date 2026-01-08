import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "./auth";

export async function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  return await validateSession(token);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
