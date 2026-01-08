# ✅ STAP 3: Domain-Aware Retrieval (Phase 1B) - Testing Guide

**Status**: READY FOR TESTING  
**Implementation Date**: January 8, 2026  
**Files Changed**: 1 (app/api/reason/route.ts)  
**New Functions**: 3 (inferDomain, inferTopic, itemMatchesDomain, itemMatchesTopic)  

---

## 🎯 Acceptance Criteria Testing

### 1. ✅ Domain Inference from Question Text

**Description**: System correctly infers tax domain from keywords in question.

**Supported Domains**:
- `VAT` - Keywords: "vat", "value added", "input tax", "output tax"
- `INCOME_TAX` - Keywords: "income tax", "taxable income", "personal tax", "salary tax"
- `COMPANY_TAX` - Keywords: "company tax", "corporate tax", "business tax", "profit tax"
- `PAYROLL` - Keywords: "payroll", "salary", "wage", "employee tax", "paye"
- `CAPITAL_GAINS_TAX` - Keywords: "cgt", "capital gains", "investment income", "property sale"
- `WITHHOLDING_TAX` - Keywords: "withholding", "dividend tax", "interest tax"
- `OTHER` - No keywords matched (no domain filtering)

**How to Test**:

1. **Test VAT inference**:
   - Question: `ASK: What is the VAT rate?`
   - Expected: Domain inferred as `VAT`
   - Check audit log: "inferredDomain": "VAT"

2. **Test INCOME_TAX inference**:
   - Question: `ASK: What is the income tax threshold?`
   - Expected: Domain inferred as `INCOME_TAX`
   - Check audit log: "inferredDomain": "INCOME_TAX"

3. **Test COMPANY_TAX inference**:
   - Question: `ASK: What is the company tax rate?`
   - Expected: Domain inferred as `COMPANY_TAX`
   - Check audit log: "inferredDomain": "COMPANY_TAX"

4. **Test PAYROLL inference**:
   - Question: `ASK: What are payroll taxes?`
   - Expected: Domain inferred as `PAYROLL`
   - Check audit log: "inferredDomain": "PAYROLL"

5. **Test OTHER when no keywords**:
   - Question: `ASK: Tell me about tax?`
   - Expected: Domain inferred as `OTHER`
   - Check audit log: "inferredDomain": "OTHER"

**Expected Result**: ✅ All domain keywords correctly matched

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - inferDomain()

**Verification**: Open browser DevTools → Network → /api/reason → Response JSON shows inferredDomain

---

### 2. ✅ Topic Inference from Question Text

**Description**: System correctly infers tax topic (threshold, rebate, rate) from keywords.

**Supported Topics**:
- `THRESHOLD` - Keywords: "threshold"
- `REBATE` - Keywords: "rebate"
- `BRACKET_RATE` - Keywords: "bracket", "rate", "marginal"
- `GENERAL` - No keywords matched (no topic filtering)

**How to Test**:

1. **Test THRESHOLD inference**:
   - Question: `ASK: What is the income tax threshold?`
   - Expected: Topic inferred as `THRESHOLD`
   - Check audit log: "inferredTopic": "THRESHOLD"

2. **Test REBATE inference**:
   - Question: `ASK: What rebates are available?`
   - Expected: Topic inferred as `REBATE`
   - Check audit log: "inferredTopic": "REBATE"

3. **Test BRACKET_RATE inference with "rate"**:
   - Question: `ASK: What is the company tax rate?`
   - Expected: Topic inferred as `BRACKET_RATE`
   - Check audit log: "inferredTopic": "BRACKET_RATE"

4. **Test BRACKET_RATE inference with "bracket"**:
   - Question: `ASK: What is the income tax bracket?`
   - Expected: Topic inferred as `BRACKET_RATE`
   - Check audit log: "inferredTopic": "BRACKET_RATE"

5. **Test BRACKET_RATE inference with "marginal"**:
   - Question: `ASK: What is the marginal tax rate?`
   - Expected: Topic inferred as `BRACKET_RATE`
   - Check audit log: "inferredTopic": "BRACKET_RATE"

6. **Test GENERAL when no keywords**:
   - Question: `ASK: Tell me about taxes?`
   - Expected: Topic inferred as `GENERAL`
   - Check audit log: "inferredTopic": "GENERAL"

**Expected Result**: ✅ All topic keywords correctly matched

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - inferTopic()

**Verification**: Open browser DevTools → Network → /api/reason → Response JSON shows inferredTopic

---

### 3. ✅ Domain-Based Filtering (Correct Domain Match)

