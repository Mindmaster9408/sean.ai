# Knowledge Domains Phase 0 Implementation

## Overview

Added tax domain classification to the Knowledge Base system. Each KB item can now have:
- **Primary Domain**: Main tax category (VAT, INCOME_TAX, COMPANY_TAX, PAYROLL, etc.)
- **Secondary Domains**: Additional cross-domain tags (array)

## Domains Enum

```
VAT
INCOME_TAX
COMPANY_TAX
PAYROLL
CAPITAL_GAINS_TAX
WITHHOLDING_TAX
ACCOUNTING_GENERAL
OTHER (default)
```

---

## Files Changed

### 1. Data Model
- **`prisma/schema.prisma`**
  - Added `primaryDomain` field (String, default "OTHER")
  - Added `secondaryDomains` field (String/JSON array, default "[]")
  - Added index on `primaryDomain` for filtering performance
  - Generated migration: `20260108091004_add_knowledge_domains`

### 2. Parser
- **`lib/kb.ts`**
  - Updated `TeachModeInput` interface to include `primaryDomain` and `secondaryDomains`
  - Added `VALID_DOMAINS` constant for validation
  - Updated `parseTeachMessage()` function to parse:
    - `DOMAIN: <enum>` header (case-insensitive, defaults to "OTHER")
    - `SECONDARY_DOMAINS: A, B, C` header (comma-separated, normalized)

### 3. Backend Endpoints
- **`app/api/knowledge/submit/route.ts`**
  - Store `primaryDomain` and `secondaryDomains` in KnowledgeItem creation
  - Include domain info in audit log details

- **`app/api/knowledge/list/route.ts`**
  - Added `primaryDomain` query param filter
  - Added `secondaryDomain` query param filter (uses JSON string contains)
  - Keep existing `status` and `layer` filters

- **`app/api/knowledge/approve/route.ts`**
  - Include `primaryDomain` and `secondaryDomains` in audit log

- **`app/api/knowledge/reject/route.ts`**
  - Include `primaryDomain` and `secondaryDomains` in audit log

### 4. UI
- **`app/knowledge/page.tsx`**
  - Added `DOMAINS` constant for dropdown options
  - Extended `KnowledgeItem` interface with domain fields
  - Added filter dropdowns:
    - **Primary Domain** (filters by exact match)
    - **Secondary Domain** (filters if domain is in array)
  - Added `getDomainColor()` function for color-coded domain badges
  - Display primary domain badge on each item
  - Display secondary domains as additional tags/chips
  - Updated hooks to include domain filters in URL params

---

## Usage Examples

### Teach Mode - Basic Usage

```
TEACH:
DOMAIN: VAT
TITLE: Standard VAT Rate in South Africa
CONTENT:
The standard VAT rate in South Africa is 15% as of January 2024.
```

Result:
- `primaryDomain = "VAT"`
- `secondaryDomains = []`

### Teach Mode - With Secondary Domains

```
TEACH:
DOMAIN: COMPANY_TAX
SECONDARY_DOMAINS: INCOME_TAX, ACCOUNTING_GENERAL
TITLE: Corporate Tax Deductions
CONTENT:
Companies can deduct certain business expenses from taxable income...
```

Result:
- `primaryDomain = "COMPANY_TAX"`
- `secondaryDomains = ["INCOME_TAX", "ACCOUNTING_GENERAL"]`

### Teach Mode - Minimal (Uses Defaults)

```
TEACH:
TITLE: General Accounting Info
CONTENT:
Some general accounting knowledge...
```

Result:
- `primaryDomain = "OTHER"`
- `secondaryDomains = []`

---

## API Filtering

### List with Domain Filters

```bash
# Filter by primary domain
GET /api/knowledge/list?status=approved&primaryDomain=VAT

# Filter by secondary domain
GET /api/knowledge/list?status=approved&secondaryDomain=COMPANY_TAX

# Multiple filters
GET /api/knowledge/list?status=approved&layer=LEGAL&primaryDomain=VAT
```

---

## Database

### Migration Details

Created migration `20260108091004_add_knowledge_domains`:

```sql
-- Added to KnowledgeItem table:
ALTER TABLE "KnowledgeItem" ADD COLUMN "primaryDomain" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "KnowledgeItem" ADD COLUMN "secondaryDomains" TEXT NOT NULL DEFAULT '[]';
CREATE INDEX "KnowledgeItem_primaryDomain_idx" on "KnowledgeItem"("primaryDomain");
```

### Run Migration

The migration has already been applied. To verify:

```bash
npx prisma db push
npx prisma studio  # Open UI to inspect data
```

---

## Audit Logging

All domain information is automatically logged:

### KB_SUBMIT
```json
{
  "conversationId": "...",
  "layer": "FIRM",
  "citationId": "KB:FIRM:vat-rate:v1",
  "primaryDomain": "VAT",
  "secondaryDomains": ["ACCOUNTING_GENERAL"],
  "isNewVersion": false
}
```

### KB_APPROVE
```json
{
  "citationId": "KB:FIRM:vat-rate:v1",
  "layer": "FIRM",
  "primaryDomain": "VAT",
  "secondaryDomains": ["ACCOUNTING_GENERAL"]
}
```

### KB_REJECT
Same structure as KB_APPROVE.

---

## Manual Test Checklist

### ✅ Test 1: Create KB with Primary Domain

