---
title: "拆掉 Hugo 之后"
date: "2026-10-27T12:46:00+08:00"
draft: false
tags: ["Hugo", "静态站点", "Node", "Cloudflare Pages", "架构", "运行时"]
categories: ["技术笔记"]
summary: "核心动机只有一个：发文章太麻烦。拆掉 Hugo、把内容挪进独立仓库、站点改成运行时拉取，最后变成写 md + push 就完事。中间做错了两版。"
---

> 特别感谢网友 **滑稽佛陀（罗稽）** 提供的思路：内容不该在构建期固化，站点运行时去取。这套做法最早是他先提出来的。

让我动手的真正原因是发文章太麻烦。

以前发一篇要这样：在站点仓库里建 `content/posts/<slug>/`，写 md，图片放进 `static/`，push，等 Cloudflare 构建，构建完了发现图片路径写错，改一次，再等一次。想改个错别字也得走完整套。写着写着就不想写了。

所以这次改造只有一个目标：**写 md、push，剩下的别管**。

## 参考的两个仓库

动手前翻了两个仓库：[Strata](https://github.com/East-Luo/Strata) 和 [Articles](https://github.com/East-Luo/Articles)。

Strata 的做法是内容不进构建——站点运行时读一份 `meta.json`，正文直接从 GitHub 拿。Articles 是把内容单独拆一个仓库，站点只负责渲染。

我只要这两点。视觉不抄，ARK 那套留着（0 圆角、1px 线、45° 切角、`#18d1ff`）；URL 也不动，`/posts/<slug>/` 和 `/tags/<name>/` 要和旧站 sitemap 一一对上，80 条一条不能少。

## 第一次做错：把自动化当成实时

第一版做成"构建期从内容仓库拉文章"，push 完触发站点构建。

被骂了。原话是"我要的不是可以实时更新文章吗，怎么还是在构建时拉"。

现在看这错误挺典型。构建期拉取只是把手工步骤搬进 CI，内容还是那一刻的快照，发一篇文章仍然要等一次构建。

## 第二次做错：先给旧内容，再拿新的盖

第二版改成运行时拉清单，跟构建期的比一比，有变化就替换列表。

还是错。列表一打开就有东西，因为它是构建时写死在 HTML 里的；文章页先给旧正文，过一会才被换掉。截图甩过来我才反应过来，这叫事后纠正。

## 现在的样子

文章页的正文容器里只有一个加载态：

```html
<article class="post-content" data-slug="hyps-hub">
  <div class="post-loading">正在从内容仓库拉取…</div>
  <noscript>…构建时的正文…</noscript>
</article>
```

可见部分 10 个字，正文在 `<noscript>` 里。打开页面，脚本去拉 `posts/<slug>/index.md`，渲染好整体替换。列表同理，容器初始是空的，拉到 `meta.json` 才长出条目。

三个基址按顺序试：`raw.githubusercontent.com` 最实时，但国内容易被重置；jsDelivr 的 `@<commit>` 不可变，commit 一变 URL 就变，缓存自然绕过；最后是 `@main` 兜底。raw 的 CDN 有大约五分钟缓存，所以请求带时间戳。

拉不到就把 `<noscript>` 那段解析回可见 DOM，上面加一行「内容仓库暂时不可达 · 显示构建版本」和重试按钮。断网时看到的是构建版正文，不是白屏。

## 现在发一篇文章

```bash
node scripts/new-post.mjs "标题" --tags "Linux,Qt" --summary "一句话"
# 写正文
git add -A && git commit -m "post(slug): 标题" && git push
```

push 完等二十来秒，Actions 把 `meta.json` 重算并回提，列表就有新条目。改老文章更快，正文每次打开都重拉，刷新就是新的。

站点仓库不用管，构建不用等，图片跟 md 放同一个目录、正文写相对路径就行。

## 顺带换掉的构建

Hugo 换成了自己写的 Node 构建，`build/` 下十二个模块，八十一页跑八十到一百毫秒。CSS gzip 7.5 KB，入口 JS 6.2 KB，highlight.js 从整包 53.9 KB 砍到三种语言的 13.1 KB。

加载动画也从装饰变成了状态机：六个阶段、各自超时、全局 2.5 秒强制放行，`?boot=debug` 能打出时间线。

这些是顺带做的。

## 还没解决的

新文章第一次被访问走 404 页，内容能看，但状态码是 404，搜索引擎不收录。要么接 Cloudflare Deploy Hook 让它重建一次，要么手动点 Retry。这是目前发布体验里唯一还要人手的地方。

慢网首屏靠 modulepreload 和降级撑着，没做到秒开。迁移前的老图片路径也有一批没做重定向。

先把发布这条链路走顺，剩下的一点点收。
