# HDX Diff 报告 - 结构与样式总结

> 单页三栏静态 HTML 报告：章节树 + 段落大纲 + 左右双边整章上下文对比。仅靠颜色与缩进表达差异，无任何 CDN/后端依赖。

## 1. 页面骨架 (三栏 + 上下夹层)

```
┌────────────── Header (深色渐变条) ──────────────┐
│ 标题 + OLD→NEW  ｜ 生成时间 · 源文档  ｜ 右侧统计徽章  │
├──────────┬──────────────┬──────────────────────────┤
│ ① 章节栏  │ ② 段落大纲栏  │ ③ 双边内容对比 (OLD│NEW)    │
│  Tree     │  Heading-level│  整章铺开 + 聚焦高亮        │
│           │  hierarchical │                             │
│           │  list         │                             │
│  ↔ splitter│ ↔ splitter   │                             │
└──────────┴──────────────┴──────────────────────────┘
┌────────────── Footer (深色条) ──────────────────┐
│ 图例 (绿/红/黄/灰)            ｜ 自包含静态报告       │
└────────────────────────────────────────────────────────────┘
```

- 外层 `body` flex column；中部 `.layout` 用 CSS Grid `grid-template-columns: var(--tree-width) var(--list-width) 1fr`；列宽由 `splitter.js` 拖动更新两个 CSS 变量。
- `.diff-scroll` 内部又是一个 `grid-template-columns: 1fr 4px 1fr` 的子 Grid，呈现 OLD│分隔条│NEW。

## 2. 设计 Token

```
--accent:        #4f46e5 (indigo, 用于 active/focus)
--accent-soft:   #eef2ff
--accent-border: #6366f1

--c-add / --bg-add / --bg-add-soft  绿 (#16a34a / #dcfce7 / #f0fdf4)
--c-del / --bg-del / --bg-del-soft  红 (#dc2626 / #fee2e2 / #fef2f2)
--c-chg / --bg-chg / --bg-chg-soft  琥珀 (#d97706 / #fef3c7 / #fffbeb)
--c-keep:                           灰 (#94a3b8)

--header-bg: linear-gradient(90deg, #1e293b → #312e81)
--pane-header-bg: #f1f5f9
--surface / --surface-alt / --surface-soft: 三级白/灰背板
```

每状态均有 strong (c-x) / soft (bg-x-soft 背板) / hard (bg-x 行内高亮) 三档色彩，覆盖徽章、块底色、行内 span、表格 cell 等不同位置。

## 3. 三栏职责

### ① 章节栏 (左)
- 数据：`chapters` 树嵌套，节点字段 `id/title/status/children`
- 视觉：递归 `ul>li`；`tree-toggle`（▾／▸／•）；有变更节点末尾挂 `[新增]/[删除]/[修改]` pill，按状态取色
- 默认展开策略：`expandDiffByDefault` + `hasTreeDiff` 递归判断，凡子树含变更则展开，否则 collapsed
- 点击章节 → `selectChapter(id)`：切换 active，重渲段落栏 + 双边栏（不联动跳段落）

### ② 段落大纲栏 (中)
按文档标题层级缩进的真树形：
- 数据：`paragraphsByChapter[chapterId]` = 段落数组（按文档原顺序）
- `heading` 段带 `level`（1=章/2=节/3=子节）；JS 用 `curHeadingLevel` 跟踪当前 heading 深度
- heading 自身缩进 `curHeadingLevel-1`；其下非 heading 段保持文档原顺序并缩进到当前 heading 下一级
- 段落项去类型徽标，仅状态徽标（绿/红/黄药丸）
- `s-keep` 段 opacity 0.55，标题色降为 text-soft；`s-add/del/chg` 段自带柔色底（`bg-*-soft`），标题用对应强调色
- 点击段落 → `selectParagraph(pid)`：跨章节会自动切章 + 重渲；该段 `.active` 加 indigo 左边框

### ③ 双边内容对比栏 (右)
整章上下文铺开 + 聚焦高亮：
- 数据：同一个 `paragraphsByChapter[chapterId]`，按数组顺序逐段渲染 OLD│NEW 两侧
- 段块 `.diff-block` 同时挂 `type-*` 与 `status-*`：
  - **status-add/del/chg** 显示左边框 3px（绿/红/琥珀）+ 整块淡底色（`bg-*-soft`）
  - **status-keep** 透明左边框，加 `.context`：opacity 0.55 + saturate 0.7 维持骨架
