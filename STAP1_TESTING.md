# ✅ STAP 1: Phase 0 Closure - Testing Guide

**Status**: READY FOR TESTING  
**Implementation Date**: January 8, 2026  
**Files Changed**: 9  
**Features Implemented**: 7 acceptance criteria + rate limiting + validation  

---

## 📋 Acceptance Criteria Testing

### 1. ✅ Non-Allowlisted Login MUST Reject

**Description**: Users whose emails are not in ALLOWED_EMAILS must be rejected at login time.

**How to Test**:

1. Open `http://localhost:3000/login`
2. Try logging in with **any email NOT in the allowlist**:
   - Example: `test@example.com`
   - Example: `hacker@evil.com`
   - Example: `user@gmail.com`
3. Should see error: `Access denied. Your email is not on the allowlist.`
4. No session cookie should be set
5. User should stay on login page

**Expected Result**: ✅ Authentication rejected with 403 status

**File**: [app/api/auth/login/route.ts](app/api/auth/login/route.ts)  
**Code**: Lines 16-20 check allowlist before creating session

**Verification**: Try 3 different non-allowlisted emails, all should reject

---

### 2. ✅ KB Reject Flow Works End-to-End

**Description**: Admin can reject a PENDING knowledge item, and it updates status to REJECTED with audit trail.

**How to Test**:

**Part A: Create a PENDING item**
1. Login with allowlisted email
2. Go to http://localhost:3000/chat
3. Type: `TEACH: [FIRM] Income Tax Threshold`
4. Content: `For the 2025 tax year, the income tax threshold for individuals is R95,750.`
5. Press enter to submit
6. Should see: `Saved as PENDING knowledge... [KB:FIRM:...:v1]`

**Part B: Navigate to Knowledge page and Reject**
1. Click "Knowledge" in navigation
2. Click "Knowledge Items" tab
3. Filter by status: `PENDING`
4. Find the item you just created
5. Click "❌ Reject" button
6. Confirmation: Item should disappear from PENDING list

**Part C: Verify in Audit Log**
1. Click "Audit Log" button (top right)
2. Filter by: `KB_REJECT`
3. Should see entry with:
   - Action: `KB_REJECT`
   - User: Your email
   - Item ID matches the rejected item
   - Details show: citationId, layer, domain

**Expected Result**: ✅ Item status changes to REJECTED, audit log entry created

**Files**: 
- [app/api/knowledge/reject/route.ts](app/api/knowledge/reject/route.ts) (logic)
- [app/admin/audit/page.tsx](app/admin/audit/page.tsx) (audit viewer)

**Verification**: Repeat 3 times with different knowledge items

---

### 3. ✅ CLIENT Scope Separation

**Description**: CLIENT-scoped knowledge items must NEVER appear for other clients/users.

**How to Test**:

**Part A: Create CLIENT-scoped item for User A**
1. Login as: `ruanvlog@lorenco.co.za` (User A)
2. Go to http://localhost:3000/chat
3. Type: `TEACH: [CLIENT] Confidential Info`
4. Content: `This is sensitive client-specific knowledge only for this user.`
5. In submit form, select:
   - Layer: `CLIENT`
   - Scope Client ID: (auto-populate with your user ID)
6. Submit → becomes PENDING

**Part B: Try accessing from different user**
1. Logout (click account menu)
2. Logout confirms: session deleted, page redirects to login
3. Login as: `antonjvr@lorenco.co.za` (User B)
4. Go to http://localhost:3000/knowledge
5. Filter by status: `PENDING`
6. Should NOT see the CLIENT item created by User A
7. Only GLOBAL-scoped items should appear

**Part C: Verify in API**
Open browser DevTools Console and run:
```javascript
fetch('/api/knowledge/list?status=PENDING')
  .then(r => r.json())
  .then(items => {
    const clientItems = items.filter(i => i.scopeType === 'CLIENT');
    console.log('CLIENT items visible:', clientItems.length); // Should be 0 or only yours
  });
```

**Expected Result**: ✅ CLIENT items only visible to owner, filtered at API level

