import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSongLines, playerUrl, songsToText, youtubePlaylistId, youtubeVideoId } from "./youtube";

describe("youtubeVideoId", () => {
  it("여러 모양의 주소에서 ID를 뽑는다", () => {
    assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"), "dQw4w9WgXcQ");
    assert.equal(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ");
    assert.equal(youtubeVideoId("youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(youtubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  });
  it("유튜브가 아니면 null", () => {
    assert.equal(youtubeVideoId("https://evil.example.com/watch?v=dQw4w9WgXcQ"), null);
    assert.equal(youtubeVideoId("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"), null);
    assert.equal(youtubeVideoId("javascript:alert(1)"), null);
    assert.equal(youtubeVideoId("https://youtu.be/short"), null);
    assert.equal(youtubeVideoId(""), null);
  });
});

describe("playerUrl", () => {
  it("재생목록 주소가 있으면 그것을 쓴다", () => {
    const url = playerUrl([], "https://www.youtube.com/playlist?list=PLabcdefghijk123");
    assert.ok(url!.includes("videoseries?list=PLabcdefghijk123"));
  });
  it("곡 링크들을 이어서 재생하는 주소를 만든다", () => {
    const url = playerUrl(["https://youtu.be/aaaaaaaaaaa", null, "https://youtu.be/bbbbbbbbbbb", "https://youtu.be/ccccccccccc"]);
    assert.ok(url!.includes("/embed/aaaaaaaaaaa"));
    assert.ok(url!.includes("playlist=bbbbbbbbbbb%2Cccccccccccc"));
  });
  it("링크가 하나도 없으면 null", () => {
    assert.equal(playerUrl([null, "https://example.com"]), null);
  });
  it("재생목록 ID", () => {
    assert.equal(youtubePlaylistId("https://youtube.com/watch?v=aaaaaaaaaaa&list=PLabcdefghijk123"), "PLabcdefghijk123");
    assert.equal(youtubePlaylistId("https://youtu.be/aaaaaaaaaaa"), null);
  });
});

describe("parseSongLines", () => {
  it("제목 · 키 · 링크를 나눈다", () => {
    const songs = parseSongLines(
      [
        "주님 사랑해요 G https://youtu.be/aaaaaaaaaaa",
        "",
        "나의 마음 | Bb | https://www.youtube.com/watch?v=bbbbbbbbbbb",
        "https://youtu.be/ccccccccccc 은혜 아니면",
        "링크 없는 곡",
      ].join("\n"),
    );
    assert.deepEqual(songs, [
      { title: "주님 사랑해요", musicKey: "G", youtubeUrl: "https://youtu.be/aaaaaaaaaaa" },
      { title: "나의 마음", musicKey: "Bb", youtubeUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb" },
      { title: "은혜 아니면", musicKey: null, youtubeUrl: "https://youtu.be/ccccccccccc" },
      { title: "링크 없는 곡", musicKey: null, youtubeUrl: null },
    ]);
  });
  it("되돌려도 같은 곡이 된다", () => {
    const songs = parseSongLines("주님 사랑해요 | G | https://youtu.be/aaaaaaaaaaa");
    assert.deepEqual(parseSongLines(songsToText(songs)), songs);
  });
  it("유튜브가 아닌 링크는 붙이지 않는다", () => {
    assert.equal(parseSongLines("곡 https://example.com/x")[0].youtubeUrl, null);
  });
});