- 聚焦段额外加 `.focused`：强制 opacity 1 + indigo 2px 描边 + 阴影 + `z-index:1`；用 `scrollIntoView({block: 'center'})` 居中滚入
- 去掉了任何 `[类型] 状态` 的 meta 头，颜色即差异
- 左右两栏 `scroll-sync.js` 同步滚顶防读漂

## 4. 内容类型与渲染

| 类型 | OLD | NEW | 备注 |
|---|---|---|---|
| heading | `oldHtml` 含 `<h2/h3/h4 class="diff-h">` | `newHtml` | `.type-heading` 块去边框/背景，`h-level-2/3` 控制纵向间距；标题内 inline 可带 `<span class="add/del/chg">` |
| text | `oldHtml` / `contentHtml`(keep) | 同 | `<p class="diff-p">`，行内高亮走 `.add/.del/.chg` |
| table | 完整 `<table>` HTML | 同 | `.data-table`；单元格差异用 `<td class="cell-add/del/chg">`上色 |
| image | `oldImage` 路径 + caption + hash | `newImage` | `.image-block` 居中，下方挂药丸 `image-status` + sha1 等宽小字 |
| list | `<ul/ol class="data-list">` | 同 | 行内可夹 `<span class="add">` 高亮新命令 |

数据层契约（共七字段，按需）：
`id`, `type`, `status`, `title`, `level`（仅 heading）, `contentHtml`（keep 一份），`oldHtml/newHtml`（差异两份）, `oldImage/newImage/oldCaption/newCaption/oldHash/newHash`（仅 image）

## 5. 状态/交互三态表现

| 栏 | 选中章节前 | 选中章节后（无段落聚焦） | 点击某段落（聚焦） |
|---|---|---|---|
| ① 章节栏 | 默认只展开含变更子树 | 当前章节 label `.active`（indigo 着色） | 不变 |
| ② 段落栏 | 空白 | 铺开整章段落按层级缩进；keep 淡化；差异段柔色底+状态徽标 | 该段 `.active`（indigo 左边框） |
| ③ 双边栏 | 提示语 占位 | 整章 OLD│NEW 铺开；keep `.context` 淡化；左右同步滚动 | 该段 `.focused`（indigo 描边+阴影），滚入居中 |

## 6. 文件组织

```
report/
├── index.html              # 单页骨架：header .layout 三栏 (.pane-tree / .pane-list / .pane-diff) + footer 图例
├── css/report.css           # 419 行：tokens / header / 三栏 / tree / paragraph-list / diff-block / inline highlights / table / image / footer
├── js/
│   ├── splitter.js          # 拖拽更新 --tree-width / --list-width
│   ├── scroll-sync.js       # 左右 diff 栏 scrollTop 互同步 (syncing flag 防回环)
│   └── report.js            # 数据驱动渲染主控
├── data/diff-data.js        # 假数据 demo（12 章/节全覆盖，含完整 keep 上下文）
└── assets/images/topo_*.svg # 新旧组网拓扑样例
```

## 7. 接真实 HDX 时的契约

Python 端只需产出等价的 `window.DIFF_DATA = { meta, chapters[], paragraphsByChapter{} }`：
- 解析 HDX（zipfile+lxml）得到完整章节树（含 keep 章节），并在 `paragraphsByChapter` 里把整章/整节每段都写出来（含 keep 前后内容）
- heading 段务必带 `level`（来自真实标题层级）
- diff 由后端用 difflib 算好行内 token，包成 `<span class="add/del/chg">` 写进 `oldHtml/newHtml`；keep 段写 `contentHtml` 即可
- 表格 cell 差异给 `cell-add/del/chg`，图片差异给 `oldImage/newImage + hash`
- 写出的 `report/data/diff-data.js` 直接替换，前端零改动

## 8. 端到端解析/生成报告 (新版, 本次实现)

`scripts/generate_report.py` 一条命令把 JSON 章节转换为前端 `window.DIFF_DATA`：

```bash
python3 scripts/generate_report.py \
  --old "data/parse/json/5G RAN10.1" \
  --new "data/parse/json/5G RAN10.2" \
  --hedex "data/parse/hedex" \
  --out   "report/data/diff-data.js" \
  --assets "report/assets/images/hedex"
```

