import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserFromRequest, unauthorized } from "@/lib/api-auth";
import { bootstrapAnswer, inferDomainFromQuestion } from "@/lib/llm-bootstrap";
import { processCalculation } from "@/lib/calculations";

// Intent classification for natural language understanding
function classifyIntent(content: string): {
  type: "QUESTION" | "TEACH" | "ALLOCATION" | "CALCULATION" | "GENERAL";
  domain: string;
  confidence: number;
} {
  const c = content.toLowerCase().trim();

  // Calculation indicators (check first - highest priority for accounting)
  const calculationPatterns = [
    /\b(calculate|calc|vat|btw|tax on|paye|income tax)\b/i,
    /\bR\s*\d+/i, // R followed by numbers
    /\d+\s*%/i, // percentage
    /how much (tax|vat|is)/i,
    /what('s| is) the (vat|tax|paye)/i,
  ];
  const isCalculation = calculationPatterns.some(p => p.test(c));

  // Teaching indicators
  const teachPatterns = [
    /^(remember|note|fyi|learn|know that)/i,
    /the rule is/i,
    /you should know/i,
    /for future reference/i,
    /always remember/i,
  ];
  const isTeach = teachPatterns.some(p => p.test(c));

  // Question indicators
  const questionPatterns = [
    /^(what|how|why|when|where|who|which|can|does|is|are|should|would|could)\b/i,
    /\?$/,
    /^(tell me|explain|describe|show me)/i,
  ];
  const isQuestion = questionPatterns.some(p => p.test(c));

  // Allocation indicators
  const allocationPatterns = [
    /\b(allocate|categorize|classify|what category|which account)\b/i,
    /\b(bank statement|transaction|debit|credit)\b/i,
    /\b(atm|eft|pos|card payment)\b/i,
  ];
  const isAllocation = allocationPatterns.some(p => p.test(c));

  // Domain detection
  const domain = inferDomainFromQuestion(content);

  if (isCalculation) {
    return { type: "CALCULATION", domain: domain || "VAT", confidence: 0.95 };
  }
  if (isTeach) {
    return { type: "TEACH", domain, confidence: 0.8 };
  }
  if (isAllocation) {
    return { type: "ALLOCATION", domain: "ACCOUNTING_GENERAL", confidence: 0.85 };
  }
  if (isQuestion) {
    return { type: "QUESTION", domain, confidence: 0.9 };
  }
  return { type: "GENERAL", domain, confidence: 0.5 };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content,
      },
    });

    // Check for explicit prefixes first
    const teachMatch = content.match(/^(LEER:|TEACH:|SAVE TO KNOWLEDGE:)/i);
    const askMatch = content.match(/^ASK:\s*/i);
    let assistantResponse = "";
    let responseMetadata: Record<string, unknown> = {};

    if (teachMatch) {
      // Explicit teach mode - submit to knowledge API
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

        const submitRes = await fetch(`${baseUrl}/api/knowledge/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session=${request.cookies.get("session")?.value}`,
          },
          body: JSON.stringify({ content, conversationId }),
        });

        if (submitRes.ok) {
          const result = await submitRes.json();
          assistantResponse = result.message;
          responseMetadata = { mode: "teach", citationId: result.citationId };
        } else {
          const error = await submitRes.json();
          assistantResponse = `Failed to process teach message: ${error.error}`;
        }
      } catch (error) {
        console.error("Knowledge submission error:", error);
        assistantResponse = "Failed to process teach message. Please try again.";
      }
    } else if (askMatch) {
      // Explicit ASK: prefix - use reasoning endpoint
      const question = content.substring(askMatch[0].length).trim();
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

        const reasonRes = await fetch(`${baseUrl}/api/reason`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session=${request.cookies.get("session")?.value}`,
          },
          body: JSON.stringify({ question, clientId: null }),
        });

        if (reasonRes.ok) {
          const result = await reasonRes.json();
          assistantResponse = result.answer;
          responseMetadata = {
            mode: "reason",
            citations: result.citations,
            domain: result.inferredDomain,
          };
        } else {
          assistantResponse = "Failed to process question.";
        }
      } catch (error) {
        console.error("Reasoning error:", error);
        assistantResponse = "Failed to process question.";
      }
    } else {
      // Natural language - classify intent and respond appropriately
      const intent = classifyIntent(content);
      console.log(`[Chat] Intent: ${intent.type}, Domain: ${intent.domain}, Confidence: ${intent.confidence}`);

      if (intent.type === "TEACH") {
        // Guide user to use proper teach format
        assistantResponse = `It looks like you want to teach me something! To ensure I learn correctly, please use this format:

**TEACH:**
**TITLE:** Your topic title
**DOMAIN:** ${intent.domain}
**CONTENT:** The information you want me to remember

For example:
\`\`\`
TEACH:
TITLE: SA VAT Registration Threshold
DOMAIN: VAT
CONTENT: In South Africa, a business must register for VAT if its taxable turnover exceeds R1 million in any consecutive 12-month period.
\`\`\``;
        responseMetadata = { mode: "teach_guide", suggestedDomain: intent.domain };

      } else if (intent.type === "ALLOCATION") {
        // Handle allocation questions
        const { suggestCategory, ALLOCATION_CATEGORIES } = await import("@/lib/bank-allocations");

        // Try to extract a transaction description from the question
        const descMatch = content.match(/["']([^"']+)["']/);
        if (descMatch) {
          const suggestion = await suggestCategory(descMatch[1]);
          if (suggestion.category) {
            assistantResponse = `For the transaction "${descMatch[1]}", I suggest categorizing it as **${suggestion.categoryLabel}** (${suggestion.category}) with ${(suggestion.confidence * 100).toFixed(0)}% confidence.

${suggestion.matchType === "learned" ? "This is based on patterns I've learned from previous allocations." : ""}
${suggestion.matchType === "keyword" ? "This is based on keyword matching." : ""}

If this is incorrect, you can teach me the correct category by going to the Bank Allocations page and correcting it there.`;
            responseMetadata = {
              mode: "allocation",
              suggestion,
              description: descMatch[1],
            };
          } else {
            assistantResponse = `I couldn't confidently categorize "${descMatch[1]}". Here are the available categories:\n\n${ALLOCATION_CATEGORIES.slice(0, 10).map(c => `- **${c.label}** (${c.code})`).join("\n")}\n\n...and more. Please allocate it manually in the Bank Allocations page, and I'll learn from your choice!`;
            responseMetadata = { mode: "allocation_unknown" };
          }
        } else {
          assistantResponse = `I can help with transaction allocations! Please put the transaction description in quotes, like:\n\n"How should I allocate 'TELKOM MONTHLY BILL R599'?"\n\nOr visit the **Bank Allocations** page to process transactions in bulk.`;
          responseMetadata = { mode: "allocation_help" };
        }

      } else if (intent.type === "CALCULATION") {
        // Handle tax/VAT calculations locally
        const calcResult = processCalculation(content);
        if (calcResult) {
          assistantResponse = calcResult;
          responseMetadata = { mode: "calculation", domain: intent.domain };
        } else {
          // Couldn't parse calculation, use bootstrap
          try {
            const result = await bootstrapAnswer(content, intent.domain, user.id);
            assistantResponse = result.answer;
            if (result.citationId) {
              assistantResponse += `\n\n📚 *[${result.citationId}]*`;
            }
            responseMetadata = { mode: "bootstrap_calculation", source: result.source };
          } catch {
            assistantResponse = `I couldn't understand that calculation. Try phrases like:
- "Calculate VAT on R1000"
- "What is the VAT on R5000 including?"
- "Income tax on R500000"
- "PAYE on R45000 monthly salary"`;
            responseMetadata = { mode: "calculation_help" };
          }
        }

      } else if (intent.type === "QUESTION" || intent.type === "GENERAL") {
        // Use bootstrap system - check KB first, then external LLM if needed
        try {
          const result = await bootstrapAnswer(content, intent.domain, user.id);

          assistantResponse = result.answer;

          if (result.citationId) {
            assistantResponse += `\n\n📚 *[${result.citationId}]*`;
          }

          if (result.source === "LLM" && result.provider) {
            assistantResponse += `\n\n💡 *This answer was generated by ${result.provider} and saved to my knowledge base for future reference.*`;
          }

          responseMetadata = {
            mode: "bootstrap",
            source: result.source,
            cached: result.cached,
            citationId: result.citationId,
            domain: result.domain,
            provider: result.provider,
          };
        } catch (error) {
          console.error("Bootstrap error:", error);
          assistantResponse = "I encountered an error while looking up the answer. Please try again or rephrase your question.";
          responseMetadata = { mode: "error" };
        }
      }
    }

    // Save assistant response
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: assistantResponse,
      },
    });

    // Log message send action with metadata
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "MESSAGE_SEND",
        entityType: "Message",
        entityId: userMessage.id,
        detailsJson: JSON.stringify({
          conversationId,
          messageLength: content.length,
          isTeachMode: !!teachMatch,
          isAskMode: !!askMatch,
          responseMetadata,
        }),
      },
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
      metadata: responseMetadata,
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
