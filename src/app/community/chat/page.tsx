import { requireCommunityUser } from "@/lib/community";
import { ChatRoom } from "./chat-room";

export const metadata = { title: "전체 채팅" };

export default async function ChatPage() {
  await requireCommunityUser();
  return (
    <>
      <p className="mb-3 text-center text-xs text-ink-3">
        우리 교회 모든 성도가 함께 쓰는 대화방입니다. 말풍선을 누르면 삭제·신고·차단 메뉴가 나옵니다.
      </p>
      <ChatRoom />
    </>
  );
}
