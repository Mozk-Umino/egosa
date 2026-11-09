// えごさ検索中継 (Cloudflare Worker)
//
// 役割: Brave Search API の鍵をサーバー側に隠したまま、
// えごさ本体 (GitHub Pages) から検索できるようにする。
//
// 設置:
// 1. Cloudflare の Workers で新規 Worker を作り、このコードを貼る
// 2. Worker の環境変数 (Settings > Variables and Secrets) に
//    BRAVE_API_KEY = Brave Search API の Subscription Token を Secret で登録する
// 3. デプロイして発行された URL (https://....workers.dev) を
//    えごさ本体の「設定 > 検索の中継URL」に入れる
//
// 無料クレジットの範囲で使う前提。結果は1時間キャッシュして消費を抑える。
// Brave の帰属表示: えごさ本体のフッターに明記済み (無料クレジットの条件)。

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname !== "/search") {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
    }
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return new Response(JSON.stringify({ results: [] }), { headers: cors });
    if (!env.BRAVE_API_KEY) {
      return new Response(JSON.stringify({ error: "BRAVE_API_KEY is not set" }), { status: 500, headers: cors });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const api = "https://api.search.brave.com/res/v1/web/search?q=" +
      encodeURIComponent(q) + "&search_lang=en&country=US&count=10";
    const r = await fetch(api, { headers: { "X-Subscription-Token": env.BRAVE_API_KEY, "Accept": "application/json" } });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "brave api " + r.status }), { status: 502, headers: cors });
    }
    const j = await r.json();
    const results = ((j.web && j.web.results) || []).map(x => ({
      title: x.title || "",
      url: x.url || "",
      description: (x.description || "").replace(/<[^>]+>/g, ""),
    }));
    const res = new Response(JSON.stringify({ results }), {
      headers: { ...cors, "Cache-Control": "public, max-age=3600" },
    });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
