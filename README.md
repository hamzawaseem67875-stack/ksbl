# ShelfWatch — AI-Powered Anti-Counterfeit & Inventory Verification

Pakistan's first crowdsourced, AI-powered platform for verifying FMCG product authenticity — built on Next.js 16, Prisma 7, and Vercel serverless functions.

---

### 🚀 Key Integrations & Recent Updates (Hackathon Demo Build)

1. **Passwordless Database Connectivity (Supabase REST API)**:
   * Replaced Prisma Client direct TCP connections in all route handlers with direct HTTPS queries to **Supabase Postgrest REST API**.
   * Completely eliminates Postgres TLS / PgBouncer / Supavisor connection errors and works out of the box with anonymous keys without needing database passwords.
2. **Gemini 3.1 Flash Lite Migration**:
   * Switched LLM vision engines to `gemini-3.1-flash-lite` to resolve rate limits (`429 Quota Exceeded`) on the free tier.
   * Full multi-modal support for logo analysis, packaging layout checks, and brand spellchecking.
3. **Keyless Product Lookup APIs**:
   * Integrated supplement lookups via **Open Food Facts API** and **UPCitemdb API (Free Trial)** inside the verification pipeline.
4. **Enhanced Scan History & Metadata Persistence**:
   * Added `product_name` and `brand_name` cached columns on the `Scan` table, enabling fallback product naming on the **History page** for external lookup items.
5. **Score-Based Verdict Rules**:
   * Added threshold rules for database writes: Score > 70 sets verdict to `genuine`, Score < 40 sets verdict to `suspicious`, otherwise `unverified`.
6. **Mobile Camera Capture**:
   * Added `capture="environment"` to the hidden file input, enabling native mobile camera capture directly when clicking the scan viewfinder.

---

## Quick Start (Development)

```bash
npm install
cp .env.example .env.local   # fill in your keys
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Backend Setup Guide

### 1 · Database — Neon (Recommended) or Supabase

**Neon (free tier, serverless-native):**
1. Sign up at [neon.tech](https://neon.tech) → Create project `shelfwatch`
2. Copy the **Pooled** connection string → `DATABASE_URL` in `.env.local`
3. Copy the **Direct** connection string → `DIRECT_URL` in `.env.local`
4. In `prisma.config.ts`, the `DATABASE_URL` env var is read automatically

**Supabase alternative:**
- Use the Supabase Postgres connection string with `?pgbouncer=true` for `DATABASE_URL`
- Use the direct connection (port 5432) for `DIRECT_URL`

**Run migrations:**
```bash
npx prisma migrate dev --name init
npx prisma db seed          # seeds brands, products, demo Karachi scan data
```

### 2 · Vercel Blob (Image Storage)

1. In Vercel Dashboard → your project → **Storage** → **Connect Store** → **Blob**
2. The `BLOB_READ_WRITE_TOKEN` env var is automatically added to Vercel
3. For local dev: copy it from Vercel → `.env.local`

### 3 · OCR — Google Cloud Vision

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Cloud Vision API**
3. **APIs & Services → Credentials → Create Credentials → API Key**
4. Restrict the key to Cloud Vision API
5. Add to `.env.local`: `GOOGLE_VISION_API_KEY=AIza...`

**Fallback:** Sign up at [ocr.space](https://ocr.space/ocrapi) for a free key → `OCR_SPACE_API_KEY`

### 4 · Computer Vision — Hugging Face

1. Sign up at [huggingface.co](https://huggingface.co) → Settings → Access Tokens
2. Create a token with **read** scope
3. Add to `.env.local`: `HUGGINGFACE_API_KEY=hf_...`

The system uses `openai/clip-vit-large-patch14` for zero-shot packaging classification by default. Override with `HF_MODEL_ID`.

**Fallback:** Sign up at [replicate.com](https://replicate.com) → `REPLICATE_API_KEY=r8_...`

### 5 · Urdu Verdict Phrasing — Anthropic Claude

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key
3. Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

The verdict Urdu/English text itself is hardcoded (not translated) — Claude only generates the one-sentence reason. The system works without this key (falls back to a default reason string).

### 6 · WhatsApp Cloud API (Webhook)

1. Create a Meta Developer account at [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → Add **WhatsApp** product
3. Go to **WhatsApp → Getting Started**:
   - Copy **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - Generate a **Temporary Access Token** → `WHATSAPP_ACCESS_TOKEN`
4. In **App Settings → Basic** → Copy **App Secret** → `WHATSAPP_APP_SECRET`
5. In **WhatsApp → Configuration → Webhook**:
   - URL: `https://your-app.vercel.app/api/whatsapp-webhook`
   - Verify Token: the string you set in `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to: `messages`

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/scan` | Upload image + barcode, returns verdict |
| `GET` | `/api/dashboard/stats` | Aggregate stats for a brand |
| `GET` | `/api/dashboard/heatmap` | Geo-clustered hotspot data |
| `POST` | `/api/report` | Consumer one-tap suspicious report |
| `GET` | `/api/whatsapp-webhook` | Meta webhook verification |
| `POST` | `/api/whatsapp-webhook` | Incoming WhatsApp message handler |

### POST /api/scan

```bash
curl -X POST http://localhost:3000/api/scan \
  -F "image=@product.jpg" \
  -F "barcode=8901030873874" \
  -F "latitude=24.8608" \
  -F "longitude=67.0104" \
  -F "area_name=Saddar Karachi" \
  -F "scanned_by_role=shopkeeper"
```

Response:
```json
{
  "scan_id": "clxyz123",
  "verdict": "genuine",
  "confidence": 0.91,
  "reason": "Batch SEFM-221-KHI matches manufacturer records.",
  "urdu_text": "✅ اصل مصنوع — یہ مصنوع معتبر ہے",
  "english_text": "✅ Genuine Product — This product has been verified as authentic",
  "extracted_batch": "SEFM-221-KHI",
  "brand_name": "Unilever Pakistan",
  "product_name": "Surf Excel Matic Front Load 1kg"
}
```

---

## Deploy to Vercel

```bash
# Push to GitHub, then connect in Vercel dashboard
# Add all env vars from .env.example in Vercel → Project → Settings → Environment Variables
# Vercel auto-builds on push — no Docker required
```

---

## Database Scripts

```bash
npm run db:generate   # regenerate Prisma client after schema changes
npm run db:migrate    # run migrations
npm run db:seed       # seed demo data (brands + products + Karachi scans)
npm run db:studio     # open Prisma Studio GUI
```

---

## Architecture

```
Browser / PWA
    │
    ▼
Next.js App Router (Vercel Edge / Serverless)
    │
    ├── /api/scan ──────────────────────────────────────────────────────┐
    │       │                                                           │
    │       ▼                                                           │
    │   lib/verifyProduct.ts (shared pipeline)                         │
    │       ├── Vercel Blob (image upload)                             │
    │       ├── lib/ocr.ts → Google Cloud Vision API                   │
    │       ├── lib/cv.ts  → Hugging Face Inference API                │
    │       ├── Prisma → Neon/Supabase Postgres (lookup + write)       │
    │       └── lib/translate.ts → Anthropic Claude (reason)          │
    │                                                                   │
    ├── /api/dashboard/stats ─────────────────────────────────────────┤
    ├── /api/dashboard/heatmap ───────────────────────────────────────┤
    ├── /api/report ──────────────────────────────────────────────────┤
    └── /api/whatsapp-webhook ──────────────────────────────────────── same pipeline ┘
```
