# えごさ ― えいごをさわる

日本語で探して、英語の記事を読むための小さなWebアプリです。
GitHub Pages で公開する静的アプリで、ログインはありません。設定と「貯まったふりがな」は端末の中（localStorage）にだけ保存されます。

公開URL: https://mozk-umino.github.io/egosa/

## できること（v0.2）

- 日本語で入力すると英語に直して、英語のページだけを検索する
  - 検索の中継（下記）を設定すると結果がアプリ内に出る。未設定のときは外部の英語検索（Brave / DuckDuckGo）を開く
- 記事のURLを開くと、本文だけを取り出してアプリ内で表示する（Jina Reader 経由）
- 単語をタップすると画面下に日本語訳が出る
- 句やイディオム（点線の下線）は、ひとかたまりで意味が出る
- 文の単語でない所をタップすると、文全体の訳が出る。範囲を選んで翻訳もできる
- 「ふりがなに貯める」を押した単語や句は、その上に訳がルビ表示されるようになり、端末に貯まっていく

## ページ

- `about.html` … 設計思想（なぜこれで英語に触れられると思ったか）と基本的な使い方
- `skill.html` … えごさSkill（AIへの指示書）の解説と導入手順。本体トップからリンクしている
- `skill/` … 配布用のSkill一式（SKILL.md と template.html）

## 検索の中継（Worker）の設置

Brave Search API の鍵をブラウザに置けないため、小さい中継を Cloudflare Workers に置きます。

1. Brave Search API に登録して Subscription Token を取る（無料クレジット 月約1,000回分。登録時にカード確認あり）
2. Cloudflare Workers で新規 Worker を作り、`worker/brave-relay.js` の中身を貼る
3. Worker の環境変数に `BRAVE_API_KEY`（Secret）= Token を登録してデプロイ
4. 発行された `https://....workers.dev` のURLを、えごさ本体の「設定 > 検索の中継URL」に保存する

中継は検索結果を1時間キャッシュします。Brave の帰属表示は本体フッターにあります。

## 構成

- `index.html` … 本体（これ1枚で動く）
- `about.html` / `skill.html` … 解説ページ
- `skill/` … えごさSkillの配布一式
- `manifest.json` / `sw.js` … ホーム画面に追加して使うための PWA 設定
- `worker/brave-relay.js` … 検索中継のコード（Pages にはデプロイされない、Cloudflare 用）

## 由来

「えごさ」は「えいごをさわる」の略です。
