---
title: LM
emoji: 🌐
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# LM — Unified Social, Pulse, Live, Chat & AI Platform

**LM** is an integrated real-time web & PWA super app built with **React 19, Vite 6, Tailwind CSS v4, Three.js WebGL, Express, WebSockets, WebRTC, and native Node 24 SQLite**.

## Core Features

- **Interactive 3D Earth Landing Page:** GPU-accelerated Three.js WebGL dotted planet powered by Natural Earth 1:110m geography (`world-atlas`), quick 3-word registration, and instant neutral guest mode.
- **Community Feed:** Stories, multi-photo posts, polls, licensed background music tracks, horizontally swipeable expressive reactions, reposts & quote reposts, threaded comments with voice notes, inline translation, and proportional anti-brigading reporting.
- **Pulse Short Videos:** Full-screen vertical swipe feed, long-press `2x` speed, voice & AI comments, unique per-user share & like accounting, and mobile-optimized adaptive HUD.
- **Live Broadcasts:** Portrait (`9:16`) and rounded Landscape (`16:9`) rooms, WebRTC live camera streaming, full-screen floating TikTok-style Go Live studio, real-time scrollable chat, and tap-to-like energy gauge.
- **Real-Time Chat & Voice Calls:** Direct messages, groups & communities, circular video notes, instant voice notes with AI transcription, 1-on-1 & room WebRTC voice calls, and `@LM AI` assistant.
- **LM AI Multi-Provider Hub:** Supports Google Gemini, OpenAI, Anthropic, DeepSeek, Groq, OpenRouter, Ollama, and more via `GEMINI_API_KEY` env secret or the in-app **API Hub**.

## Run Locally

```bash
npm install
npm run build
npm start
```

Open `http://localhost:4000`.

## 100% Free Multi-Service Cloud Stack ($0 Forever, ZERO Credit Card!)

LM automatically combines multiple free no-card cloud tiers to maximize storage and keep your data permanent across container restarts:

1. **App Container (Server + WebSockets):** **Back4App Containers** (Free 256 MB RAM / 100 GB bandwidth, no credit card) or **SnapDeploy** (Free 512 MB RAM, no credit card) — deploy directly from `saifheny/LM` using `Dockerfile`.
2. **Permanent Cloud Database Sync + 1 GB Media Failover:** **Supabase** (Free, no credit card) — add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in container environment variables. LM automatically restores & syncs compressed SQLite snapshots to a private `lm-state` bucket so users, bound devices, posts, and chats survive every restart!
3. **25 GB/month Cloud Media CDN (Photos, Videos, Voice Notes):** **Cloudinary** (Free, no credit card) — add `CLOUDINARY_URL` in container environment variables so all user uploads go directly to Cloudinary CDN instead of filling container disk.
4. **AI Assistant (Optional):** Add `GEMINI_API_KEY` in environment variables for LM AI & voice transcription.

Verify live cloud integration anytime at `GET /api/health` (`cloud.dbPersistence` & `cloud.mediaProvider`).
