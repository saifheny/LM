# LM — Integrated Super App Platform (Open-Source Prototype Edition)

**LM** is an open-source, locally runnable Super App prototype designed in Egypt for global expansion. It unifies Social Networking, Short Vertical Videos, Live Streaming with VIP Highlighted Comments Priority Queue, Realtime Encrypted-Style Messaging & Calls, a Privacy-First Multi-Provider AI Assistant (`LM AI`), Modular VIP / Ranks / Geo-Residency Pricing, and a Sandbox Finance & Market Analytics Hub — all under **one unified account and bespoke flagship interface**.

## Core Capabilities Included

- **Unified Identity & Multi-Language (AR RTL / EN LTR):** Sign up, sign in, sign out, or instant-switch between VIP 1 Emperor, VIP 3 Creator, VIP 2 Analyst, VIP 5, and Free demo accounts.
- **Social Feed & Profiles:** Posts, local image uploads, likes, comments, creator profiles, clear separation between **Platform Ads** (removable) and **Sponsored User Campaigns** (`محتوى ممول`), plus one-click explicit `LM AI` summarization.
- **Short Videos (Vertical Reels):** Smooth vertical theater with keyboard/button navigation, local `.mp4`/`.webm` video uploads, likes, saves, and paid promotion campaigns.
- **Live Streaming + VIP Highlighted Comments Engine:**
  - Server-side priority queue: **VIP 1 (15s, #1) > VIP 2 (10s, #2) > VIP 3 (5s, #3)**, FIFO within same tier, cooldown enforcement, pre-display content moderation filter, host controls, local WebRTC camera preview, and virtual gifts with **75% Creator / 25% LM** revenue split.
- **Messaging & Calls:** 1-on-1 & Group/Community realtime WebSocket chat, voice note recording, file/image sharing, WebRTC voice/video call preview, and explicit `@LM AI` message-sharing consent bar.
- **Multi-Provider LM AI + Security Firewall:** Plug in API keys for **Google Gemini (`@google/genai`), OpenAI, Anthropic Claude, OpenRouter, Groq, or local Ollama** — backed by a zero-key local fallback engine and server-enforced **Privacy & Financial Isolation Firewall** with live audit logs.
- **VIP 1–5, Priority Tier, Ranks & Geo-Pricing:** Live interior theme switching (`Obsidian`, `Alabaster`, `Royal Gold`, `Emerald Reserve`, `Imperial Onyx`), custom app icon & name, Supreme Titles (`الملك / الرئيس / الإمبراطور`), modular ad-removal toggles (205 EGP), and the **3+1 month residency currency switch & 2-month travel exemption simulator**.
- **Finance & Market Analytics (Sandbox Design Preview):** Interactive Japanese candlestick charts powered by **TradingView Lightweight Charts (Apache 2.0)**, Double-Entry Demo Ledger, and LM 52% Private Equity governance showcase (zero real money/Visa/bank processing in prototype mode).

## Run Locally (100% Free — $0)

```bash
npm install
npm run build
npm start
```

Then open **`http://localhost:4000`** (or run `npm run dev` for hot-reload development on `http://localhost:5173`).

## License

MIT License — see [LICENSE](./LICENSE). All third-party open-source dependencies retain their respective licenses (MIT / Apache 2.0).