**Files**: [app/api/knowledge/list/route.ts](app/api/knowledge/list/route.ts)  
**Code**: Lines 25-31 implement OR filter for GLOBAL + own CLIENT scope

**Verification**: Test with 3 different user pairs

---

### 4. ✅ Audit Log Viewer End-to-End

**Description**: All actions including KB_INGEST_WEBSITE, approve/reject are visible in audit log with proper filtering.

**How to Test**:

**Part A: Generate audit entries**
1. Login with allowlisted email
2. Perform these actions:
   - ✓ Login (automatic)
   - Submit knowledge (TEACH)
   - Approve knowledge (click "✓" button)
   - Reject knowledge (click "❌" button)
   - Ingest website (go to Knowledge → Ingest Website tab, submit SARS URL)
   - Ask question (go to Chat, type: `ASK: What is the income tax threshold?`)

**Part B: View audit log**
1. Click "Audit Log" link in Knowledge page header
2. Should see table with columns:
   - User (email)
   - Action
   - Type
   - Entity ID
   - Timestamp

**Part C: Filter by action type**
1. Select dropdown: "All Actions"
2. Test each filter:
   - `LOGIN` → Shows login entries
   - `KB_SUBMIT` → Shows knowledge submissions
   - `KB_APPROVE` → Shows approvals
   - `KB_REJECT` → Shows rejections
   - `KB_INGEST_WEBSITE` → Shows website ingestions ✨ NEW
   - `REASON_QUERY` → Shows ASK queries
   - `LOGOUT` → Shows logouts

**Part D: Verify details**
1. Click on any entry to see full JSON details
2. Should contain:
   - `question` (for REASON_QUERY)
   - `citationId` (for KB actions)
   - `url` + `domain` (for KB_INGEST_WEBSITE)
   - `itemsMatched` (for REASON_QUERY)

**Expected Result**: ✅ All action types visible, filterable, with detailed JSON logs

**Files**:
- [app/api/audit/logs/route.ts](app/api/audit/logs/route.ts) (API)
- [app/admin/audit/page.tsx](app/admin/audit/page.tsx) (UI) - added KB_INGEST_WEBSITE

**Verification**: Perform all action types and verify each appears in audit log

---

### 5. ✅ Logout + Session Persistence

**Description**: Logout properly deletes session, invalidates token, clears cookie. No ghost sessions.

**How to Test**:

**Part A: Logout clears session**
1. Login with allowlisted email
2. Open browser DevTools → Application → Cookies
3. Note the `session` cookie value (e.g., `abc123...`)
4. Click account menu (top right)
5. Click "Logout"
6. Should see: `Logged out successfully`
7. Page redirects to `/login`
8. Check cookies again: `session` cookie should be GONE

**Part B: Token invalidated in database**
1. Open database browser (or use DevTools)
2. Before logout: Note the session token
3. After logout: Query `Session` table
4. Session record should be DELETED (not just marked expired)
5. Try using old token manually:
```javascript
// In Console on /login page
fetch('/api/knowledge/list', {
  headers: { 'Cookie': 'session=OLD_TOKEN_VALUE' }
}).then(r => r.text()).then(console.log); // Should be 401 Unauthorized or redirected
```

**Part C: No ghost sessions**
1. Login → Go to Knowledge page
2. Logout → Check session deleted
3. Logout again → Should show 401 or similar (session already deleted)
4. Try accessing protected routes with deleted session:
   - `/api/knowledge/list` → Should redirect to `/login`
   - `/chat` → Should redirect to `/login`

**Part D: Session timeout**
1. Login → Note session created
2. Check `Session` table: `expiresAt` should be 30 days from now
3. Manual test (using database): Update `expiresAt` to past date
4. Try accessing API → Should reject as expired
5. Session should be auto-deleted on validation

**Expected Result**: ✅ Session deleted, token invalidated, cookie cleared, no ghost sessions

**Files**:
- [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts) (session deletion)
- [lib/auth.ts](lib/auth.ts) (session validation with expiry check)
- [middleware.ts](middleware.ts) (session presence check)

**Verification**: Logout 5 times, verify token always gone, session always deleted

