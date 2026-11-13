import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
const nodes = scripts.flatMap(([, text]) => {
  const value = JSON.parse(text);
  return value['@graph'] ?? [value];
});
const personId = 'https://oishi-hiroyuki.org/#person';
const profileUrl = 'https://oishi-hiroyuki.org/profile';

test('the editor has the canonical Person identity and Profile URL', () => {
  const person = nodes.find(node => node['@type'] === 'Person');
  assert.ok(person);
  assert.equal(person['@id'], personId);
  assert.equal(person.name, '大石浩之');
  assert.equal(person.url, profileUrl);
});

test('website creator references the canonical person', () => {
  const website = nodes.find(node => node['@type'] === 'WebSite');
  assert.ok(website);
  assert.equal(website.url, 'https://enshu-lifehack.com/');
  assert.equal(website.creator['@id'], personId);
});

test('the publisher remains Fujigaoka Service as an Organization', () => {
  const website = nodes.find(node => node['@type'] === 'WebSite');
  const publisher = nodes.find(node => node['@id'] === website.publisher['@id']);
  assert.ok(publisher);
  assert.equal(publisher['@type'], 'Organization');
  assert.equal(publisher.name, '富士ヶ丘サービス株式会社');
  assert.notEqual(publisher['@id'], personId);
});

test('the visible editor links directly to Profile', () => {
  assert.match(html, /編集・運営：<a href="https:\/\/oishi-hiroyuki\.org\/profile"[^>]*>大石浩之<\/a>/);
});

test('canonical URL, official-information notice and consultation link remain', () => {
  assert.match(html, /rel="canonical" href="https:\/\/enshu-lifehack\.com\/"/);
  assert.ok(html.includes('最終的に必ず公式ページへご案内します'));
  assert.ok(html.includes('https://fudosan.atawi.link/?utm_source=enshu_lifehack'));
});
