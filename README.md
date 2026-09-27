# enshu-lifehack-home

遠州ライフハック 親サイト（`https://enshu-lifehack.com/`）。

- 簡易トップ1枚。公開中（磐田ライフハック→ `https://iwata.enshu-lifehack.com/`）＋近日運用予定バナー。
- Cloudflare Workers（Static Assets）。`www.enshu-lifehack.com` は `src/index.js` で apex へ 301。
- 静的ファイルは `public/`。

## デプロイ
```
wrangler deploy        # カスタムドメイン(enshu-lifehack.com / www)もこの設定で自動付与
```

## 市町を公開したら
`public/index.html` の「近日運用予定」から該当市町を「公開中」カードへ移し、リンク先サブドメインを設定して再デプロイ。

運営：富士ヶ丘サービス ／ 代表：大石浩之

## 全体フィード `/feed.xml`（RSS 2.0）
- `public/feed.xml` は **生成物**。手で編集しない。`node scripts/build_feed.mjs` が各市町のブログ記事フィード（各サイトの記事台帳から生成）を集め、新しい順に最大40件を書き出す。
- `wrangler.toml` の `[build]` で deploy のたびに再生成。`.github/workflows/feed.yml` が毎日再生成し、変化があればコミットする。
- ブログを始めた市町は `scripts/build_feed.mjs` の `SOURCES` に1行足す。
