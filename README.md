# LM — Integrated Super App Platform (V2 Open-Source UI Edition)

**LM** is an open-source, locally runnable Super App designed in Egypt for global expansion — built with frameless edge-to-edge native app architecture (zero admin dashboard bars!) combining the best open-source design & engineering systems in each domain:

## Open-Source Engines & UI Systems Integrated

- **Frameless Super App Dock:** Telegram Desktop / WeChat-style `72px` edge dock (no top header bar; 100% full-viewport immersion per section).
- **Messaging & Calls (`ChatView.tsx`):** Modeled directly on **Telegram Web A (`Ajaxy/telegram-tt`)** & **Tinode (`tinode/webapp`)** — folder tabs (`الكل | شخصي | المجموعات | القنوات`), subtle Telegram doodle SVG wallpaper, asymmetric speech bubbles with inline `✓✓` read ticks, quote-replies, floating emoji reactions (`❤️ 🔥 👍 😂`), real interactive voice note waveforms via **`wavesurfer.js`**, emoji picker via **`emoji-picker-react`**, shared media drawer, WebRTC calls, and explicit `@LM AI` message-sharing consent.
- **Short Videos (`ShortVideosView.tsx`):** Modeled directly on **Loops (`joinloops/loops-expo`)** & **TikTok** — pitch-black full-height vertical theater powered by **`swiper`**, real local 720p HD `.mp4` videos, floating transparent `أتابعه | لك` tabs, double-tap `#FE2C55` heart bursts, spinning vinyl audio disc, scrubbable hairline progress bar, and slide-over TikTok comments drawer.
- **Social & Stories (`SocialView.tsx`):** **Instagram / Pixelfed** full-screen Stories viewer with gradient rings, multi-photo `Swiper` carousels, double-tap heart burst, and Sponsored vs Platform Ad separation.
- **Live Streaming (`LiveView.tsx`):** **TikTok Live** full-bleed video stage + local WebRTC camera broadcast + server-enforced **VIP Highlighted Comments Priority Queue** (`VIP 1 = 15s > VIP 2 = 10s > VIP 3 = 5s`, FIFO, cooldown, moderation) + animated gifts with **`canvas-confetti`** & `75% Creator / 25% LM` split.
- **LM AI Studio (`AiView.tsx`):** **LobeChat / LibreChat** borderless prompt workspace with collapsible agents sidebar, **`react-markdown` + `remark-gfm`**, multi-provider gateway (**Google `@google/genai`, OpenAI, Anthropic, OpenRouter, Groq, Ollama**), and server-side Financial & Privacy Firewall.
- **Finance & Markets (`FinanceView.tsx`):** Sandbox preview with interactive Japanese candlesticks via **TradingView `lightweight-charts`** (Apache 2.0) and Double-Entry Demo Ledger.

## Run Locally ($0 Cost)

```bash
npm install
npm run build
npm start
```

Open **`http://localhost:4000`** (or double-click `START-LM.bat`).
