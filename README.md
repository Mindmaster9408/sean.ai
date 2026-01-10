# Sean - AI Knowledge Layer

**Phase 0**: Knowledge-first foundation with strict governance, citations, and bilingual support (Afrikaans/English).

## Overview

Sean is a standalone AI webapp that provides a shared AI/knowledge layer for the Lorenco ecosystem. In Phase 0, Sean is primarily a knowledge seeding and governed reasoning assistant.

**Access is restricted to three allowlisted emails:**
- ruanvlog@lorenco.co.za
- antonjvr@lorenco.co.za
- mj@lorenco.co.za

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Authentication**: Session-based with email allowlist
- **Language Support**: English (EN) and Afrikaans (AF)

## Run Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

The `.env` file is already configured. Run the Prisma migration:

```bash
npx prisma migrate dev
```

This creates the SQLite database with all required tables.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

### 4. Login

Navigate to http://localhost:3000 and log in with one of the allowlisted emails.

## 🚀 Quick Deploy to Production

### Deploy to Zeabur (Recommended)

The fastest way to deploy Sean to production:

1. **Push your code to GitHub** (if not already done)
2. **Sign up at [zeabur.com](https://zeabur.com)** and connect your GitHub account
3. **Create a new project** and deploy from your GitHub repository
4. **Set environment variables** in Zeabur dashboard:
   - `DATABASE_URL` - Use Zeabur's PostgreSQL service or SQLite
   - `SESSION_SECRET` - A random 32+ character string
   - `NEXT_PUBLIC_APP_URL` - Your Zeabur domain

Zeabur will automatically detect the Next.js app and deploy it with zero configuration. For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

**Alternative deployment options:**
- Vercel
- Self-hosted VPS
- Docker

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete deployment instructions for all platforms.

---

## LAN Testing (Phone/Tablet Access)

To test the app on a phone or tablet on the same WiFi network:

### 1. Find Your LAN IP Address

**Windows (PowerShell):**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network (e.g., 192.168.0.27)

**macOS/Linux (Terminal):**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### 2. Access from Phone

Open a browser on your phone and navigate to:
```
http://192.168.0.27:3000
```
(Replace 192.168.0.27 with your actual LAN IP)

### 3. Windows Firewall

If the app is not accessible from the phone, allow Node.js through Windows Firewall:
1. Open **Windows Defender Firewall** > **Allow an app through firewall**
2. Find **Node.js** in the list and ensure **Private networks** is checked
3. Restart the dev server: `npm run dev`

### 4. Session Persistence

Login on the phone. The session cookie should persist across page refreshes and navigation.

---

## Testing Checklist (Phase 0 Acceptance Criteria)

### Authentication & Access Control
- [ ] Only the 3 allowlisted emails can access the app
- [ ] Invalid emails receive access denied error
- [ ] Session persists after page refresh
- [ ] Logout works correctly

### Teach Mode
- [ ] LEER:/TEACH:/SAVE TO KNOWLEDGE: creates PENDING knowledge item
- [ ] Citation ID generated correctly (KB:LAYER:slug:v1)
- [ ] Assistant acknowledges with citation reference
- [ ] Metadata parsing works (LAYER, TAGS, TITLE, etc.)

### Knowledge Admin
- [ ] Filter by status works
- [ ] Approve/Reject buttons work
- [ ] Status updates persist

### Reasoning (ASK: queries)
- [ ] ASK: queries use ONLY APPROVED knowledge
- [ ] Response includes citations
- [ ] Uncertainty stated when no knowledge found

### Audit Logging
- [ ] All actions logged (login, teach, approve, reject, reasoning)
- [ ] Audit page displays logs correctly

### Bilingual Support
- [ ] Language toggle works
- [ ] UI labels update in AF/EN

## Phase 0 Features

**ACTIVE:**
- Allowlist authentication
- Chat UI with conversations
- Teach Mode (LEER:/TEACH:/SAVE TO KNOWLEDGE:)
- Knowledge governance (approve/reject)
- Governed reasoning with citations
- Layered knowledge (LEGAL/FIRM/CLIENT)
- Client scope separation
- Audit logging
- Bilingual UI (AF/EN)

**PLANNED (Not in Phase 0):**
- External AI API calls
- Website crawling
- Tool/action framework
- Embeddings/vector search
- Other app integrations

---

**Built for Lorenco** | Phase 0 - January 2026