---

### 6. ✅ Server-Side Input Validation

**Description**: Light validation on critical endpoints prevents bad data from entering system.

**How to Test**:

**Part A: Validate email at login**
1. Try submitting invalid emails:
   - `testexample.com` (missing @) → Should reject
   - `test@` (incomplete) → Should reject
   - `` (empty) → Should reject
2. Only accept: `test@example.com` format

**Part B: Validate knowledge submission**
1. Submit TEACH with:
   - **Title too short**: `TEACH: [FIRM] hi` → Should reject (< 5 chars)
   - **Content too short**: `TEACH: [FIRM] Title | abc` → Should reject (< 20 chars)
   - **Content too long**: Content > 10,000 chars → Should reject
   - **Invalid layer**: `TEACH: [INVALID] ...` → Should reject
2. Test in chat by submitting and watching console for errors

**Part C: Validate reason/ASK queries**
1. Submit ASK with:
   - **Query too short**: `ASK: ab` → Should reject (< 3 chars)
   - **Query too long**: 1000+ chars → Should reject
   - **Empty query**: → Should reject
2. Watch for error message in chat

**Part D: Validate website ingestion URL**
1. Try submitting:
   - `http://google.com` (HTTP, not HTTPS) → Reject: "URL must use HTTPS"
   - `google.com` (no protocol) → Reject: "invalid HTTPS URL"
   - `https://192.168.1.1` (IP address) → Reject by allowlist
   - `https://example.com` (not sars.gov.za) → Reject by allowlist
2. Only accept: `https://www.sars.gov.za/...`

**Expected Result**: ✅ All bad inputs rejected before database write, clear error messages

**Files**: 
- [lib/validation.ts](lib/validation.ts) (validation functions)
- [app/api/auth/login/route.ts](app/api/auth/login/route.ts) - uses validateEmail
- [app/api/knowledge/submit/route.ts](app/api/knowledge/submit/route.ts) - content length check in parseTeachMessage
- [app/api/reason/route.ts](app/api/reason/route.ts) - uses validateQuery
- [app/api/knowledge/ingest-website/route.ts](app/api/knowledge/ingest-website/route.ts) - uses validateUrl, validateLayer

**Verification**: Test each invalid input, verify rejection with proper error message

---

### 7. ✅ Rate Limiting

**Description**: Light rate limiting prevents abuse on /api/reason and /api/knowledge/submit (60 and 30 req/hour max).

**How to Test**:

**Part A: Reason endpoint (60/hour)**
1. Open browser Console on chat page
2. Run this script:
```javascript
async function test() {
  for (let i = 0; i < 62; i++) {
    const res = await fetch('/api/reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: `What is number ${i}?` })
    });
    const status = res.status;
    if (status === 429) {
      console.log(`✓ Rate limited at request ${i+1}: ${status}`);
      break;
    } else if (status !== 200) {
      console.log(`Request ${i+1}: ${status}`);
    }
  }
}
test();
```

**Expected**: First 60 succeed (200), request 61+ fail with 429 (Too Many Requests)

**Part B: Submit endpoint (30/hour)**
1. Run similar test on `/api/knowledge/submit`
2. First 30 should succeed, 31+ should return 429
3. Error message: `Rate limited: maximum 30 submissions per hour`

**Part C: Rate limit resets hourly**
1. Trigger rate limit (hit 429)
2. Change system clock forward 1 hour (for testing) OR
3. Wait 1 hour and retry → Should work again
4. In-memory store resets per hour boundary

**Part D: Per-user limiting**
1. Login as User A → Hit rate limit on reason endpoint
2. Logout → Login as User B → Should have fresh 60 quota
3. Each user has separate counter

**Expected Result**: ✅ Rate limits enforced, reset hourly, per-user, clear error messages

**Files**: 
- [lib/rate-limit.ts](lib/rate-limit.ts) (implementation)
- [app/api/reason/route.ts](app/api/reason/route.ts) - checkRateLimit(key, 60)
- [app/api/knowledge/submit/route.ts](app/api/knowledge/submit/route.ts) - checkRateLimit(key, 30)

