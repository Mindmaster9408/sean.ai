// lib/calculations.ts
// South African Tax and Accounting Calculations

// VAT Rate (current as of 2024/2025)
export const VAT_RATE = 0.15; // 15%

// VAT Calculations
export function calculateVATInclusive(excludingVAT: number): {
  excluding: number;
  vat: number;
  including: number;
} {
  const vat = excludingVAT * VAT_RATE;
  return {
    excluding: Math.round(excludingVAT * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    including: Math.round((excludingVAT + vat) * 100) / 100,
  };
}

export function calculateVATExclusive(includingVAT: number): {
  excluding: number;
  vat: number;
  including: number;
} {
  const excluding = includingVAT / (1 + VAT_RATE);
  const vat = includingVAT - excluding;
  return {
    excluding: Math.round(excluding * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    including: Math.round(includingVAT * 100) / 100,
  };
}

export function extractVATFromInclusive(includingVAT: number): number {
  return Math.round((includingVAT * VAT_RATE / (1 + VAT_RATE)) * 100) / 100;
}

// SA Income Tax Tables 2024/2025 (Year of Assessment ending Feb 2025)
export const INCOME_TAX_BRACKETS_2025 = [
  { min: 0, max: 237100, rate: 0.18, baseTax: 0 },
  { min: 237101, max: 370500, rate: 0.26, baseTax: 42678 },
  { min: 370501, max: 512800, rate: 0.31, baseTax: 77362 },
  { min: 512801, max: 673000, rate: 0.36, baseTax: 121475 },
  { min: 673001, max: 857900, rate: 0.39, baseTax: 179147 },
  { min: 857901, max: 1817000, rate: 0.41, baseTax: 251258 },
  { min: 1817001, max: Infinity, rate: 0.45, baseTax: 644489 },
];

// Tax Rebates 2024/2025
export const TAX_REBATES_2025 = {
  primary: 17235, // All taxpayers
  secondary: 9444, // 65 years and older
  tertiary: 3145, // 75 years and older
};

// Tax Thresholds 2024/2025
export const TAX_THRESHOLDS_2025 = {
  under65: 95750,
  age65to74: 148217,
  age75plus: 165689,
};

// Medical Aid Tax Credits 2024/2025
export const MEDICAL_TAX_CREDITS_2025 = {
  mainMember: 364, // per month
  firstDependant: 364, // per month
  additionalDependants: 246, // per month each
};

// UIF Rates
export const UIF_RATE = 0.01; // 1% employee, 1% employer
export const UIF_CEILING = 17712; // Monthly ceiling

// SDL Rate (Skills Development Levy)
export const SDL_RATE = 0.01; // 1% of payroll

export interface TaxCalculationResult {
  taxableIncome: number;
  grossTax: number;
  rebates: number;
  medicalCredits: number;
  netTax: number;
  effectiveRate: number;
  marginalRate: number;
  monthlyTax: number;
  brackets: Array<{
    bracket: string;
    taxableInBracket: number;
    taxOnBracket: number;
  }>;
}

export function calculateIncomeTax(
  annualIncome: number,
  age: number = 30,
  medicalMembers: number = 0,
  medicalDependants: number = 0
): TaxCalculationResult {
  // Find applicable brackets
  let remainingIncome = annualIncome;
  let grossTax = 0;
  const bracketDetails: TaxCalculationResult["brackets"] = [];

  for (const bracket of INCOME_TAX_BRACKETS_2025) {
    if (annualIncome > bracket.min) {
      const taxableInBracket = Math.min(
        annualIncome - bracket.min,
        (bracket.max === Infinity ? annualIncome : bracket.max) - bracket.min
      );

      if (bracket.min === 0) {
        // First bracket
        const taxOnBracket = Math.min(annualIncome, bracket.max) * bracket.rate;
        grossTax = taxOnBracket;
        bracketDetails.push({
          bracket: `R0 - R${bracket.max.toLocaleString()}`,
          taxableInBracket: Math.min(annualIncome, bracket.max),
          taxOnBracket: Math.round(taxOnBracket * 100) / 100,
        });
      } else if (annualIncome > bracket.min) {
        const taxableAbove = Math.min(
          annualIncome - bracket.min,
          bracket.max === Infinity ? Infinity : bracket.max - bracket.min
        );
        const taxOnBracket = taxableAbove * bracket.rate;
        grossTax = bracket.baseTax + taxOnBracket;
        bracketDetails.push({
          bracket: `R${bracket.min.toLocaleString()} - R${bracket.max === Infinity ? "∞" : bracket.max.toLocaleString()}`,
          taxableInBracket: taxableAbove,
          taxOnBracket: Math.round(taxOnBracket * 100) / 100,
        });
      }
    }
  }

  // Calculate rebates
  let rebates = TAX_REBATES_2025.primary;
  if (age >= 65) rebates += TAX_REBATES_2025.secondary;
  if (age >= 75) rebates += TAX_REBATES_2025.tertiary;

  // Calculate medical tax credits (annual)
  let medicalCredits = 0;
  if (medicalMembers > 0) {
    medicalCredits += MEDICAL_TAX_CREDITS_2025.mainMember * 12;
    if (medicalMembers > 1 || medicalDependants > 0) {
      medicalCredits += MEDICAL_TAX_CREDITS_2025.firstDependant * 12;
    }
    if (medicalDependants > 1) {
      medicalCredits += MEDICAL_TAX_CREDITS_2025.additionalDependants * 12 * (medicalDependants - 1);
    }
  }

  // Net tax
  const netTax = Math.max(0, grossTax - rebates - medicalCredits);

  // Find marginal rate
  let marginalRate = 0;
  for (const bracket of INCOME_TAX_BRACKETS_2025) {
    if (annualIncome >= bracket.min) {
      marginalRate = bracket.rate;
    }
  }

  return {
    taxableIncome: annualIncome,
    grossTax: Math.round(grossTax * 100) / 100,
    rebates,
    medicalCredits,
    netTax: Math.round(netTax * 100) / 100,
    effectiveRate: annualIncome > 0 ? Math.round((netTax / annualIncome) * 10000) / 100 : 0,
    marginalRate: marginalRate * 100,
    monthlyTax: Math.round((netTax / 12) * 100) / 100,
    brackets: bracketDetails,
  };
}

// PAYE Calculation
export function calculatePAYE(
  monthlyGross: number,
  age: number = 30,
  medicalMembers: number = 0,
  medicalDependants: number = 0
): {
  monthlyPAYE: number;
  monthlyUIF: number;
  netSalary: number;
  annualProjection: TaxCalculationResult;
} {
  const annualGross = monthlyGross * 12;
  const annualTax = calculateIncomeTax(annualGross, age, medicalMembers, medicalDependants);

  const monthlyUIF = Math.min(monthlyGross * UIF_RATE, UIF_CEILING * UIF_RATE);

  return {
    monthlyPAYE: annualTax.monthlyTax,
    monthlyUIF: Math.round(monthlyUIF * 100) / 100,
    netSalary: Math.round((monthlyGross - annualTax.monthlyTax - monthlyUIF) * 100) / 100,
    annualProjection: annualTax,
  };
}

// Format currency
export function formatZAR(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}

// Parse natural language calculation requests
export function parseCalculationRequest(text: string): {
  type: "VAT_INCLUSIVE" | "VAT_EXCLUSIVE" | "INCOME_TAX" | "PAYE" | "UNKNOWN";
  amount?: number;
  age?: number;
} | null {
  const t = text.toLowerCase();

  // Extract amount
  const amountMatch = t.match(/r?\s*(\d[\d\s,]*(?:\.\d{2})?)/);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace(/[\s,]/g, ""))
    : undefined;

  // Extract age if mentioned
  const ageMatch = t.match(/(\d{2})\s*(?:years?\s*old|jaar)/);
  const age = ageMatch ? parseInt(ageMatch[1]) : undefined;

  if (t.includes("vat") || t.includes("btw")) {
    if (t.includes("excl") || t.includes("without") || t.includes("sonder")) {
      return { type: "VAT_INCLUSIVE", amount }; // Add VAT
    }
    if (t.includes("incl") || t.includes("with") || t.includes("met")) {
      return { type: "VAT_EXCLUSIVE", amount }; // Extract VAT
    }
    return { type: "VAT_EXCLUSIVE", amount }; // Default: extract from inclusive
  }

  if (t.includes("paye") || t.includes("salary") || t.includes("salaris") || t.includes("monthly tax")) {
    return { type: "PAYE", amount, age };
  }

  if (t.includes("income tax") || t.includes("inkomstebelasting") || t.includes("tax on")) {
    return { type: "INCOME_TAX", amount, age };
  }

  return null;
}

// Process calculation and return formatted response
export function processCalculation(text: string): string | null {
  const request = parseCalculationRequest(text);
  if (!request || !request.amount) return null;

  switch (request.type) {
    case "VAT_INCLUSIVE": {
      const result = calculateVATInclusive(request.amount);
      return `**VAT Calculation (Adding VAT)**

Amount excluding VAT: ${formatZAR(result.excluding)}
VAT (15%): ${formatZAR(result.vat)}
**Amount including VAT: ${formatZAR(result.including)}**`;
    }

    case "VAT_EXCLUSIVE": {
      const result = calculateVATExclusive(request.amount);
      return `**VAT Calculation (Extracting VAT)**

Amount including VAT: ${formatZAR(result.including)}
VAT (15%): ${formatZAR(result.vat)}
**Amount excluding VAT: ${formatZAR(result.excluding)}**`;
    }

    case "INCOME_TAX": {
      const result = calculateIncomeTax(request.amount, request.age || 30);
      return `**Income Tax Calculation (2024/2025)**

Taxable Income: ${formatZAR(result.taxableIncome)}
Gross Tax: ${formatZAR(result.grossTax)}
Less: Rebates: ${formatZAR(result.rebates)}
**Net Tax Payable: ${formatZAR(result.netTax)}**

Effective Rate: ${result.effectiveRate}%
Marginal Rate: ${result.marginalRate}%
Monthly Tax: ${formatZAR(result.monthlyTax)}`;
    }

    case "PAYE": {
      const result = calculatePAYE(request.amount, request.age || 30);
      return `**PAYE Calculation (Monthly)**

Gross Salary: ${formatZAR(request.amount)}
PAYE: ${formatZAR(result.monthlyPAYE)}
UIF (1%): ${formatZAR(result.monthlyUIF)}
**Net Salary: ${formatZAR(result.netSalary)}**

Annual Projection:
- Annual Gross: ${formatZAR(request.amount * 12)}
- Annual Tax: ${formatZAR(result.annualProjection.netTax)}
- Effective Rate: ${result.annualProjection.effectiveRate}%`;
    }

    default:
      return null;
  }
}
