# K-BLACK · articles

K-BLACK 站点（<https://k-black.top/>）的**唯一内容源**。站点在**运行时**从本仓库拉取内容——push 之后不需要重新构建站点，下次访问就是新内容（见 §9）。

- 站点仓库：`K-Blaaaack/my-homepage`（构建、样式、运行时；不含正文）
- 本仓库：只放 Markdown 与媒体，不放模板、样式、脚本（`scripts/gen-meta.mjs` 除外）

---

## 1. 目录结构

```
posts/<slug>/index.md        # 文章（page bundle），slug = 目录名 = URL /posts/<slug>/
posts/<slug>/<media>         # 与 md 同目录的图片/附件，相对路径引用
pages/info.md                # → /info/
pages/stack/index.md         # → /stack/
pages/wip.md                 # → /wip/
pages/测试.md                 # → /测试/
meta.json                    # Actions 生成的文章清单（站点运行时拉取，列表的唯一数据源）
.github/workflows/meta.yml   # push 时重算 meta.json 并回提
scripts/gen-meta.mjs         # 零依赖生成器（本地与 CI 共用）
```

slug 一旦发布**不要改名**：它同时是 URL、`/media/<slug>/` 前缀和站内链接目标。

## 2. front matter

```yaml
---
title: "标题"                 # 必填
date: "2026-10-17T15:00:00+08:00"   # 必填，ISO8601，保留 +08:00 偏移（加引号，避免 YAML 解析成 Date）
updated: "2026-10-20T09:00:00+08:00" # 可选，确实改过才写
draft: false                  # 可选，默认 false；true 不进 meta.json、不构建
tags: ["Linux", "Qt"]       # 可选，必须是数组；禁止单值 tag:
categories: ["技术笔记"]      # 可选
summary: "一句话摘要"          # 可选，列表页与 SEO 使用；没有就不写，不要编
cover: "cover.webp"          # 可选，相对路径
---
```

规则：

1. `tags` 只写数组。历史上单值的 `tag: "X"` 已统一迁移为 `tags: ["X"]`。
2. `date` / `updated` 用带偏移的 ISO8601 字符串；不写 `2026/10/17` 这类格式。
3. `summary` / `updated` 缺失时**留空**，不补写、不猜。
4. `draft: true` 的稿子可以随时推上来，不会进清单、不会上线。

## 3. 页面（pages/）的特殊约定

- `pages/*` 的 `tags` 只用作页面角标（取 `tags[0]`，如 `ABOUT` / `STACK` / `STATUS`），**不参与站点 tag 聚合**。线上 `/tags/about/`、`/tags/stack/`、`/tags/status/` 均为 404，构建器必须保持这一行为，否则 URL 集合会多出 3 条。
- `pages/stack/index.md` 保留 `type: "stack"`，构建器据此选用技术栈模板（数据来自站点 `data/stack.toml`）。
- 页面必须有 `date`（schema 必填）。历史上 `info.md` / `wip.md` / `stack/index.md` 缺失，已用 git 首次提交时间补齐。

## 4. 媒体

- 图片、附件与 `index.md` **同目录**（或子目录），正文用**相对路径**引用：`![alt](shots/editor.webp)`、`[下载](fanctl.sh)`。
- 不要写 `/media/...` 或站内绝对路径：运行时会按 `<基址>/posts/<slug>/` 解析相对路径（部署时生成的静态兜底仍会重写成 `/media/<slug>/<name>.<hash8>.<ext>`）。
- 外链图片可以留，但必须是显式 `http(s)://`，且不能当正文主图。
- 新增图片请先压到 WebP（正文图 ≤ 200 KB），文件名用小写英文与连字符。

## 5. 写作与发布流程

```bash
# 1. 新建（自动生成 front matter，date 自动带 +08:00）
node scripts/new-post.mjs                       # 交互式：逐项问标题 / slug / 标签 / 分类 / 摘要
node scripts/new-post.mjs "文章标题"             # 只给标题，缺的字段会在终端里追问
node scripts/new-post.mjs "文章标题" --tags "Linux,Qt" --summary "一句话摘要"   # 全参数，不追问

# 2. 写正文（图片放同目录，正文用相对路径）
$EDITOR posts/<slug>/index.md

# 3. 本地预览清单（可选）
node scripts/gen-meta.mjs && git diff --stat meta.json

# 4. 发布
git add -A && git commit -m "post(<slug>): 标题" && git push origin main
```

`new-post.mjs` 常用参数：

