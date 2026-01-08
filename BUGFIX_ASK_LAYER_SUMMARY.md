# ✅ BUGFIX Summary: ASK Layer Filtering

## Bug Fixed
ASK endpoint did not include all layers by default and had no layer filtering capability.

## Changes Made
**File**: `app/api/reason/route.ts`

### 1. Request Parameter
```typescript
// Before: const { question, clientId } = await request.json();
// After:
const { question, clientId, layer } = await request.json();
```

### 2. Layer Filtering Logic
```typescript
// Apply layer filter only if explicitly specified
if (layer && ["LEGAL", "FIRM", "CLIENT"].includes(layer)) {
  where.layer = layer;
}
// Otherwise all layers included (no layer filter in WHERE)
```

### 3. Audit Logging
```typescript
// Added to detailsJson:
layer: layer || "ALL"
```

### 4. Response Field
```typescript
// Added to response JSON:
appliedLayer: layer || "ALL"
```

## Behavior

| Scenario | Result |
|----------|--------|
| No layer param | Returns LEGAL + FIRM + CLIENT items (ALL) |
| `layer: "LEGAL"` | Returns LEGAL items only |
| `layer: "FIRM"` | Returns FIRM items only |
| `layer: "CLIENT"` | Returns CLIENT items only |
| Invalid layer | Falls back to ALL (no error) |

## Test Case
**Without layer parameter**:
```
POST /api/reason
{
  "question": "What is VAT?"
}
```
✅ Returns LEGAL, FIRM, and CLIENT VAT knowledge items

## Verification
- ✅ TypeScript: No errors
- ✅ Backward compatible: layer parameter is optional
- ✅ Audit logging: layer tracked
- ✅ Response: appliedLayer returned
- ✅ Safe: Invalid layers rejected with fallback

---
Date: January 8, 2026
Status: ✅ COMPLETE
