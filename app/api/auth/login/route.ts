import { NextRequest, NextResponse } from "next/server";
import { isEmailAllowed, getOrCreateUser, createSession } from "@/lib/auth";
import { validateEmail } from "@/lib/validation";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isEmailAllowed(normalizedEmail)) {
      return NextResponse.json(
        { error: "Access denied. Your email is not on the allowlist." },
        { status: 403 }
      );
    }

    // Get or create user
    const user = await getOrCreateUser(normalizedEmail);

    // Create session
    const token = await createSession(user.id);

    // Log login action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "LOGIN",
        entityType: "None",
      },
    });

    // Set session cookie
    const response = NextResponse.json({ success: true, user });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
