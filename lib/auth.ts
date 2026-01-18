import { v4 as uuidv4 } from "uuid";
import prisma from "./db";

// Fallback hardcoded allowlist (used if DB table doesn't exist yet)
const FALLBACK_ALLOWED_EMAILS = [
  "ruanvlog@lorenco.co.za",
  "antonjvr@lorenco.co.za",
  "mj@lorenco.co.za",
];

export async function isEmailAllowed(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // First check fallback list (always allowed)
  if (FALLBACK_ALLOWED_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  // Then check database
  try {
    const allowed = await prisma.allowedEmail.findUnique({
      where: { email: normalizedEmail },
    });
    return !!allowed;
  } catch (error) {
    // Table might not exist yet (before migration)
    console.warn("AllowedEmail table check failed, using fallback:", error);
    return false;
  }
}

export async function addAllowedEmail(
  email: string,
  role: "USER" | "ADMIN" = "USER",
  addedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { success: false, error: "Invalid email format" };
  }

  try {
    // Check if already exists
    const existing = await prisma.allowedEmail.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return { success: false, error: "Email already allowed" };
    }

    await prisma.allowedEmail.create({
      data: {
        email: normalizedEmail,
        role,
        addedBy,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to add allowed email:", error);
    return { success: false, error: "Database error" };
  }
}

export async function removeAllowedEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Don't allow removing fallback emails
  if (FALLBACK_ALLOWED_EMAILS.includes(normalizedEmail)) {
    return { success: false, error: "Cannot remove core admin emails" };
  }

  try {
    await prisma.allowedEmail.delete({
      where: { email: normalizedEmail },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Email not found or database error" };
  }
}

export async function listAllowedEmails(): Promise<Array<{
  email: string;
  role: string;
  addedBy: string | null;
  createdAt: Date;
  isCore: boolean;
}>> {
  try {
    const dbEmails = await prisma.allowedEmail.findMany({
      orderBy: { createdAt: "asc" },
    });

    const result = [];

    // Add fallback emails first (marked as core)
    for (const email of FALLBACK_ALLOWED_EMAILS) {
      const inDb = dbEmails.find(e => e.email === email);
      result.push({
        email,
        role: inDb?.role || "ADMIN",
        addedBy: null,
        createdAt: inDb?.createdAt || new Date(),
        isCore: true,
      });
    }

    // Add other DB emails
    for (const dbEmail of dbEmails) {
      if (!FALLBACK_ALLOWED_EMAILS.includes(dbEmail.email)) {
        result.push({
          email: dbEmail.email,
          role: dbEmail.role,
          addedBy: dbEmail.addedBy,
          createdAt: dbEmail.createdAt,
          isCore: false,
        });
      }
    }

    return result;
  } catch (error) {
    // Return fallback if DB not available
    return FALLBACK_ALLOWED_EMAILS.map(email => ({
      email,
      role: "ADMIN",
      addedBy: null,
      createdAt: new Date(),
      isCore: true,
    }));
  }
}

export async function createSession(userId: string) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function validateSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  // Check if session expired
  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function deleteSession(token: string) {
  await prisma.session.delete({ where: { token } }).catch(() => null);
}

export async function getOrCreateUser(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    user = await prisma.user.create({
      data: { email: normalizedEmail },
    });
  }

  return user;
}

// Check if user is admin
export async function isUserAdmin(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Fallback admins
  if (FALLBACK_ALLOWED_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  try {
    const allowed = await prisma.allowedEmail.findUnique({
      where: { email: normalizedEmail },
    });
    return allowed?.role === "ADMIN";
  } catch {
    return false;
  }
}