| 参数 | 作用 |
|---|---|
| `--slug my-slug` | 指定 slug（默认由标题推导；中文标题推不出时用日期兜底并提示） |
| `--tags "Linux,Qt"` | 生成 `tags: ["Linux", "Qt"]`（数组，不是单值）；文章默认 `[]`，页面默认 `["PAGE"]` |
| `--categories "技术笔记"` | 生成 `categories`；文章默认 `["技术笔记"]` |
| `--summary "…"` | 写入 summary；不传就不生成该字段 |
| `--date "2026-10-27T12:00:00+08:00"` | 指定发布时间（默认当前时间） |
| `--draft` | 标记 `draft: true`，不进 meta.json、不上线 |
| `--page` | 建到 `pages/`（独立页面），而不是 `posts/` |
| `--cover cover.webp` | 写入 cover 相对路径 |
| `--force` | 目录已存在时覆盖 `index.md` |

脚本只生成文件，不提交、不推送、不改 `meta.json`——后面三步仍然你自己来。

1. 推到 `main` 即发布：Actions 会重算 `meta.json` 并自动回提（commit 带 `[skip ci]`，不会循环）。
2. **推送即生效**：站点在运行时拉取本仓库，不需要重新构建、也不需要触发站点部署。列表下一次加载就能看到新文章，正文在打开文章时按需拉取（见 §9）。
3. 撤稿：`draft: true` 或 revert 对应 commit，不要删历史。

## 6. meta.json

由 `scripts/gen-meta.mjs` 生成，字段见站点仓库 `docs/architecture/40-implementation-contract.md` §3.3：

- 只含 `draft: false` 的文章，按 `date` 倒序；
- `words` 按 CJK 字数 + 拉丁词数统计，`reading_minutes = round(words / 400)`；
- `tags` 只聚合文章（不含 pages），slug 规则：小写、空格转 `-`、保留中文；
- 每篇文章带 `hash`：`sha256(index.md 原始字节)[:16]`，**不 trim、不规范化**；正文或 front matter 任一字节变化都会变。运行时用它在列表里判断「哪几篇更新了」（只看篇数/最新 slug 会漏掉老文章的修改）；**文章页不靠它决定要不要渲染**——每次打开都无条件拉 md。
- 顶层 `commit`：CI 里取 `GITHUB_SHA`，本地跑为 `null`。
- 站点**运行时依赖**本文件：列表页与 tag 页的条目全部来自它；部署产出的静态版本只作为无 JS 兜底。

## 7. 两条硬约定（不要违反）

1. **`pages/` 的 `tags` 只作角标，不参与站点 tag 聚合。** 取 `tags[0]` 渲染页面角标即可；线上 `/tags/about/`、`/tags/stack/`、`/tags/status/` 均为 404，构建器若给页面也建 term 页，URL 集合会从 80 变成 83，parity 门禁会红。`meta.json` 的 `tags` 也只由 `posts/` 聚合。
2. **`date` / `updated` 必须带 `+08:00` 偏移，不要写 UTC（`Z`）。** 写成字符串并加引号：`date: "2026-10-17T15:00:00+08:00"`。YAML 若把它解析成 `Date` 再 `toISOString()` 会变成 UTC，全站日期整体偏移 8 小时。

## 8. 提交约定

- `post(<slug>): 标题` / `page(<slug>): 标题` / `chore(meta): ...` / `fix(<slug>): ...`
- 一个 commit 只做一件事；不要在同一 commit 里混入格式化全仓库。
- 不 force push `main`，不改写已发布 slug。

## 9. 站点如何取到这些内容（运行时）

站点不在构建期固化正文，正常访问时**每次都向本仓库请求**：

| 内容 | 请求 | 缓存策略 |
|---|---|---|
| 列表 | `<基址>/meta.json` | `cache: no-cache`（ETag 重验证）；点「刷新」时追加 `?r=<时间戳>` 强拉 |
| 正文 | `<基址>/posts/<slug>/index.md` | 每次打开文章页都拉；raw 源追加 `?t=<时间戳>` 绕开 CDN 缓存 |
| 图片 | `<基址>/posts/<slug>/<相对路径>` | 正文里的相对路径按文章目录解析 |

基址顺序（逐个试，前一个失败才走下一个）：

1. `https://raw.githubusercontent.com/K-Blaaaack/articles/main` —— 实时源
2. `https://cdn.jsdelivr.net/gh/K-Blaaaack/articles@<commit>` —— 不可变，必然新鲜（commit 取自 `meta.json`）
3. `https://cdn.jsdelivr.net/gh/K-Blaaaack/articles@main` —— 兜底

行为约定：

- **可见延迟**：push 后 Actions 重算 `meta.json`（约 10–30 秒），之后刷新页面即可看到。raw 有约 5 分钟 CDN 缓存，所以正文与清单请求都带绕缓存参数。
- **失败表现**：内容源不可达时退回部署时的静态版本，并提示「内容仓库暂时不可达 · 显示构建版本」+ 重试，不会白屏。
- **静态兜底仍存在**：站点部署时会把当时的内容烤一份放进 `<noscript>`，给禁用 JS 的读者和爬虫；正常访问不读它。
- **不需要重建站点**：改完直接 push，站点下一次访问就是新内容。只有在需要刷新兜底静态版时才重新部署站点。