**Description**: System filters KB candidates to only those matching the inferred domain.

**How to Test**:

**Setup Prerequisites**:
1. Create 3 KB items (one for each domain):
   - **Item A**: Title: "VAT Rate", primaryDomain: "VAT"
   - **Item B**: Title: "Income Tax Threshold", primaryDomain: "INCOME_TAX"
   - **Item C**: Title: "Company Tax Rate", primaryDomain: "COMPANY_TAX"
2. Approve all 3 items

**Part A: VAT question returns only VAT items**:
1. Question: `ASK: What is the VAT rate?`
2. Expected:
   - Inferred domain: "VAT"
   - Returns: Only Item A ("VAT Rate")
   - Does NOT return: Items B or C
3. Check audit log:
   - "inferredDomain": "VAT"
   - "candidatesInitial": 3
   - "candidatesAfterDomain": 1 (only Item A)

**Part B: Income tax question returns only INCOME_TAX items**:
1. Question: `ASK: What is the income tax threshold?`
2. Expected:
   - Inferred domain: "INCOME_TAX"
   - Returns: Only Item B ("Income Tax Threshold")
   - Does NOT return: Items A or C
3. Check audit log:
   - "inferredDomain": "INCOME_TAX"
   - "candidatesAfterDomain": 1 (only Item B)

**Part C: Secondary domains included**:
1. Create Item D: Title: "Dual Tax Info", primaryDomain: "OTHER", secondaryDomains: ["VAT"]
2. Question: `ASK: What is the VAT rate?`
3. Expected: Both Item A AND Item D returned (Item D has VAT in secondary)
4. Check audit log: "candidatesAfterDomain": 2

**Expected Result**: ✅ Domain filtering works correctly, excludes unrelated domains, includes secondary domains

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - itemMatchesDomain()

**Verification**: Check audit log candidatesAfterDomain count

---

### 4. ✅ Topic-Based Filtering

**Description**: System filters KB candidates to only those matching the inferred topic.

**How to Test**:

**Setup Prerequisites**:
1. Create KB items:
   - **Item 1**: Title: "Income Tax Threshold", content: "The threshold is R95,750"
   - **Item 2**: Title: "Low Income Rebate", content: "The rebate is R95,750"
   - **Item 3**: Title: "Marginal Tax Bracket", content: "The rate is 18%"
2. Approve all items
3. Ensure primaryDomain: "INCOME_TAX" for all

**Part A: THRESHOLD topic filters correctly**:
1. Question: `ASK: What is the income tax threshold?`
2. Expected:
   - Inferred topic: "THRESHOLD"
   - Returns: Item 1 (has "threshold")
   - Does NOT return: Item 2 (has "rebate", not "threshold")
3. Check audit log: "inferredTopic": "THRESHOLD", "candidatesAfterTopic": 1

**Part B: REBATE topic filters correctly**:
1. Question: `ASK: What rebates are available?`
2. Expected:
   - Inferred topic: "REBATE"
   - Returns: Item 2 (has "rebate")
   - Does NOT return: Items 1 or 3
3. Check audit log: "inferredTopic": "REBATE", "candidatesAfterTopic": 1

**Part C: BRACKET_RATE topic filters correctly**:
1. Question: `ASK: What is the marginal tax rate?`
2. Expected:
   - Inferred topic: "BRACKET_RATE"
   - Returns: Item 3 (has "rate")
   - Does NOT return: Items 1 or 2
3. Check audit log: "inferredTopic": "BRACKET_RATE", "candidatesAfterTopic": 1

**Part D: THRESHOLD excludes rebates unless specifically mentioned**:
1. Question: `ASK: What is the income tax threshold including rebate?`
2. Expected:
   - Inferred topic: "THRESHOLD"
   - Inferred domain: "INCOME_TAX"
   - Returns: Item 1 (threshold, allows rebate because question mentions it)
   - Can also return: Item 2 (has rebate + question mentions rebate)
3. Check audit log: "candidatesAfterTopic": >= 1

**Expected Result**: ✅ Topic filtering works, rebates excluded from threshold unless mentioned

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - itemMatchesTopic()

**Verification**: Check audit log candidatesAfterTopic count

---

### 5. ✅ Combined Domain + Topic Filtering

**Description**: System applies both domain AND topic filters together for precision.

**How to Test**:

