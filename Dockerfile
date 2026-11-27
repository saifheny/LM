# LM Super App — Production Docker Container (Hugging Face Spaces + Render + Self-Hosted)
# Node 24 Alpine with native node:sqlite, non-root UID 1000, port 7860
FROM node:24-alpine

WORKDIR /app

# Install dependencies cleanly first (layer cached across code updates)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source & essential seed media (uploads/seed & uploads/music)
COPY . .

# Build Vite production bundle
RUN npm run build

# Ensure runtime storage directories exist and are writable by Hugging Face non-root UID 1000 (`node` user)
RUN mkdir -p /app/data /app/uploads/seed /app/uploads/music \
 && chown -R 1000:1000 /app \
 && chmod -R 775 /app/data /app/uploads

USER 1000

ENV NODE_ENV=production
ENV PORT=7860
ENV NODE_OPTIONS="--max-old-space-size=192"

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["npm", "start"]
