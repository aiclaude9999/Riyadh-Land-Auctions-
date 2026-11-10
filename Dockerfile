# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# ---------- build (web) ----------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# ---------- web ----------
FROM node:22-bookworm-slim AS web
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
EXPOSE 3000
# apply migrations, then start
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]

# ---------- worker (needs Chromium for Playwright connectors) ----------
FROM deps AS worker
WORKDIR /app
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production SERVICE_NAME=worker
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/worker/index.ts"]