**Setup Prerequisites**:
1. Create KB items:
   - **Item A**: Title: "Income Tax Threshold", domain: INCOME_TAX
   - **Item B**: Title: "Income Tax Rebate", domain: INCOME_TAX
   - **Item C**: Title: "Company Tax Threshold", domain: COMPANY_TAX
   - **Item D**: Title: "VAT Rate", domain: VAT

**Part A: Both filters applied together**:
1. Question: `ASK: What is the income tax threshold?`
2. Domain filter: INCOME_TAX (Items A, B remain)
3. Topic filter: THRESHOLD (Item A remains)
4. Expected result: Only Item A returned
5. Check audit log:
   - "inferredDomain": "INCOME_TAX"
   - "inferredTopic": "THRESHOLD"
   - "candidatesAfterDomain": 2 (Items A, B)
   - "candidatesAfterTopic": 1 (Item A only)

**Part B: Domain filter eliminates items before topic filter**:
1. Question: `ASK: What is the company tax rebate?`
2. Domain filter: COMPANY_TAX (only Item C remains)
3. Topic filter: REBATE (no items match)
4. Expected: "I don't have knowledge about that specific question yet"
5. Check audit log:
   - "candidatesAfterDomain": 1
   - "candidatesAfterTopic": 0

**Expected Result**: ✅ Filters applied in correct order (qualifier → domain → topic)

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - POST handler logic

**Verification**: Check audit log candidate counts at each stage

---

### 6. ✅ Single Answer Return (No Data Dumps)

**Description**: When single KB item matches all filters, return ONLY that one answer with citation.

**How to Test**:

1. Create KB item: Title: "Income Tax Threshold for 2025", content: "R95,750", domain: INCOME_TAX
2. Approve it
3. Question: `ASK: What is the income tax threshold?`
4. Expected response:
   - `answer`: "R95,750 [KB:INCOME_TAX:...]"
   - `citations`: Array with 1 citation
   - `matchCount`: 1
   - No clarification message
5. Response does NOT include:
   - Multiple options list
   - "Which do you mean?" message
   - Multiple citations

**Expected Result**: ✅ Single answer with one citation, no clarification needed

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - generateAnswer()

**Verification**: Check response body, citations array length should be 1

---

### 7. ✅ Clarification Question for Multiple Matches

**Description**: When multiple KB items match domain+topic filters, ask for clarification instead of dumping all.

**How to Test**:

1. Create 2 KB items with same domain+topic:
   - Item A: Title: "VAT Rate Standard", content: "Standard rate is 15%", domain: VAT
   - Item B: Title: "VAT Rate Zero", content: "Zero rate applies to...", domain: VAT
2. Approve both
3. Question: `ASK: What is the VAT rate?`
4. Expected response:
   - Contains: "Could you be more specific?"
   - Shows options: "• VAT Rate Standard", "• VAT Rate Zero"
   - `citations`: Empty array (clarification, not answer)
   - `shouldAskClarification`: true
5. Response does NOT:
   - Return both full answers
   - Pick one arbitrarily

**Expected Result**: ✅ Asks clarification, shows options, no dumped answers

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - generateAnswer()

**Verification**: Check response contains "Could you be more specific?"

---

### 8. ✅ Audit Logging with Domain/Topic Inference

**Description**: All reasoning queries logged with domain, topic, and filtering statistics.

**How to Test**:

