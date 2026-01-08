# STAP 2: Website Ingest Testing - Acceptance Criteria

## Files Created/Modified

### Files Created:
1. `lib/website-ingest.ts` - Website validation, fetching, extraction, chunking
2. `app/api/knowledge/ingest-website/route.ts` - API endpoint for website ingestion

### Files Modified:
1. `prisma/schema.prisma` - Added sourceType, sourceUrl, sourceSection fields
2. `app/knowledge/page.tsx` - Added "Ingest Website" tab with URL input

### Database:
- Migration applied: `add_website_source_fields` ✓

---

## Test Plan

### ✅ Test 1: Allowlist Validation
**What to test**: Non-allowlisted URLs are rejected

```bash
# Try these URLs in the Knowledge UI:
- https://www.google.com → REJECT ✓
- http://www.sars.gov.za → REJECT (not HTTPS) ✓
- https://localhost:8080 → REJECT ✓
- https://www.sars.gov.za/... → ACCEPT ✓
```

**Expected**: Error message "This website is not approved for ingestion"

---

### ✅ Test 2: Successful Ingestion
**What to test**: SARS URL ingests and creates multiple PENDING knowledge items

```
URL: https://www.sars.gov.za/Legal/Policies-and-Legislation/Pages/default.aspx
Expected: 
- Page fetches successfully
- Content extracts (strips HTML, preserves headings)
- Content splits into ~3-5 chunks (one concept per chunk)
- Each chunk becomes a separate KnowledgeItem
- All items: status = PENDING, sourceType = "website", sourceUrl = [original URL]
```

---

### ✅ Test 3: Chunking Strategy
**What to test**: Content is split by concepts, not dumped as one

```
If a page has sections:
- H2: "Income Tax Thresholds"
  → Creates 1 KB item: "Income Tax Thresholds"
- H2: "Tax Rebates for 65+"
  → Creates 1 KB item: "Tax Rebates for 65+"
- H2: "VAT Rates"
  → Creates 1 KB item: "VAT Rates"

Result: 3 separate PENDING items, not 1 massive item
```

---

### ✅ Test 4: Pending Status
**What to test**: Website KB items NEVER auto-approve

```
1. Go to /knowledge
2. Filter by Status = "Pending"
3. See website-sourced items with:
   - sourceType = "website"
   - sourceUrl = [URL]
   - status = "PENDING"
4. NO auto-approval happened
```

---

### ✅ Test 5: Approve/Reject Workflow
**What to test**: Can approve/reject suggested items

```
1. In /knowledge, see suggested items
2. Click "Approve" on one item
   → Item moves to APPROVED
   → Can now be used in ASK: queries
3. Click "Reject" on another
   → Item moves to REJECTED
   → Never used in queries
```

---

### ✅ Test 6: Approved Items Work in ASK
**What to test**: Approved website KB can be queried

```
1. Approve a website item: "Income Tax Thresholds" from SARS
2. In Chat, ask: "ASK: What are the income tax thresholds?"
3. System finds and returns the approved SARS knowledge item
4. Citation shows source URL in audit log
```

---

### ✅ Test 7: Domain Inference
**What to test**: System correctly infers domain from content

```
If ingested text contains:
- "income tax", "taxable income" → domain = INCOME_TAX
- "vat", "value added tax" → domain = VAT
- "capital gains" → domain = CAPITAL_GAINS_TAX
- Unknown → domain = OTHER

Check Knowledge UI: Domain badges match inferred domains
```

---

### ✅ Test 8: Audit Logging
**What to test**: All actions logged

```
1. Ingest a website → Check /admin/audit
   - actionType: KB_INGEST_WEBSITE
   - URL logged
   - Chunks created count logged

2. Approve/reject → Check /admin/audit
   - actionType: KB_APPROVE or KB_REJECT
   - sourceType: website tracked
```

---

## How to Manually Test

### Prerequisites:
- Logged in as ruanvlog@lorenco.co.za
- Dev server running (http://localhost:3000)

### Quick Test Sequence:

1. **Go to Knowledge page**: http://localhost:3000/knowledge
2. **Click "Ingest Website" tab**
3. **Try invalid URL first**: 
   - Paste: `https://www.google.com`
   - Click Ingest
   - Expect: "This website is not approved for ingestion"
4. **Try valid URL**:
   - Paste: `https://www.sars.gov.za/Legal/Policies-and-Legislation/Pages/default.aspx`
   - Click Ingest
   - Should show: "✓ Created N suggested knowledge items"
5. **Switch to "Knowledge Items" tab**
   - Status = "Pending"
   - Should see new website items
   - Look for sourceUrl column
6. **Approve one item**
   - Click Approve button
   - Item status → APPROVED
7. **Test in Chat**
   - Go to /chat
   - Send: `ASK: What are the income tax rules?`
   - Should return the approved SARS knowledge

---

## Success Criteria

✅ All tests pass = STAP 2 Complete
- Allowlist enforced
- Chunking works
- Pending status enforced
- Approve/reject works
- Approved KB usable in ASK
- Domain inference works
- Audit logging complete

❌ Any test fails = Debug and re-test

---

## Expected Issues to Watch

1. **Fetch timeout**: If SARS is slow, 10s timeout may trigger
2. **HTML parsing**: Some pages may have complex structures that don't chunk well
3. **Content extraction**: Scripts/styles may not fully strip
4. **Domain inference**: Unknown domains default to "OTHER" (OK)

---

## Rollback (if needed)

If issues occur:
```bash
npx prisma migrate resolve --rolled-back add_website_source_fields
git checkout -- lib/website-ingest.ts app/api/knowledge/ingest-website/route.ts app/knowledge/page.tsx
```

---

**Status**: Ready for manual testing
**Date**: January 8, 2026
