#!/bin/sh
set -e

# APP_SECRET이 없으면 로그인도 주민등록번호 암호화도 동작하지 않는다.
# 서버가 이상하게 뜨는 대신 이유를 분명히 알리고 멈춘다.
if [ -z "$APP_SECRET" ] || [ ${#APP_SECRET} -lt 16 ]; then
  echo "──────────────────────────────────────────────"
  echo " APP_SECRET 환경변수를 설정해 주세요."
  echo ""
  echo " 32자 이상의 임의 문자열이 필요합니다. 이렇게 만들면 됩니다:"
  echo "   openssl rand -hex 32"
  echo ""
  echo " 이 값은 로그인 세션 서명과 주민등록번호 암호화에 함께 쓰입니다."
  echo " 한번 정하면 바꾸지 마시고 안전한 곳에 보관해 주세요."
  echo "──────────────────────────────────────────────"
  exit 1
fi

mkdir -p "${UPLOAD_DIR:-/data/uploads}"

# 새 버전에 스키마 변경이 있으면 여기서 반영된다. 이미 최신이면 아무 일도 하지 않는다.
echo "데이터베이스를 확인합니다…"
npx prisma migrate deploy

echo "서버를 시작합니다."
exec npx next start --port "${PORT:-3000}" --hostname "${HOSTNAME:-0.0.0.0}"