1. Question: `ASK: What is the income tax threshold?`
2. Open Audit Log page (http://localhost:3000/admin/audit)
3. Filter by: "REASON_QUERY"
4. Find the latest entry for your question
5. Expand the entry to see JSON details
6. Verify it contains:
   - "question": "What is the income tax threshold?"
   - "inferredDomain": "INCOME_TAX"
   - "inferredTopic": "THRESHOLD"
   - "qualifiersExtracted": { numbers, ageRanges, phrases }
   - "candidatesInitial": (number of total KB items)
   - "candidatesAfterQualifier": (count after qualifier filtering)
   - "candidatesAfterDomain": (count after domain filtering)
   - "candidatesAfterTopic": (count after topic filtering)
   - "itemsMatched": (final count)
   - "citationsUsed": (array of citations)
   - "chosenCitationId": (if single match) or null

**Example JSON**:
```json
{
  "question": "What is the income tax threshold?",
  "inferredDomain": "INCOME_TAX",
  "inferredTopic": "THRESHOLD",
  "qualifiersExtracted": {
    "numbers": [],
    "ageRanges": [],
    "phrases": ["threshold"]
  },
  "candidatesInitial": 15,
  "candidatesAfterQualifier": 15,
  "candidatesAfterDomain": 8,
  "candidatesAfterTopic": 2,
  "itemsMatched": 1,
  "citationsUsed": [
    {
      "citationId": "KB:INCOME_TAX:income_tax_threshold:v1",
      "title": "Income Tax Threshold"
    }
  ],
  "chosenCitationId": "KB:INCOME_TAX:income_tax_threshold:v1"
}
```

**Expected Result**: ✅ Audit log shows all filtering stages and decisions

**File**: [app/api/reason/route.ts](app/api/reason/route.ts) - auditLog.create()

**Verification**: Audit Log page shows REASON_QUERY with detailed JSON

---

## 📋 Manual Test Checklist

### Test 1: Domain Inference
- [ ] VAT question infers VAT domain
- [ ] Income tax question infers INCOME_TAX domain
- [ ] No keyword question infers OTHER domain
- [ ] All 6 domains recognized correctly

### Test 2: Topic Inference
- [ ] Threshold question infers THRESHOLD topic
- [ ] Rebate question infers REBATE topic
- [ ] Rate question infers BRACKET_RATE topic
- [ ] Marginal question infers BRACKET_RATE topic
- [ ] Bracket question infers BRACKET_RATE topic

### Test 3: Domain Filtering
- [ ] Filters out items with wrong primary domain
- [ ] Includes items with matching secondary domain
- [ ] OTHER domain doesn't filter

### Test 4: Topic Filtering
- [ ] Threshold filters to "threshold" items
- [ ] Rebate filters to "rebate" items
- [ ] Rate/bracket/marginal filters correctly
- [ ] Rebates excluded from threshold unless mentioned

### Test 5: Combined Filtering
- [ ] Both domain and topic applied in correct order
- [ ] Qualifier filters first, then domain, then topic
- [ ] Proper candidate counts at each stage

### Test 6: Single Answer
- [ ] Single match returns ONE answer only
- [ ] Includes citation
- [ ] No clarification message
- [ ] No option list

### Test 7: Clarification
- [ ] Multiple matches ask "Could you be more specific?"
- [ ] Shows options list
- [ ] Does NOT dump all answers
- [ ] Empty citations array

### Test 8: Audit Log
- [ ] REASON_QUERY logged with domain
- [ ] REASON_QUERY logged with topic
- [ ] Candidate counts recorded
- [ ] Citation IDs logged
- [ ] All details in JSON

---

## 🎁 Response Format Example

**Single Answer**:
```json
{
  "outcome": "R95,750 [KB:INCOME_TAX:income_tax_threshold:v1]",
  "reason": "Found 1 matching knowledge item",
  "citations": [
    {
      "citationId": "KB:INCOME_TAX:income_tax_threshold:v1",
      "title": "Income Tax Threshold"
    }
  ],
  "answer": "R95,750 [KB:INCOME_TAX:income_tax_threshold:v1]",
  "hasRelevantKB": true,
  "matchCount": 1,
  "inferredDomain": "INCOME_TAX",
  "inferredTopic": "THRESHOLD"
}
```

**Clarification**:
```json
{
  "outcome": "I found multiple matching knowledge items. Could you be more specific?...",
  "reason": "Multiple matching items found",
  "citations": [],
  "answer": "I found multiple matching knowledge items. Could you be more specific?...",
  "hasRelevantKB": true,
  "matchCount": 2,
  "inferredDomain": "INCOME_TAX",
  "inferredTopic": "THRESHOLD"
}
```

---

## 🔍 Files Changed

**1 FILE MODIFIED**:
- [app/api/reason/route.ts](app/api/reason/route.ts)
  - Added: inferDomain() function
  - Added: inferTopic() function
  - Added: itemMatchesDomain() function
  - Added: itemMatchesTopic() function
  - Modified: POST handler to use domain/topic filtering
  - Modified: Audit logging to include domain/topic stats

**Lines Changed**: +115 lines of logic and filtering

---

## ✅ Sign-Off

**STAP 3: Domain-Aware Retrieval is COMPLETE and READY FOR TESTING**

All 8 acceptance criteria implemented:
1. ✅ Domain inference
2. ✅ Topic inference
3. ✅ Domain-based filtering
4. ✅ Topic-based filtering
5. ✅ Combined domain + topic filtering
6. ✅ Single answer return
7. ✅ Clarification for multiple matches
8. ✅ Audit logging with stats

**Status**: Ready for manual testing via chat interface  
**No External Dependencies**: Used only existing code patterns  
**Backwards Compatible**: Existing queries still work, just more precise now  

---

Generated: January 8, 2026  
By: GitHub Copilot  
Status: Ready for User Testing  
