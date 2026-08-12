# 교회 통합 관리 시스템 — 배포용 이미지
#
# 데이터베이스 파일과 업로드된 사진은 모두 /data 안에 모아 둔다.
# 이 폴더 하나만 볼륨으로 붙이고 백업하면 교회의 모든 자료가 보존된다.

# ── 1단계: 빌드 ─────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# 네이티브 모듈(better-sqlite3)에 미리 컴파일된 바이너리가 없을 때를 대비한다.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ── 2단계: 실행 ─────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 데이터베이스와 사진을 한 폴더에 모아 둔다 (볼륨으로 붙일 지점)
ENV DATABASE_URL="file:/data/church.db"
ENV UPLOAD_DIR="/data/uploads"

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force \
    && apt-get purge -y python3 make g++ && apt-get autoremove -y

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY next.config.ts prisma.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /data/uploads

VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