输入目录结构 (`--old` 与 `--new` 可指向同形 JSON 目录或单文件)：
```
data/parse/
├── json/
│   ├── 5G RAN10.1/chapters.json   # OLD 版本章节 (数组, 含 titleStr/path/html)
│   └── 5G RAN10.2/chapters.json   # NEW 版本章节
└── hedex/
    └── resources/                  # html 内 "${URL_PREFIX}//resources//<file>" 引用解析到这里
        ├── topo_v1.svg, topo_v2.svg
        └── zh-cn_topic_*.html
```

输入 JSON chapter 字段：
- `titleStr`：章节名称 (例如 "文档包信息")
- `path`：章节路径 (例如 "5G RAN10.1 特性文档 > 文档包信息"), 必须以版本前缀起头
- `html`：整篇 `<html>...</html>` 原文, 其中引用图片走 `${URL_PREFIX}//resources//<file>`

生成步骤：
1. `strip_version()` 正则 `^\s*(\d+G\s*RAN\s*\d+\.\d+(?:\.\d+)?)\s+` 把每条 `path` 头部版本段剥离, 得到跨版本归一化的 "特性文档 > 文档包信息"
2. 按 segment 拼接路径树 (`> ` 分隔)。同一归一化路径的 OLD/NEW entries 合到同一节点；纯中间层节点 (无 entry) 标 `bridge:true`, 中/右栏渲染 "无独立内容", 不挂点击, 仅作层级占位
3. 章节状态: `new only -> add`, `old only -> del`, `both equal-_html -> keep`, `both 不相等 -> chg`; 含变更的父节点 `chg` 状态自动向上传播
4. `lxml.html` 解析章节 html body, 直接 children / 含子块的 div (含 `<img>` / 含 `<p>` / `<table>` / `<ul>` / `<ol>` / heading tags) 一一抽取为 `Block(type, level=仅heading, html)`
5.OLD/NEW 段列对齐: `difflib.SequenceMatcher` 用签名 (type + 内容前 80 字 + heading level) 决定 `equal/insert/delete/replace`。相等的两段对齐若 html 完全一致 -> keep, 否则 chg; 行内 highlight 用 `TOKEN_RE` 拆 tag/字符两种 token, 在 old 接 add-d 态用 `<span class="del">` 加删除标记, 在 new 接 insert-d 态用 `<span class="add">` 加新增标记, replace 同时按各自侧推出 del/add span
6. 表格走 `diff_table_html()` 行对齐 + cell level `cell-add/del/chg` 标色
7. 图片资源: `${URL_PREFIX}//resources//<file>` 取前缀之后文件名, 从 hedex 拷到 `report/assets/images/hedex/`, sha1 截取前 12 位写入 `oldHash/newHash`
8. 输出 JS 文件: 前缀注释 + `window.DIFF_DATA = <JSON>;` (ensure_ascii=False, 缩进 2)

辅助脚本 (mock + 验证):
- `scripts/build_mock_data.py` 生成 mock OLD/NEW 数据进 `data/parse/json/202G RAN10.{1,2}` 与 `data/parse/hedex/resources/`
- `scripts/smoke_test.py` Python 端校验 chapters/paragraphs/stats 字段契约
- `scripts/render_test.js` Node 用简化 DOM mock 跑完 report.js 不抛异常并核对中栏标题项数

中栏新规则 (本次按用户要求修改, report.js):
- 段落栏只展示 heading 段 (按其 level 缩进), 不再展示非 heading 段落
- 选中 `bridge:true` 的纯粹层级节点 -> 无 onClick (左侧仅作 folder)
- 选中含 heading 的章节 -> 中栏列出各 heading 标题 + 状态徽标; 点击 heading 聚焦右侧
- 选中无 heading 的章节 -> 中栏空 (提示文案 "此章无标题层级, 内容已直接展示在右侧"), 内容直接呈现于右栏 (本场景覆盖用户要求 #1)

## 9. 已验证项
- `node --check` 三个 JS (splitter.js / scroll-sync.js / report.js) 全过
- `python3 scripts/smoke_test.py` 通过 (6 章/段契约 + stats + 中栏空 case)
- `node scripts/render_test.js` 通过 (8 节点树, 2 bridge, 6 leaf 章节, 23 段, 7 heading; 每个 selectChapter 中栏条目数与 heading 数吻合)
- 4 个静态资源 HTTP 200 + 2 个生成图片 HTTP 200
- 敏感词扫描零命中
