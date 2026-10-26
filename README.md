# K-BLACK · articles

K-BLACK 站点（<https://k-black.top/>）的**唯一内容源**。站点构建期读取本仓库（`CONTENT_DIR`），不在运行时拉取。

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
meta.json                    # Actions 生成的文章清单（构建期不依赖，仅校验）
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
- 不要写 `/media/...` 或站内绝对路径：构建期会把相对路径重写为 `/media/<slug>/<name>.<hash8>.<ext>`。
- 外链图片可以留，但必须是显式 `http(s)://`，且不能当正文主图。
- 新增图片请先压到 WebP（正文图 ≤ 200 KB），文件名用小写英文与连字符。

## 5. 写作与发布流程

```bash
# 1. 新建文章
mkdir -p posts/my-slug && $EDITOR posts/my-slug/index.md

# 2. 本地预览清单（可选）
node scripts/gen-meta.mjs && git diff --stat meta.json

# 3. 发布
git add -A && git commit -m "post(my-slug): 标题" && git push origin main
```

1. 推到 `main` 即发布：Actions 会重算 `meta.json` 并自动回提（commit 带 `[skip ci]`，不会循环）。
2. 站点仓库按 `CONTENT_DIR` 读取本仓库，重新构建后生效；本仓库不触发站点部署。
3. 撤稿：`draft: true` 或 revert 对应 commit，不要删历史。

## 6. meta.json

由 `scripts/gen-meta.mjs` 生成，字段见站点仓库 `docs/architecture/40-implementation-contract.md` §3.3：

- 只含 `draft: false` 的文章，按 `date` 倒序；
- `words` 按 CJK 字数 + 拉丁词数统计，`reading_minutes = round(words / 400)`；
- `tags` 只聚合文章（不含 pages），slug 规则：小写、空格转 `-`、保留中文；
- 构建期**不依赖**本文件；它用于校验与人工查阅。

## 7. 提交约定

- `post(<slug>): 标题` / `page(<slug>): 标题` / `chore(meta): ...` / `fix(<slug>): ...`
- 一个 commit 只做一件事；不要在同一 commit 里混入格式化全仓库。
- 不 force push `main`，不改写已发布 slug。
