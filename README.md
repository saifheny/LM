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

## Deploy Free on Hugging Face Spaces (Docker SDK)

1. Create a new **Space** on Hugging Face with **SDK: Docker (Blank)**.
2. Connect this repository (or sync via GitHub Actions using `HF_TOKEN` & `HF_SPACE_ID` secrets).
3. *(Optional)* Add `GEMINI_API_KEY` and `SESSION_SECRET` under **Space Settings → Variables and secrets** to enable LM AI.
