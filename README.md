# Sean AI - Intelligent Accounting Assistant

**Phase 1**: Bootstrap learning with external LLM APIs, bank allocation learning, and natural language chat.

## Overview

Sean AI is a standalone AI webapp that serves as an intelligent accounting assistant for the Lorenco ecosystem. It features:

- **Bootstrap Learning**: Ask questions naturally - Sean checks the knowledge base first, and if no answer exists, calls an external LLM (Claude/OpenAI/Grok) ONCE and stores the answer for future reuse.
- **Bank Allocations**: Import transactions and let Sean suggest categories. Correct Sean's suggestions and he learns your patterns.
- **Knowledge Base**: Teach Sean facts, rules, and procedures. All knowledge is stored locally with full audit trails.
- **South African Focus**: Built for SA tax (VAT, Income Tax, Company Tax, Payroll, etc.) and accounting practices.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: SQLite with Prisma ORM
- **Authentication**: Session-based with dynamic email allowlist
- **Language Support**: English (EN) and Afrikaans (AF)
- **LLM Integration**: Claude, OpenAI, or Grok (configurable)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# LLM Bootstrap (required for natural language Q&A)
LLM_PROVIDER="CLAUDE"  # Options: CLAUDE, OPENAI, GROK
LLM_API_KEY="your-api-key-here"
```

### 3. Set Up Database

```bash
npx prisma migrate dev
```

### 4. Start Development Server

```bash
npm run dev
```

Access at: **http://localhost:3000**

### 5. Login

Use one of the authorized emails:
- ruanvlog@lorenco.co.za
- antonjvr@lorenco.co.za
- mj@lorenco.co.za

## Features

### Chat Interface
- **Natural Language**: Just ask questions - no special prefixes needed
- **Bootstrap Learning**: Unknown answers are fetched from external LLM and cached
- **Teach Mode**: Use `TEACH:` prefix to add knowledge
- **ASK Mode**: Use `ASK:` prefix for explicit knowledge base queries

### Bank Allocations (`/allocations`)
- Import transactions (CSV/paste)
- Sean suggests categories based on learned patterns
- Confirm or correct allocations
- "Teach Sean" - explain corrections for better learning
- View learning statistics

### Knowledge Base (`/knowledge`)
- View all knowledge items (pending/approved/rejected)
- Approve or reject submissions
- Ingest from PDFs or SARS website
- Content preview with expandable details

### Audit Logs (`/admin/audit`)
- Complete action history
- Filter by action type
- Track all user activities

## Key Concepts

### Bootstrap Learning Flow

```
User asks question
       ↓
Check knowledge base (exact match via hash)
       ↓
Check knowledge base (keyword match)
       ↓
If no match: Call external LLM ONCE
       ↓
Store response in KB (auto-approved)
       ↓
Return answer with citation
```

Future identical questions use the cached answer - no repeated API calls.

### Bank Allocation Learning

```
Transaction: "ATM FEE R15.00"
       ↓
Sean suggests: "BANK_CHARGES" (keyword match)
       ↓
User confirms or corrects
       ↓
Pattern learned: "atm fee" → BANK_CHARGES
       ↓
Future "ATM FEE R25.00" auto-suggests correctly
```

The system learns from corrections and builds confidence over time.

### Knowledge Layers

- **LEGAL**: Regulatory rules (SARS, tax tables, laws)
- **FIRM**: Lorenco-specific procedures and policies
- **CLIENT**: Client-specific information

### Knowledge Domains

- VAT (Value Added Tax)
- INCOME_TAX (Personal income tax)
- COMPANY_TAX (Corporate tax)
- PAYROLL (Salaries, PAYE, UIF)
- CAPITAL_GAINS_TAX
- WITHHOLDING_TAX
- ACCOUNTING_GENERAL
- OTHER

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/messages` | POST | Send message (handles teach/ask/natural) |
| `/api/knowledge/submit` | POST | Submit knowledge item |
| `/api/knowledge/list` | GET | List knowledge items |
| `/api/knowledge/approve` | POST | Approve pending item |
| `/api/reason` | POST | Query knowledge base |
| `/api/allocations/suggest` | POST | Get allocation suggestion |
| `/api/allocations/learn` | POST | Learn from correction |
| `/api/allocations/transactions` | GET/POST | Manage transactions |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite database path |
| `LLM_PROVIDER` | No* | CLAUDE, OPENAI, or GROK |
| `LLM_API_KEY` | No* | API key for LLM provider |
| `NEXTAUTH_URL` | No | Base URL for production |

*Required for bootstrap learning (natural language answers)

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

Note: For production, consider migrating from SQLite to PostgreSQL:
```env
DATABASE_URL="postgresql://user:pass@host:5432/seanai"
```

### LAN Testing

To access from phone/tablet on same network:

1. Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Access: `http://YOUR_IP:3000`
3. Ensure Node.js is allowed through firewall

## Roadmap

### Phase 1 (Current)
- [x] Bootstrap learning with external LLM
- [x] Bank allocation module
- [x] Natural language chat
- [x] Dynamic email allowlist

### Phase 2 (Planned)
- [ ] Embeddings for semantic search
- [ ] VAT calculation module
- [ ] Journal entry creation
- [ ] Multi-tenant support

### Phase 3 (Future)
- [ ] Integration with Lorenco Accounting
- [ ] Batch transaction processing
- [ ] Report generation
- [ ] Mobile app

---

**Built for Lorenco** | Sean AI v1.0 - January 2026
