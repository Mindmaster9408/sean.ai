// Light server-side input validation

export function validateTitle(title: string): { valid: boolean; error?: string } {
  if (!title || typeof title !== "string") {
    return { valid: false, error: "Title is required" };
  }

  const trimmed = title.trim();
  if (trimmed.length < 5) {
    return { valid: false, error: "Title must be at least 5 characters" };
  }

  if (trimmed.length > 200) {
    return { valid: false, error: "Title must be at most 200 characters" };
  }

  return { valid: true };
}

export function validateContentText(content: string): { valid: boolean; error?: string } {
  if (!content || typeof content !== "string") {
    return { valid: false, error: "Content is required" };
  }

  const trimmed = content.trim();
  if (trimmed.length < 20) {
    return { valid: false, error: "Content must be at least 20 characters" };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: "Content must be at most 10,000 characters" };
  }

  return { valid: true };
}

export function validateLayer(layer: string): { valid: boolean; error?: string } {
  const validLayers = ["LEGAL", "FIRM", "CLIENT"];
  if (!layer || !validLayers.includes(layer)) {
    return { valid: false, error: "Layer must be LEGAL, FIRM, or CLIENT" };
  }

  return { valid: true };
}

export function validateQuery(query: string): { valid: boolean; error?: string } {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Query is required" };
  }

  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: "Query must be at least 3 characters" };
  }

  if (trimmed.length > 1000) {
    return { valid: false, error: "Query must be at most 1,000 characters" };
  }

  return { valid: true };
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  try {
    const parsed = new URL(url);
    
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "URL must use HTTPS" };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: "URL must be a valid HTTPS URL" };
  }
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Email must be valid" };
  }

  return { valid: true };
}
