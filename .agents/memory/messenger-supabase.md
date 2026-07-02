---
name: Messenger Supabase setup
description: Architecture decisions and quirks for the Messenger app that uses Supabase directly from the browser
---

## Architecture
- All data goes through Supabase JS client directly from the browser — no Express API routes involved
- Env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (VITE_ prefix required for Vite browser exposure)
- Media uploads go to Catbox (primary) / Litterbox (72h fallback) — not Supabase Storage
- Supabase tables: `usuarios` (users) and `mensajes` (messages); RLS policies allow full anon access

## use-toast.ts quirk
ToasterToast type must include `open?: boolean` and `onOpenChange?: (open: boolean) => void` — the toast() function dispatches these fields but the scaffold type originally omitted them (causes TS2353).

## Auto-delete logic
Both sender and receiver attempt `supabase.from('mensajes').delete()` when expires_at passes — idempotent, whichever client is online wins. Original code only deleted when current user was sender, causing messages to persist when sender was offline.

**Why:** Supabase free plan has no cron/edge-function scheduling for guaranteed server-side cleanup. Client-side both-sides deletion is the pragmatic workaround.

## SQL setup required in Supabase Dashboard
User must run tables.sql manually in Supabase SQL Editor before first use. Tables need REPLICA IDENTITY FULL and RLS policies for Realtime to work.
