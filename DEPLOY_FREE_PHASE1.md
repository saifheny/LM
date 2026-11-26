# دليل إطلاق المرحلة الأولى مجانًا بالكامل (0 جنيه / 0 دولار) — LM

هذا الدليل مخصص لإطلاق **LM** للتجربة مع ~10 أصدقاء بأمان كامل وتكلفة **صفر جنيه وصفر دولار** باستخدام الحماية المدمجة في الباك إند (`Scrypt Password Hashing` + `Signed Session Tokens` + `Rate Limiting` + `Magic-Byte Upload Security` + `SQLite WAL`).

---

## الخيار الأسرع (30 ثانية): رابط HTTPS عام مجاني من جهازك عبر Cloudflare Quick Tunnel
مناسب جدًا لتجربة 10 أصدقاء من موبايلاتهم مباشرة (يدعم **HTTPS + WebSockets + المكالمات الصوتية WebRTC + البث المباشر** مجانًا بدون حساب وبدون بطاقة بنكية):

1. ثبّت أداة Cloudflare المجانية مرة واحدة فقط في PowerShell:
   ```powershell
   winget install --id Cloudflare.cloudflared -e
   ```
2. من داخل مجلد المشروع شغّل:
   ```powershell
   npm run build
   npm run share
   ```
3. سيظهر لك رابط عام مجاني بالشكل:
   `https://xxxx-xxxx.trycloudflare.com`
4. أرسل الرابط لأصدقائك ليفتحوا **LM** ويسجلوا حساباتهم فورًا (ويمكنهم تثبيته كتطبيق PWA على شاشة الموبايل!).

---

## الخيار الثاني (تشغيل سحابي مجاني 24/7 بدون إبقاء جهازك مفتوحًا): Render / Koyeb / Oracle Free Tier

المشروع جاهز بالكامل بملفات `Dockerfile` و `render.yaml`:

### أ) Render Free Tier (0 دولار — بدون بطاقة بنكية)
1. ارفع المشروع على مستودع GitHub خاص (`Private Repo`) — ملف `data/providers.json` مستثنى تلقائيًا في `.gitignore` لحماية مفاتيحك.
2. افتح [render.com](https://render.com) -> **New +** -> **Blueprint** -> اختر مستودعك.
3. سيقرأ ملف `render.yaml` تلقائيًا، فقط أضف مفتاح `GEMINI_API_KEY` داخل Environment Variables ثم اضغط **Apply**.
> **ملاحظة**: الباقة المجانية في Render تنام بعد 15 دقيقة من عدم الاستخدام وتستيقظ تلقائيًا خلال ~30 ثانية عند أول زيارة، وقرصها مؤقت عند إعادة النشر.

### ب) Oracle Cloud Always Free VM (0 دولار مدى الحياة — أفضل أداء 24/7)
- يمنحك خادم Linux دائم 24/7 مع **قرص تخزين ثابت** يحفظ قاعدة البيانات `data/lm.db` والملفات المرفوعة `uploads/` للأبد:
  ```bash
  docker build -t lm-super-app .
  docker run -d --name lm --restart unless-stopped \
    -p 4000:4000 \
    -e SESSION_SECRET="your-random-secret" \
    -e GEMINI_API_KEY="your-gemini-key" \
    -v $(pwd)/data:/app/data \
    -v $(pwd)/uploads:/app/uploads \
    lm-super-app
  ```

---

## ماذا تم تفعيله تلقائيًا في الباك إند للمرحلة الأولى؟
- **تشفير كلمات المرور (`Scrypt + Random Salt`)**: لا تُحفظ أي كلمة مرور جديدة كنص عادي، وتُرقّى الحسابات القديمة تلقائيًا عند تسجيل الدخول.
- **توثيق الجلسات (`Signed HMAC-SHA256 Token + HttpOnly Cookie`)**: جلسات آمنة عبر `/api/auth/login`, `/api/auth/register`, `/api/auth/me`.
- **حماية ضد الإغراق (`Rate Limiting`)**: حماية تسجيل الدخول والرفع والبلاغات والـ AI بدون الحاجة لـ Redis.
- **حماية الملفات (`Binary Magic-Byte Verification`)**: منع ملفات `SVG / HTML / JS / EXE` الضارة وضبط الأحجام.
- **إغلاق آمن لقاعدة البيانات (`SQLite WAL Checkpoint`)**: عند إيقاف أو إعادة تشغيل الخادم دون فقدان أي رسالة.
