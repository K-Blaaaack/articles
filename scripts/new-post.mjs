#!/usr/bin/env node
/**
 * new-post.mjs —— 新建文章/页面骨架（零依赖，Node ≥ 18）
 *
 * 用法：
 *   node scripts/new-post.mjs "文章标题"
 *   node scripts/new-post.mjs "文章标题" --slug my-slug --tags "Linux,Qt" --summary "一句话摘要"
 *   node scripts/new-post.mjs "关于" --page            # 建到 pages/
 *   node scripts/new-post.mjs --help
 *
 * 只生成文件，不提交、不推送、不改 meta.json（Actions 会在 push 后重算）。
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `
新建文章骨架

  node scripts/new-post.mjs "标题" [选项]

选项
  --slug <slug>        指定 slug（默认由标题推导；中文标题推不出来时用日期兜底）
  --tags "a,b"         tags 数组，逗号分隔（文章默认 []，页面默认 ["PAGE"]）
  --categories "a,b"   categories 数组，逗号分隔（文章默认 ["技术笔记"]）
  --summary "…"        摘要（不写就不生成该字段）
  --date <ISO>         date，默认当前时间（+08:00）
  --cover <file>       cover 相对路径
  --draft              标记 draft: true（不进 meta.json、不上线）
  --page               建到 pages/ 而不是 posts/（页面）
  --force              目录已存在时仍然写入（覆盖 index.md）
  --help               显示本帮助

示例
  node scripts/new-post.mjs "Hyps Hub 的配置隔离"
  node scripts/new-post.mjs "Arch 下 Wayland 缩放" --tags "Linux,Wayland" --summary "分数缩放的坑"
  node scripts/new-post.mjs "关于本站" --page --slug about
`;

function die(msg) {
  console.error('错误：' + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [], tags: [], categories: [] };
  const takesValue = new Set(['--slug', '--tags', '--categories', '--summary', '--date', '--cover']);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--draft') out.draft = true;
    else if (a === '--page') out.page = true;
    else if (a === '--force') out.force = true;
    else if (takesValue.has(a)) {
      const v = argv[i + 1];
      if (v === undefined) die(a + ' 需要一个值');
      i += 1;
      if (a === '--tags') out.tags = splitList(v);
      else if (a === '--categories') out.categories = splitList(v);
      else out[a.slice(2)] = v;
    } else if (a.startsWith('--')) die('未知选项 ' + a);
    else out._.push(a);
  }
  return out;
}

function splitList(v) {
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

/** 标题 → slug：小写、空格转 -、保留中文与字母数字，去掉其它符号 */
function slugify(title) {
  const s = String(title)
    .trim()
    .toLowerCase()
    .replace(/['"’“”]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s;
}

/** 当前时间，固定 +08:00 偏移（站点按这个时区显示日期） */
function nowISO() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

function yamlString(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function yamlList(list) {
  return '[' + list.map(yamlString).join(', ') + ']';
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP.trim());
  process.exit(0);
}

const title = (args._[0] || '').trim();
if (!title) {
  console.error(HELP.trim());
  die('缺少标题');
}

const date = args.date || nowISO();
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/.test(date)) {
  die('date 必须是 ISO8601 且带偏移，例如 2026-10-27T12:00:00+08:00');
}
if (date.endsWith('Z')) {
  console.warn('提醒：date 用了 UTC（Z）。本站约定 +08:00，建议改成本地偏移，否则全站日期会差 8 小时。');
}

let slug = (args.slug || slugify(title)).trim();
if (!slug) {
  const d = date.slice(0, 10).replace(/-/g, '');
  slug = 'post-' + d;
  console.warn(`标题推不出 slug，已用日期兜底：${slug}（建议 --slug 指定）`);
}
if (!/^[a-z0-9\u4e00-\u9fa5-]+$/.test(slug)) {
  die('slug 只能包含小写字母、数字、中文和连字符：' + slug);
}
if (/[\u4e00-\u9fa5]/.test(slug)) {
  console.warn('提醒：slug 含中文，URL 会被百分号编码，分享链接不好看。');
}

const isPage = Boolean(args.page);
const dir = join(ROOT, isPage ? 'pages' : 'posts', slug);
const file = join(dir, 'index.md');

if (existsSync(file) && !args.force) {
  die('已存在：' + file + '（要覆盖加 --force）');
}

const lines = ['---', 'title: ' + yamlString(title), 'date: ' + yamlString(date)];
if (isPage) {
  // 页面：tags 只作角标（如 ABOUT / STACK），不参与 tag 聚合，也没有 draft/categories
  lines.push('tags: ' + yamlList(args.tags.length ? args.tags : ['PAGE']));
  if (args.summary) lines.push('summary: ' + yamlString(args.summary));
} else {
  // 文章：固定顺序 title → date → draft → tags → categories → summary → cover
  lines.push('draft: ' + (args.draft ? 'true' : 'false'));
  lines.push('tags: ' + yamlList(args.tags));
  lines.push('categories: ' + yamlList(args.categories.length ? args.categories : ['技术笔记']));
  if (args.summary) lines.push('summary: ' + yamlString(args.summary));
  if (args.cover) lines.push('cover: ' + yamlString(args.cover));
}
lines.push('---', '');
if (isPage) lines.push('正文从这里开始。', '');
else lines.push('正文从这里开始。', '', '## 小标题', '', '- 列表项', '');

mkdirSync(dir, { recursive: true });
writeFileSync(file, lines.join('\n'), 'utf8');

const rel = (isPage ? 'pages/' : 'posts/') + slug + '/index.md';
console.log('已创建 ' + rel);
console.log('');
console.log('下一步：');
console.log('  1. 编辑 ' + rel + '（图片放同目录，正文用相对路径引用）');
console.log('  2. node scripts/gen-meta.mjs        # 可选：本地预览清单变化');
console.log('  3. git add -A && git commit -m "' + (isPage ? 'page' : 'post') + '(' + slug + '): ' + title + '"');
console.log('  4. git push origin main             # Actions 重算 meta.json，之后站点即生效');
if (args.draft) console.log('  （当前是 draft: true，上线前记得删掉这一行）');
