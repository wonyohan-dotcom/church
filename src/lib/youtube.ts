/**
 * 유튜브 링크 다루기. 화면에 넣는 주소는 반드시 여기서 뽑은 ID 로만 만든다.
 * (임의의 주소를 iframe 에 넣지 않기 위해서)
 */

const VIDEO_ID = /^[\w-]{11}$/;
const LIST_ID = /^[\w-]{10,64}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);

function parse(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

/** 영상 주소에서 영상 ID(11자)를 뽑는다. 유튜브 주소가 아니면 null. */
export function youtubeVideoId(raw: string | null | undefined): string | null {
  const url = parse(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host.endsWith("youtu.be")) {
    id = url.pathname.split("/")[1] ?? null;
  } else {
    id = url.searchParams.get("v");
    if (!id) {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** 재생목록 주소(list=…)에서 재생목록 ID 를 뽑는다. */
export function youtubePlaylistId(raw: string | null | undefined): string | null {
  const id = parse(raw)?.searchParams.get("list") ?? null;
  return id && LIST_ID.test(id) ? id : null;
}

/** 곡 목록과 재생목록 주소로 화면에 넣을 플레이어 주소를 만든다. 없으면 null. */
export function playerUrl(videoUrls: Array<string | null | undefined>, playlistUrl?: string | null): string | null {
  const list = youtubePlaylistId(playlistUrl);
  if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&playsinline=1`;
  const ids = videoUrls.map(youtubeVideoId).filter((v): v is string => !!v);
  if (ids.length === 0) return null;
  const [first, ...rest] = ids;
  const query = new URLSearchParams({ playsinline: "1" });
  if (rest.length > 0) query.set("playlist", rest.join(","));
  return `https://www.youtube-nocookie.com/embed/${first}?${query}`;
}

export type ParsedSong = { title: string; musicKey: string | null; youtubeUrl: string | null };

/**
 * 콘티 입력칸(한 줄에 곡 하나)을 곡 목록으로 바꾼다.
 *   "주님 사랑해요 G https://youtu.be/xxxxxxxxxxx"
 *   "주님 사랑해요 | G | https://youtu.be/xxxxxxxxxxx"
 * 링크는 줄 안 어디에 있어도 되고, 링크가 없는 줄은 제목만 남긴다.
 */
export function parseSongLines(text: string): ParsedSong[] {
  const songs: ParsedSong[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    let youtubeUrl: string | null = null;
    const urlMatch = line.match(/(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/\S+/i);
    if (urlMatch) {
      const candidate = urlMatch[0];
      if (youtubeVideoId(candidate)) youtubeUrl = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
      line = line.replace(candidate, " ");
    }
    let parts = line.split("|").map((p) => p.trim()).filter(Boolean);
    let musicKey: string | null = null;
    // 맨 끝에 붙은 코드 이름(G, Bb, F#m …)은 키로 본다.
    if (parts.length === 1) {
      const m = parts[0].match(/^(.*\S)\s+([A-G][#b]?m?)$/);
      if (m) parts = [m[1], m[2]];
    }
    if (parts.length >= 2 && /^[A-G][#b]?m?$/.test(parts[parts.length - 1])) {
      musicKey = parts[parts.length - 1];
      parts = parts.slice(0, -1);
    }
    const title = parts.join(" ").replace(/\s+/g, " ").trim();
    if (!title) continue;
    songs.push({ title: title.slice(0, 120), musicKey, youtubeUrl });
  }
  return songs.slice(0, 30);
}

/** 곡 목록을 입력칸 글로 되돌린다(고칠 때 채워 넣는 용도). */
export function songsToText(songs: Array<{ title: string; musicKey: string | null; youtubeUrl: string | null }>): string {
  return songs.map((s) => [s.title, s.musicKey, s.youtubeUrl].filter(Boolean).join(" | ")).join("\n");
}
