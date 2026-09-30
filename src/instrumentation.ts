/**
 * 서버가 뜰 때 한 번 실행된다.
 *
 * Vercel 서버는 세계 표준시(UTC)로 돈다. 그대로 두면 한국 시간 밤 12시~오전 9시
 * 사이에 "오늘" 이 어제로 잡히고, 월·연 합계의 경계도 9시간 어긋난다.
 * Vercel 은 TZ 환경변수를 직접 설정하지 못하게 막아 두었으므로 여기서 맞춘다.
 *
 * 이전에 UTC 자정으로 저장된 날짜는 한국 시간으로 같은 날 오전 9시가 되므로
 * 날짜가 바뀌지 않는다.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.APP_TIME_ZONE || "Asia/Seoul";
  }
}
