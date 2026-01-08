import { v4 as uuidv4 } from "uuid";

const VALID_DOMAINS = [
  "VAT",
  "INCOME_TAX",
  "COMPANY_TAX",
  "PAYROLL",
  "CAPITAL_GAINS_TAX",
  "WITHHOLDING_TAX",
  "ACCOUNTING_GENERAL",
  "OTHER",
];

export interface TeachModeInput {
  layer: "LEGAL" | "FIRM" | "CLIENT";
  scopeType: "GLOBAL" | "CLIENT";
  scopeClientId?: string;
  title: string;
  contentText: string;
  language: "AF" | "EN" | "MIXED";
  tags: string[];
  primaryDomain: string;
  secondaryDomains: string[];
}

export interface ParsedTeachMessage {
  success: boolean;
  data?: TeachModeInput;
  error?: string;
}

// Parse LEER:/TEACH:/SAVE TO KNOWLEDGE: prefix and extract metadata
export function parseTeachMessage(content: string): ParsedTeachMessage {
  const teachMatch = content.match(/^(LEER:|TEACH:|SAVE TO KNOWLEDGE:)/i);
  if (!teachMatch) {
    return { success: false, error: "Not a teach message" };
  }

  const afterPrefix = content.substring(teachMatch[0].length).trim();
  const lines = afterPrefix.split("\n");

  let layer: "LEGAL" | "FIRM" | "CLIENT" = "FIRM"; // default
  let scopeType: "GLOBAL" | "CLIENT" = "GLOBAL";
  let scopeClientId: string | undefined;
  let title = "";
  let language: "AF" | "EN" | "MIXED" = "EN"; // default
  let tags: string[] = [];
  let primaryDomain = "OTHER"; // default
  let secondaryDomains: string[] = [];
  let contentText = "";
  let contentStart = 0;

  // Parse metadata lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("LAYER:")) {
      const layerValue = line.substring(6).trim().toUpperCase();
      if (["LEGAL", "FIRM", "CLIENT"].includes(layerValue)) {
        layer = layerValue as "LEGAL" | "FIRM" | "CLIENT";
      }
    } else if (line.startsWith("CLIENT:")) {
      scopeType = "CLIENT";
      scopeClientId = line.substring(7).trim();
    } else if (line.startsWith("TITLE:")) {
      title = line.substring(6).trim();
    } else if (line.startsWith("TAGS:")) {
      tags = line
        .substring(5)
        .trim()
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);
    } else if (line.startsWith("LANGUAGE:")) {
      const langValue = line.substring(9).trim().toUpperCase();
      if (["AF", "EN", "MIXED"].includes(langValue)) {
        language = langValue as "AF" | "EN" | "MIXED";
      }
    } else if (line.startsWith("DOMAIN:")) {
      const domainValue = line.substring(7).trim().toUpperCase();
      if (VALID_DOMAINS.includes(domainValue)) {
        primaryDomain = domainValue;
      }
    } else if (line.startsWith("SECONDARY_DOMAINS:")) {
      const secondaryStr = line.substring(18).trim();
      secondaryDomains = secondaryStr
        .split(",")
        .map((d) => d.trim().toUpperCase())
        .filter((d) => d && VALID_DOMAINS.includes(d));
    } else if (line.startsWith("CONTENT:")) {
      contentText = line.substring(8).trim();
      contentStart = i + 1;
      break;
    } else if (line === "") {
      // Empty line might separate metadata from content
      contentStart = i + 1;
      break;
    } else {
      // If we hit non-metadata line without CONTENT:, treat rest as content
      contentStart = i;
      break;
    }
  }

  // Gather remaining lines as content if not explicitly marked
  if (contentStart < lines.length && !contentText) {
    contentText = lines.slice(contentStart).join("\n").trim();
  }

  // If no title provided, generate from first sentence
  if (!title) {
    const firstLine = contentText.split("\n")[0].substring(0, 60);
    title = firstLine.endsWith(".") ? firstLine : firstLine + "...";
  }

  // Validate required fields
  if (!contentText) {
    return {
      success: false,
      error: "No content provided. Please add content after CONTENT: or after metadata.",
    };
  }

  if (layer === "CLIENT" && !scopeClientId) {
    return {
      success: false,
      error: "CLIENT layer requires CLIENT: field with client ID",
    };
  }

  return {
    success: true,
    data: {
      layer,
      scopeType,
      scopeClientId,
      title,
      contentText,
      language,
      tags,
      primaryDomain,
      secondaryDomains,
    },
  };
}

// Generate a slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 50);
}

// Generate citation ID
export function generateCitationId(
  layer: string,
  slug: string,
  version: number = 1
): string {
  return `KB:${layer}:${slug}:v${version}`;
}

// Simple keyword search over knowledge items (Phase 0: no embeddings)
export function matchRelevantItems(
  question: string,
  items: Array<{ contentText: string; citationId: string; title: string }>
): Array<{ contentText: string; citationId: string; title: string; score: number }> {
  const keywords = question.toLowerCase().split(/\s+/);

  return items
    .map((item) => {
      let score = 0;
      const content = item.contentText.toLowerCase();
      const title = item.title.toLowerCase();

      // Score based on keyword matches
      keywords.forEach((keyword) => {
        if (title.includes(keyword)) score += 10;
        if (content.includes(keyword)) score += 1;
      });

      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3 matches
}

// Format answer with citations
export function formatAnswerWithCitations(
  outcome: string,
  reason: string,
  citations: Array<{ citationId: string; title: string }>
): string {
  let answer = `**Outcome:** ${outcome}\n\n`;
  answer += `**Reason:** ${reason}\n\n`;

  if (citations.length > 0) {
    answer += `**Citations:**\n`;
    citations.forEach((cit) => {
      answer += `- [${cit.citationId}] ${cit.title}\n`;
    });
  } else {
    answer += `**Note:** No approved knowledge items found for this query.`;
  }

  return answer;
}