**Steps:**
1. Open Chat page
2. Send TEACH message:
   ```
   TEACH:
   DOMAIN: VAT
   TITLE: VAT Test Item
   CONTENT: Test content about VAT
   ```
3. Navigate to Knowledge Base

**Expected Result:**
- Item appears in PENDING status
- Primary domain shows as "VAT" badge (indigo)
- Filter dropdown "Primary Domain" now shows "VAT" option

### ✅ Test 2: Create KB with Secondary Domains

**Steps:**
1. Send TEACH message:
   ```
   TEACH:
   DOMAIN: COMPANY_TAX
   SECONDARY_DOMAINS: ACCOUNTING_GENERAL, INCOME_TAX
   TITLE: Multi-Domain Tax Item
   CONTENT: Cross-domain tax knowledge
   ```
2. Go to Knowledge page

**Expected Result:**
- Item shows "COMPANY_TAX" as primary (sky blue)
- Shows secondary tags: "ACCOUNTING GENERAL", "INCOME TAX" (smaller, opacity-75)

### ✅ Test 3: Filter by Primary Domain

**Steps:**
1. Create 2+ KB items with different domains (e.g., VAT, COMPANY_TAX)
2. On Knowledge page, select "Primary Domain" → "VAT"

**Expected Result:**
- Only VAT items displayed
- Other domains hidden

### ✅ Test 4: Filter by Secondary Domain

**Steps:**
1. Create items:
   - Item A: primary=VAT, secondary=[ACCOUNTING_GENERAL]
   - Item B: primary=COMPANY_TAX, secondary=[ACCOUNTING_GENERAL]
   - Item C: primary=INCOME_TAX, secondary=[]
2. Select "Secondary Domain" → "ACCOUNTING_GENERAL"

**Expected Result:**
- Item A and Item B display
- Item C hidden (no secondary domain)

### ✅ Test 5: Combine Filters

**Steps:**
1. Set:
   - Status: Pending
   - Layer: FIRM
   - Primary Domain: VAT
   - Secondary Domain: (keep "All")
2. Apply filters

**Expected Result:**
- Only pending FIRM-layer VAT items shown
- Other combinations filtered out

### ✅ Test 6: Approve with Domain Logging

**Steps:**
1. Create a PENDING KB item with domain
2. Click Approve button
3. Navigate to Admin → Audit

**Expected Result:**
- Item status changes to APPROVED
- Audit log shows KB_APPROVE action
- Details include primaryDomain and secondaryDomains

### ✅ Test 7: Default Values

**Steps:**
1. Send TEACH without DOMAIN header:
   ```
   TEACH:
   TITLE: No Domain Item
   CONTENT: This item has no explicit domain
   ```
2. Check Knowledge page

**Expected Result:**
- Item shows "OTHER" domain (slate color)
- Appears when filtering "All Domains"

### ✅ Test 8: Invalid Domain Names

**Steps:**
1. Send TEACH with invalid domain:
   ```
   TEACH:
   DOMAIN: INVALID_DOMAIN
   SECONDARY_DOMAINS: VAT, FAKE_DOMAIN, COMPANY_TAX
   TITLE: Test
   CONTENT: Test
   ```

**Expected Result:**
- `primaryDomain` falls back to "OTHER"
- `secondaryDomains` = ["VAT", "COMPANY_TAX"] (invalid names filtered out)

### ✅ Test 9: API Filtering

**Steps:**
1. Create items with various domains
2. Test API directly:
   ```bash
   curl "http://localhost:3000/api/knowledge/list?primaryDomain=VAT"
   curl "http://localhost:3000/api/knowledge/list?secondaryDomain=ACCOUNTING_GENERAL"
   ```

**Expected Result:**
- Correct items returned in JSON
- Domains properly filtered server-side

### ✅ Test 10: Performance

**Steps:**
1. Create 100+ KB items with various domains
2. Filter and list operations
3. Check browser DevTools → Network (response time)

**Expected Result:**
- Filtering is fast (<200ms)
- Index on primaryDomain is being used

---

## Known Limitations (Phase 0)

1. ✋ **No UI for editing domains on PENDING items** - Use approve/reject + resubmit
2. ✋ **Secondary domain filtering uses JSON contains** - Not exact set matching
3. ✋ **No domain analytics/reporting** - Can be added in Phase 1
4. ✋ **Citation ID format unchanged** - Domains are metadata, not part of citation

---

## Backward Compatibility

✅ **Fully backward compatible:**
- Existing KB items get `primaryDomain = "OTHER"` and `secondaryDomains = []`
- Existing TEACH messages still work (domains default to OTHER)
- All existing filters and searches still function
- No schema breaking changes

---

## Next Steps (Phase 1)

- [ ] Domain analytics dashboard
- [ ] Edit domain on PENDING items
- [ ] Domain-based knowledge recommendations
- [ ] Domain hierarchies (e.g., VAT → Standard Rate vs Zero Rate)
- [ ] Cross-domain reasoning in ASK mode
- [ ] Domain-specific access control

---

## Support

If you need to troubleshoot:

1. **Check migration applied:**
   ```bash
   npx prisma migrate status
   ```

2. **Verify schema:**
   ```bash
   npx prisma studio  # Open DB explorer
   ```

3. **Check Prisma client generated:**
   ```bash
   ls node_modules/.prisma/client/  # Should see latest schema
   ```

4. **Rebuild if issues:**
   ```bash
   rm -rf node_modules/.prisma/client/
   npx prisma generate
   ```
