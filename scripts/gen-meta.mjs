#!/usr/bin/env node
// gen-meta.mjs — 生成 meta.json（零依赖，供 CI 与本地共用）
// 契约来源：my-homepage/docs/architecture/40-implementation-contract.md §2 / §3.3
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'meta.json');

const SITE = {
  title: 'K-BLACK',
  base: 'https://k-black.top/',
  description: 'K-Black 个人主页',
};

/* ---------- 极简 YAML front matter 解析（只覆盖本仓库用到的子集） ---------- */
function splitFrontMatter(text) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) throw new Error('front matter must start with ---');
  const end = src.indexOf('\n---', 3);
  if (end < 0) throw new Error('unterminated front matter');
  const head = src.slice(4, end + 1);
  const rest = src.slice(end + 4).replace(/^\n/, '');
  return { head, body: rest };
}

function unquote(v) {
  const s = v.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return s.slice(1, -1).replace(/\\"/g, '"');
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

function parseInlineArray(v) {
  const inner = v.trim().slice(1, -1).trim();
  if (!inner) return [];
  const out = [];
  let cur = '';
  let q = null;
  for (const ch of inner) {
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ',') { out.push(unquote(cur)); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(unquote(cur));
  return out;
}

function parseScalar(v) {
  const s = v.trim();
  if (s === '' ) return '';
  if (s.startsWith('[') && s.endsWith(']')) return parseInlineArray(s);
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^(null|~)$/.test(s)) return null;
  if (/^\|[-+]?$|^>[-+]?$/.test(s)) throw new Error('block scalar not supported: ' + s);
  return unquote(s);
}

function parseFrontMatter(text) {
  const { head, body } = splitFrontMatter(text);
  const data = {};
  const lines = head.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][\w-]*):(?:[ \t]*(.*))?$/);
    if (!m) throw new Error('unsupported front matter line: ' + line);
    const key = m[1];
    const rest = (m[2] ?? '').trim();
    if (rest === '') {
      const items = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const item = lines[j].match(/^[ \t]*-[ \t]*(.*)$/);
        if (!item) break;
        items.push(unquote(item[1]));
      }
      if (items.length) { data[key] = items; i = j - 1; continue; }
      data[key] = '';
      continue;
    }
    data[key] = parseScalar(rest);
  }
  return { data, body };
}

/* ---------- 统计 ---------- */
function countWords(md) {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/[>*_~|-]/g, ' ');
  const cjk = (text.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g) || []).length;
  const latin = (text.match(/[A-Za-z0-9][A-Za-z0-9'\u2019._-]*/g) || []).length;
  return cjk + latin;
}

const readingMinutes = (words) => Math.max(1, Math.round(words / 400));

function tagSlug(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, '-');
}

function toIso(v, where) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('invalid date in ' + where + ': ' + s);
  // 保留原始 ISO8601 文本（含偏移），避免 Date 归一化到 UTC 改变语义
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)$/.test(s)) return s;
  return d.toISOString();
}

/* ---------- 采集 ---------- */
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const errors = [];
const articles = [];
const pages = [];

for (const file of listFiles(path.join(ROOT, 'posts'))) {
  if (path.basename(file) !== 'index.md') continue;
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const slug = path.basename(path.dirname(file));
  let fm;
  let body;
  try {
    const parsed = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    fm = parsed.data;
    body = parsed.body;
  } catch (e) { errors.push(rel + ': ' + e.message); continue; }
  if (!fm.title) { errors.push(rel + ': missing title'); continue; }
  if (!fm.date) { errors.push(rel + ': missing date'); continue; }
  if (fm.tag) { errors.push(rel + ': legacy singular `tag` found, use `tags`'); continue; }
  const draft = fm.draft === true;
  if (draft) continue;
  const tags = Array.isArray(fm.tags) ? fm.tags : [];
  const words = countWords(body);
  articles.push({
    slug,
    title: String(fm.title),
    date: toIso(fm.date, rel),
    updated: toIso(fm.updated, rel),
    tags,
    categories: Array.isArray(fm.categories) ? fm.categories : [],
    summary: fm.summary ? String(fm.summary) : null,
    url: '/posts/' + slug + '/',
    reading_minutes: readingMinutes(words),
    words,
    cover: fm.cover ? String(fm.cover) : null,
  });
}

for (const file of listFiles(path.join(ROOT, 'pages'))) {
  if (!file.endsWith('.md')) continue;
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  let fm;
  try { fm = parseFrontMatter(fs.readFileSync(file, 'utf8')).data; }
  catch (e) { errors.push(rel + ': ' + e.message); continue; }
  if (!fm.title) { errors.push(rel + ': missing title'); continue; }
  if (!fm.date) { errors.push(rel + ': missing date'); continue; }
  if (fm.tag) { errors.push(rel + ': legacy singular `tag` found, use `tags`'); continue; }
  if (fm.draft === true) continue;
  const inner = rel.slice('pages/'.length).replace(/\.md$/, '');
  const slug = inner.endsWith('/index') ? inner.slice(0, -'/index'.length) : inner;
  pages.push({ slug, title: String(fm.title), url: '/' + slug + '/' });
}

if (errors.length) {
  for (const e of errors) console.error('[meta] ' + e);
  process.exit(1);
}

articles.sort((a, b) => new Date(b.date) - new Date(a.date));
pages.sort((a, b) => a.slug.localeCompare(b.slug, 'zh-Hans-CN'));

const tagMap = new Map();
for (const a of articles) {
  for (const name of a.tags) {
    const key = tagSlug(name);
    if (!tagMap.has(key)) tagMap.set(key, { name, slug: key, count: 0, url: '/tags/' + key + '/' });
    tagMap.get(key).count += 1;
  }
}
const tags = [...tagMap.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug, 'zh-Hans-CN'));

const meta = {
  version: 1,
  generated_at: new Date().toISOString(),
  site: SITE,
  counts: { articles: articles.length, tags: tags.length, pages: pages.length },
  articles,
  pages,
  tags,
};

fs.writeFileSync(OUT, JSON.stringify(meta, null, 2) + '\n');
console.log('[meta] articles=' + articles.length + ' tags=' + tags.length + ' pages=' + pages.length + ' -> ' + path.relative(ROOT, OUT));
