# 심플한교회관리 — 배포용 이미지
#
# 데이터베이스 파일과 업로드된 사진은 모두 /data 안에 모아 둔다.
# 이 폴더 하나만 볼륨으로 붙이고 백업하면 교회의 모든 자료가 보존된다.

# 사내망이나 미러 레지스트리를 쓰는 경우 베이스 이미지를 바꿀 수 있게 열어 둔다.
#   docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-slim .
ARG NODE_IMAGE=node:22-slim

# ── 1단계: 빌드 ─────────────────────────────
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# better-sqlite3 는 리눅스용으로 미리 컴파일된 바이너리를 제공하므로
# 컴파일 도구(python3/make/g++)를 따로 깔지 않아도 된다.
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# 실행에 필요 없는 개발용 패키지를 걷어낸다.
# 설치는 여기서 한 번만 하고, 실행 단계는 그 결과를 그대로 가져다 쓴다.
RUN npm prune --omit=dev && npm cache clean --force

# ── 2단계: 실행 ─────────────────────────────
FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 데이터베이스와 사진을 한 폴더에 모아 둔다 (볼륨으로 붙일 지점)
ENV DATABASE_URL="file:/data/church.db"
ENV UPLOAD_DIR="/data/uploads"

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY package.json next.config.ts prisma.config.ts docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /data/uploads

VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
