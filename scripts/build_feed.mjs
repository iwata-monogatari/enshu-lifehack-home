// 遠州ライフハック 全体フィード public/feed.xml（RSS 2.0）を生成する。手で編集しない。
//
// 元データ: 各市町サイトのブログ記事フィード。各フィードはそのサイトの記事台帳
// （data/blog-posts.json）からビルド時に自動生成されているので、ここでも台帳由来の
// 記事（読み物）だけが集まる。自動生成の案内ページ・データ登録ページは含まれない。
//
// 実行: node scripts/build_feed.mjs
//   - wrangler.toml の [build] から deploy のたびに自動で走る
//   - .github/workflows/feed.yml が毎日走らせ、変化があればコミットする
// 取得に失敗した市町は、既存の public/feed.xml に載っている同じ市町の記事で補う（配信を空にしない）。
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "public", "feed.xml");
const SITE = "https://enshu-lifehack.com";
const MAX_ITEMS = 40;

// ブログ（読み物）を持つ市町。記事を公開した市町はここへ1行足す。
const SOURCES = [
  { name: "磐田ライフハック", origin: "https://iwata.enshu-lifehack.com", feed: "https://iwata.enshu-lifehack.com/blog/feed.xml" },
  { name: "森町ライフハック", origin: "https://morimachi.enshu-lifehack.com", feed: "https://morimachi.enshu-lifehack.com/feed.xml" },
];

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};

// 概要は100〜160字。160字を超える場合は160字以内の最後の「。」で切り、無ければ159字＋「…」。
function summarize(text) {
  const t = text.replace(/\s+/g, " ").trim();
  const chars = [...t];
  if (chars.length <= 160) return t;
  const head = chars.slice(0, 160).join("");
  const cut = head.lastIndexOf("。");
  if (cut >= 0 && [...head.slice(0, cut + 1)].length >= 100) return head.slice(0, cut + 1);
  return chars.slice(0, 159).join("") + "…";
}

function parseFeed(xml) {
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const body = m[2];
    let link = tag(body, "link");
    if (!link) {
      const l = body.match(/<link\b[^>]*href="([^"]+)"/);
      link = l ? decode(l[1]) : "";
    }
    const date = tag(body, "pubDate") || tag(body, "published") || tag(body, "updated");
    const description = tag(body, "description") || tag(body, "summary");
    items.push({ title: tag(body, "title"), link, date: new Date(date), description });
  }
  return items;
}

// 読み物（ブログ記事）の正式URLだけを通す。
const isArticle = (src, it) =>
  it.link.startsWith(src.origin + "/blog/") && it.link !== src.origin + "/blog/" && it.title && !isNaN(it.date);

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "enshu-lifehack-feed-builder/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  let previous = [];
  try { previous = parseFeed(await readFile(OUT, "utf8")); } catch { /* 初回 */ }

  const all = [];
  let okCount = 0;
  for (const src of SOURCES) {
    let items;
    try {
      items = parseFeed(await fetchText(src.feed)).filter((it) => isArticle(src, it));
      if (!items.length) throw new Error("記事0件");
      okCount++;
      console.log(`${src.name}: ${items.length}件`);
    } catch (e) {
      items = previous.filter((it) => isArticle(src, it));
      console.warn(`${src.name}: 取得失敗（${e.message}）→ 既存feed.xmlの${items.length}件で補う`);
    }
    all.push(...items);
  }
  if (!okCount && previous.length) {
    console.warn("全市町の取得に失敗。public/feed.xml は変更しません。");
    return;
  }

  const seen = new Set();
  const items = all
    .filter((it) => (seen.has(it.link) ? false : seen.add(it.link)))
    .sort((a, b) => b.date - a.date || (a.link < b.link ? 1 : -1))
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new Error("フィードに載せる記事が0件です");

  const itemXml = items.map((it) =>
    `<item><title>${esc(it.title)}</title><link>${esc(it.link)}</link>` +
    `<guid isPermaLink="true">${esc(it.link)}</guid><pubDate>${it.date.toUTCString()}</pubDate>` +
    `<description>${esc(summarize(it.description || it.title))}</description></item>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>遠州ライフハック 新着記事</title>
<link>${SITE}/</link>
<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
<description>遠州エリア（静岡県西部）の各市町ライフハックに掲載した、暮らし・手続き・住まいの解説記事の新着です。</description>
<language>ja</language>
<lastBuildDate>${items[0].date.toUTCString()}</lastBuildDate>
${itemXml}
</channel>
</rss>
`;
  await writeFile(OUT, xml, "utf8");
  console.log(`public/feed.xml: ${items.length}件`);
}

main().catch((e) => { console.error(e); process.exit(1); });