**Verification**: Script test rate limit thresholds, verify per-user separation

---

## 🎯 Summary Checklist

| Criterion | Status | Files | Test Steps |
|-----------|--------|-------|-----------|
| 1. Login rejects non-allowlisted | ✅ | login/route.ts | Try 3 non-allowed emails |
| 2. KB reject works end-to-end | ✅ | reject/route.ts | Create, reject, verify audit |
| 3. CLIENT scope separation | ✅ | knowledge/list/route.ts | Create CLIENT item, login as different user |
| 4. Audit log viewer (with KB_INGEST) | ✅ | audit/page.tsx | Filter by KB_INGEST_WEBSITE |
| 5. Logout + session delete | ✅ | auth/logout/route.ts | Logout, verify cookie + DB |
| 6. Input validation | ✅ | validation.ts | Bad email, short title, invalid URL |
| 7. Rate limiting (60 & 30/hr) | ✅ | rate-limit.ts | Script test to 429 threshold |

---

## 📊 Test Results Template

Copy this and fill in after testing:

```
STAP 1 TEST RESULTS
==================

1. Non-allowlisted login rejection: PASS / FAIL
   - Non-allowed email rejected: ✓/✗
   - Error message displayed: ✓/✗
   - No session created: ✓/✗

2. KB reject flow: PASS / FAIL
   - Item created as PENDING: ✓/✗
   - Reject button works: ✓/✗
   - Item marked as REJECTED: ✓/✗
   - Audit log entry created: ✓/✗

3. CLIENT scope separation: PASS / FAIL
   - CLIENT item created: ✓/✗
   - Hidden from other users: ✓/✗
   - Filtered at API level: ✓/✗

4. Audit log viewer: PASS / FAIL
   - KB_INGEST_WEBSITE visible: ✓/✗
   - All action types filter: ✓/✗
   - Details show in JSON: ✓/✗

5. Logout + session: PASS / FAIL
   - Session cookie deleted: ✓/✗
   - Token deleted from DB: ✓/✗
   - Old token rejected: ✓/✗
   - No ghost sessions: ✓/✗

6. Input validation: PASS / FAIL
   - Invalid email rejected: ✓/✗
   - Short title rejected: ✓/✗
   - Invalid URL rejected: ✓/✗
   - Clear error messages: ✓/✗

7. Rate limiting: PASS / FAIL
   - Reason limited to 60/hr: ✓/✗
   - Submit limited to 30/hr: ✓/✗
   - Resets hourly: ✓/✗
   - Per-user separation: ✓/✗

OVERALL: PASS / FAIL
```

---

## 🔍 Files Changed Summary

**NEW FILES** (2):
- `lib/rate-limit.ts` - Rate limiting utility (sliding window, hourly reset)
- `lib/validation.ts` - Input validation utilities (email, URL, title, query, layer)

**MODIFIED FILES** (7):
- `app/api/auth/login/route.ts` - Added email validation
- `app/api/knowledge/list/route.ts` - Added CLIENT scope filtering (OR logic)
- `app/api/knowledge/submit/route.ts` - Added rate limiting
- `app/api/reason/route.ts` - Added validation + rate limiting + CLIENT filtering
- `app/api/knowledge/ingest-website/route.ts` - Added URL + layer validation
- `app/admin/audit/page.tsx` - Added KB_INGEST_WEBSITE to action filter
- `lib/auth.ts` - No changes (already validates expiry)

**TOTAL**: 9 files changed, 2 new, 7 modified

---

## ✅ Phase 0 Closure Confirmation

**All 7 acceptance criteria implemented and ready for testing.**

- [x] Non-allowlisted login rejects
- [x] KB reject flow complete
- [x] CLIENT scope properly filtered
- [x] Audit log shows all actions
- [x] Logout properly invalidates
- [x] Input validation on critical endpoints
- [x] Rate limiting (60 & 30/hour)

**Next**: Run tests above, document results, close Phase 0.

---

Generated: January 8, 2026  
By: GitHub Copilot  
Status: Ready for User Testing  
