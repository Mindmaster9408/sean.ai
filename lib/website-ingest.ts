// Website ingestion configuration and processing

// Allowlisted domains - STRICT GATE
const ALLOWED_DOMAINS = ["sars.gov.za", "www.sars.gov.za"];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  INCOME_TAX: ["income tax", "taxable income", "tax threshold", "earning"],
  VAT: ["vat", "value added tax", "input tax", "output tax"],
  COMPANY_TAX: ["company tax", "corporate tax", "capital allowance"],
  PAYROLL: ["payroll", "salary", "wage", "paye", "employment"],
  CAPITAL_GAINS_TAX: ["capital gains", "capital loss", "disposal"],
  WITHHOLDING_TAX: ["withholding tax", "interest", "dividends"],
  ACCOUNTING_GENERAL: ["accounting", "record-keeping", "documentation"],
  OTHER: [],
};

// Validate URL against allowlist
export function validateWebsiteUrl(urlString: string): {
  valid: boolean;
  error?: string;
  domain?: string;
} {
  try {
    const url = new URL(urlString);

    // Only HTTPS
    if (url.protocol !== "https:") {
      return { valid: false, error: "Only HTTPS URLs are allowed" };
    }

    // Not localhost or IP addresses
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
    ) {
      return { valid: false, error: "Private/local URLs are not allowed" };
    }

    // Check allowlist
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith("." + domain)
    );

    if (!isAllowed) {
      return {
        valid: false,
        error: "This website is not approved for ingestion",
      };
    }

    return { valid: true, domain: url.hostname };
  } catch (error) {
    return { valid: false, error: "Invalid URL format" };
  }
}

// Fetch website content with safety limits
export async function fetchWebsiteContent(
  url: string
): Promise<{ html: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { html: "", error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return {
        html: "",
        error: "Only HTML and text content is supported",
      };
    }

    // Check content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
      // 2MB limit
      return { html: "", error: "Content exceeds 2MB limit" };
    }

    const html = await response.text();
    return { html };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { html: "", error: "Request timeout (10s)" };
    }
    return { html: "", error: error.message };
  }
}

// Extract readable text from HTML
export function extractTextFromHtml(html: string): {
  text: string;
  headings: Array<{ level: number; text: string }>;
} {
  // Remove script and style tags
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Extract headings first
  const headings: Array<{ level: number; text: string }> = [];
  const headingRegex = /<h([1-4])[^>]*>([^<]+)<\/h\1>/gi;
  let match;
  while ((match = headingRegex.exec(cleaned)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      text: match[2].trim().replace(/&nbsp;/g, " "),
    });
  }

  // Convert HTML to text
  cleaned = cleaned
    // Preserve paragraph breaks
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    // Tables: preserve structure
    .replace(/<td[^>]*>/gi, " | ")
    .replace(/<\/td>/gi, "")
    .replace(/<tr[^>]*>/gi, "")
    .replace(/<\/tr>/gi, "\n")
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean whitespace
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return { text: cleaned, headings };
}

// Infer domain from content
export function inferDomain(
  text: string,
  title: string
): { domain: string; confidence: number } {
  const content = (text + " " + title).toLowerCase();

  let bestDomain = "OTHER";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.length === 0) continue;

    const score = keywords.filter((keyword) => content.includes(keyword)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  const confidence = bestScore > 0 ? Math.min(bestScore * 0.3, 1.0) : 0.5; // cap at 1.0

  return { domain: bestDomain, confidence };
}

// Split content into concept chunks
export interface ConceptChunk {
  title: string;
  content: string;
  sourceSection?: string;
  domain: string;
  keywords: string[];
  confidence: "auto" | "suggested";
}

export function chunkContent(
  text: string,
  headings: Array<{ level: number; text: string }>,
  pageTitle: string
): ConceptChunk[] {
  const chunks: ConceptChunk[] = [];

  // Strategy: split by major headings (H1-H2)
  const lines = text.split("\n");

  let currentHeading = pageTitle;
  let currentContent: string[] = [];
  let currentLevel = 0;

  for (const line of lines) {
    // Check if this line is a heading
    const headingMatch = headings.find(
      (h) => h.text.toLowerCase() === line.toLowerCase()
    );

    if (headingMatch && headingMatch.level <= 2) {
      // Save previous section
      if (currentContent.length > 0) {
        const contentText = currentContent.join("\n").trim();
        if (contentText.length > 50) {
          // Only create chunks with meaningful content
          const chunk = createChunk(
            currentHeading,
            contentText,
            currentHeading,
            pageTitle
          );
          if (chunk) chunks.push(chunk);
        }
      }

      // Start new section
      currentHeading = line;
      currentLevel = headingMatch.level;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save final section
  if (currentContent.length > 0) {
    const contentText = currentContent.join("\n").trim();
    if (contentText.length > 50) {
      const chunk = createChunk(
        currentHeading,
        contentText,
        currentHeading,
        pageTitle
      );
      if (chunk) chunks.push(chunk);
    }
  }

  return chunks;
}

function createChunk(
  title: string,
  content: string,
  section: string,
  pageTitle: string
): ConceptChunk | null {
  // Clean up title
  title = title.replace(/^\d+\.\s*/, "").trim(); // Remove numbering
  if (title.length < 3) return null;

  // Extract keywords (simple: words > 4 chars that appear multiple times)
  const words = content.toLowerCase().split(/\W+/);
  const wordFreq: Record<string, number> = {};
  words.forEach((word) => {
    if (word.length > 4) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq)
    .filter(([, freq]) => freq >= 2)
    .map(([word]) => word)
    .slice(0, 5);

  const { domain } = inferDomain(content, title);

  return {
    title,
    content,
    sourceSection: section !== pageTitle ? section : undefined,
    domain,
    keywords,
    confidence: "suggested",
  };
}
