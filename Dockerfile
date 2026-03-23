# ---- 1단계: 의존성 설치 ----
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---- 2단계: 빌드 ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시점에는 API 키 불필요 (런타임에만 사용)
ENV NEXT_TELEMETRY_DISABLED=1
# Docker 빌드 전용으로 standalone 모드 활성화
ENV NEXT_OUTPUT=standalone

RUN NEXT_OUTPUT=standalone npm run build

# ---- 3단계: 실행 (최소 이미지) ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 보안: root가 아닌 전용 유저로 실행
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js 빌드 결과물만 복사
COPY --from=builder /app/public         ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
