import { isNativeApp } from "@/lib/native-app";

/** 체험용 교회로 들어왔을 때 화면 맨 위에 띄우는 안내 */
export async function DemoBanner() {
  const native = await isNativeApp();
  return (
    <div data-demo-banner className="no-print border-b border-line bg-accent-soft px-4 py-2 text-center text-[0.8rem] text-ink-2">
      <b className="text-accent">체험용 교회</b>입니다. 예시 자료이며 매일 새벽 원래대로 돌아갑니다.{" "}
      {!native && (
        <form action="/api/logout?next=register" method="post" className="inline">
          <button type="submit" className="font-semibold text-primary underline">
            우리 교회 등록하기
          </button>
        </form>
      )}
    </div>
  );
}
