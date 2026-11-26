# LM Super App — Phase 1 Zero-Cost Production Container (Node 24 + native node:sqlite)
FROM node:24-alpine

WORKDIR /app

# Install production + build deps cleanly
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source
COPY . .

# Build frontend production bundle (Vite)
RUN npm run build

# Ensure runtime storage directories exist
RUN mkdir -p /app/data /app/uploads

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["npm", "start"]
