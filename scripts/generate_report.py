#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HDX 文档版本对比报告生成器

输入 (mock 或真实数据)：
  --old DIR|FILE     旧版本数据: 已解析的章节 JSON (字段 titleStr / path / html),
                     可以是目录 (递归载入其中所有 .json) 或单个 .json 文件。
  --new DIR|FILE     新版本数据, 同上。
  --hedex DIR        解压后的 hedex 资源目录, html 内 "${URL_PREFIX}//resources//xxx"
                     引用都从这里解析。
  --out  FILE        报告数据输出路径 (默认 report/data/diff-data.js)。
  --assets DIR       报告图片资源输出目录 (默认 report/assets/images/hedex)。

输出:
  report/data/diff-data.js  ->  window.DIFF_DATA = { meta, chapters, paragraphsByChapter };
  并把图片资源复制到 report/assets/images/hedex/。

数据处理流程:
  1. 载入 OLD / NEW 章节; 用 strip_version() 过滤 path 中的版本前缀
     (例如 "5G RAN10.1 特性文档 > 文档包信息" -> "特性文档 > 文档包信息")
  2. 按 path 的 ">" 层级构建章节树 (chunks 不带版本前缀, 跨版本归一化对齐)
  3. 对每个章节按 old/new 是否存在, 决定 status (add/del/keep/chg)
  4. 解析每个章节 html 提取段落块 (heading/text/table/list/image)
  5. 对 old/new 都存在的章节做 para-级差对齐并产生 oldHtml/newHtml 高亮内容
  6. 把图片引用拷贝到 report 资源目录, 替换为相对路径
  7. 串行化为 DiffData 并写入输出文件
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import sys
from html import escape as html_escape
from pathlib import Path
from lxml import etree, html as lxml_html

# ----------------------------- 常量 -----------------------------

# 版本前缀正则: 形如 "5G RAN10.1", "5G RAN10.1.0", "5G RAN 10.1"...
VERSION_RE = re.compile(r"^\s*(\d+G\s*RAN\s*\d+\.\d+(?:\.\d+)?)\s+", re.IGNORECASE)

# ${URL_PREFIX}//resources//abc.svg
URL_PREFIX_RE = re.compile(r"\$\{URL_PREFIX\}\/\/resources\/\/([^\"'\s>]+)")

DIFF_BLOCK_TYPES = ("heading", "text", "table", "list", "image")

# heading tag -> level
HEADING_TAGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}


# ----------------------------- 工具 -----------------------------

def strip_version(path: str) -> str:
    """剥离 path 中的版本段 (例如 '5G RAN10.1 ...') 返回剩余规范化路径."""
    m = VERSION_RE.match(path.strip())
    rest = path.strip()[m.end():].strip() if m else path.strip()
    # 去重空格与不对齐分号
    rest = re.sub(r"\s*>\s*", " > ", rest)
    return rest


def split_path(stripped_path: str):
    """规范化 path 以 '>' 分段, 去掉多余空白."""
    parts = [p.strip() for p in stripped_path.split(">") if p.strip()]
    return parts


def load_entries(arg: str):
    """加载参数 arg (文件或目录) 下所有 JSON 章节, 返回 entry 列表.

    支持的文件形态 (大文件几百 MB 也兼容, 走 raw_decode 迭代避免一次性 EOF 拒掉 'Extra data'):
      - 单对象: 一个章节, 或对象内含 "chapters" 键
      - 单数组: [{...}, {...}, ...]
      - 多个顶层 JSON 值拼接 (含/无换行, 即 JSON-stream / NDJSON):
        {...}{...}{...} 或 {...}\\n{...}\\n...
      - 多个数组拼接: [...]\\n[...]\\n... 或 NDJSON-style
      - 同一文件里混杂对象 / 数组 的顶层 JSON 值
    """
    p = Path(arg)
    files = []
    if p.is_dir():
        files = sorted(p.rglob("*.json"))
    elif p.is_file():
        files = [p]
    else:
        raise FileNotFoundError(f"input not found: {arg}")

    entries = []
    for f in files:
        _load_one_file(f, entries)
    return entries


def _load_one_file(f: Path, entries: list):
    """读取单个 JSON 文件, 用 raw_decode 迭代消费顶层 JSON 值, 兼容大文件与多值拼接."""
    try:
        text = f.read_text(encoding="utf-8-sig")  # utf-8-sig 同时吃 BOM
    except UnicodeDecodeError:
        text = f.read_text(encoding="utf-8", errors="ignore")
    except OSError as e:
        print(f"WARN: read {f} failed: {e}", file=sys.stderr); return
    decoder = json.JSONDecoder()
    idx, n = 0, len(text)
    count = 0
    while idx < n:
        # 跳过空白与常见分隔字符
        while idx < n and text[idx] in " \t\r\n,":
            idx += 1
        if idx >= n:
            break
        try:
            value, end = decoder.raw_decode(text, idx)
        except json.JSONDecodeError as e:
            print(f"WARN: skip {f}: JSONDecodeError at char {idx}: {e}", file=sys.stderr)
            # 从失败位置附近往后找下一个 '{' 或 '[' 再继续, 避免一个错殂整个文件
            nxt = min(n, idx + 1)
            while nxt < n and text[nxt] not in "{[":
                nxt += 1
            idx = nxt
            continue
        _emit_value(value, f, entries)
        count += 1
        idx = end
    if count == 0:
        print(f"WARN: {f} 没解析到任何 JSON 值", file=sys.stderr)


def _emit_value(value, src: Path, entries: list):
    """把单个顶层 JSON 值展开为 entry 列表附加进去.
    只接受含 titleStr / path / html 至少之一的 dict (避免吞掉 sentinel/garbage)."""
    def push(item):
        if not isinstance(item, dict):
            return
        if not any(k in item for k in ("titleStr", "path", "html")):
            return  # 缺全部章节字段 -> 不是真章节, 丢弃
        entries.append(_normalize_entry(item, src))
    if isinstance(value, dict):
        if "chapters" in value and isinstance(value["chapters"], list):
            for c in value["chapters"]:
                push(c)
        else:
            push(value)
    elif isinstance(value, list):
        for c in value:
            push(c)


def _normalize_entry(raw, src):
    """规范化单条 entry, 至少保证含 titleStr / path / html 字段."""
    raw = dict(raw)  # shallow copy
    raw.setdefault("titleStr", "")
    raw.setdefault("path", "")
    raw.setdefault("html", "")
    raw["_src"] = str(src)
    return raw


# ----------------------------- 章节树构建 -----------------------------

class ChapterNode:
    """章节树节点. 含 children (子章节) / entry (本节点对应的章节 entry, 若有) / status / id."""
    def __init__(self, title: str):
        self.title = title
        self.children = []
        self.entry = None        # 原始 entry (可能来自 old 或 new)
        self.old_entry = None
        self.new_entry = None
        self.status = "keep"
        self.id = ""             # 由构建顺序生成, 例如 ch1, ch1-2


def build_tree(old_entries, new_entries):
    """根据 path (去版本) 构建章节树, 将 old/new entry 挂到对应叶子; 返回根节点列表."""
    root = ChapterNode("__root__")
    # 把 (old_entry / new_entry) 按 path_key 分组
    def into(node, parts, leaf_entry=None, old_e=None, new_e=None):
        """沿 parts 递归向下挂叶; 末段记录 entry."""
        if not parts:
            if old_e is not None:
                node.old_entry = old_e
            if new_e is not None:
                node.new_entry = new_e
            if leaf_entry is not None:
                node.entry = (node.entry or leaf_entry)
            return
        head = parts[0]
        child = next((c for c in node.children if c.title == head), None)
        if child is None:
            child = ChapterNode(head)
            node.children.append(child)
        into(child, parts[1:], leaf_entry=leaf_entry, old_e=old_e, new_e=new_e)

    # 先 OLD 再 NEW 入树 (二者依次, 同一组 path 自动归并)
    for e in old_entries:
        sp = strip_version(e["path"])
        into(root, split_path(sp), leaf_entry=e, old_e=e)
    for e in new_entries:
        sp = strip_version(e["path"])
        into(root, split_path(sp), leaf_entry=e, new_e=e)
    return root


def assign_ids(root: ChapterNode, prefix="ch"):
    """按 DFS 顺序给所有节点赋予稳定 id (ch1 / ch1-1 / ch1-1-1 ...).
    同时为 bridge 节点 (无 entry 仅有 children) 置位 bridge=True 便于前端不挂点击.
    """
    def walk(node, base):
        for i, c in enumerate(node.children, start=1):
            cid = f"{base}-{i}" if base else f"ch{i}"
            c.id = cid
            c.bridge = (c.entry is None and c.old_entry is None
                        and c.new_entry is None)
            walk(c, cid)
    # root 自身不入序列化, 仅做索引遍历
    walk(root, "")
    return root


def determine_tree_status(node: ChapterNode):
    """按 old/new entry 是否存在决定每个节点的 status, 再向上聚合."""
    # 递归子节点
    sub_statuses = []
    for c in node.children:
        determine_tree_status(c)
        sub_statuses.append(c.status)
    old_html = node.old_entry["html"] if node.old_entry is not None else ""
    new_html = node.new_entry["html"] if node.new_entry is not None else ""
    has_old = node.old_entry is not None
    has_new = node.new_entry is not None
    if has_old and not has_new:
        s = "del"
    elif has_new and not has_old:
        s = "add"
    elif has_old and has_new:
        s = "keep" if _html_equal(old_html, new_html) else "chg"
    else:
        # 无 entry 但有 children -> 用子节点状态聚合 (任一非 keep 则自身标记)
        s = "keep"
    if s == "keep" and sub_statuses:
        # 含子节点变更时向上传播
        if any(st != "keep" for st in sub_statuses):
            s = "chg" if (has_old and has_new) else s
    if s == "keep" and not has_old and not has_new and any(st != "keep" for st in sub_statuses):
        s = "chg"
    node.status = s


def _html_equal(a: str, b: str) -> bool:
    """忽略空白 / 属性顺序做粗略相等比较."""
    if a == b:
        return True
    return re.sub(r"\s+", " ", a).strip() == re.sub(r"\s+", " ", b).strip()


# ----------------------------- 解析 HTML 段落块 -----------------------------

class Block:
    """一个段落块. type: heading/text/table/list/image; level 仅 heading; html 为直接渲染 HTML."""
    __slots__ = ("type", "level", "html", "title", "image")
    def __init__(self, type_, level=None, html="", title="", image=None):
        self.type = type_
        self.level = level
        self.html = html
        self.title = title
        self.image = image if image is not None else {}


def _tag(el) -> str:
    """lxml 元素 tag 去掉命名空间前缀."""
    t = el.tag
    if isinstance(t, str):
        return t.split("}", 1)[-1].lower()
    return ""


def _text_of(el) -> str:
    """元素的全部直系文本, 用于段落标题摘要与签名."""
    parts = list(el.itertext())
    return "".join(parts).strip()


def _serialize(el):
    """把 lxml 元素序列化为字符串 (含自身)."""
    return etree.tostring(el, encoding="unicode", with_tail=False).strip()


def parse_blocks(html_str: str):
    """解析章节 html 字符串, 抽取段落块列表 (按文档顺序)."""
    if not html_str:
        return []
    try:
        doc = lxml_html.fromstring(html_str)
    except Exception:
        # 解析失败时退化为整章单一 text 块
        return [Block("text", html=f'<p class="diff-p">{html_escape(html_str)}</p>', title="原文")]
    # 找到 body; 若没有 body, doc 自身是 body-equivalent
    body = doc.find(".//body")
    if body is None:
        body = doc
    blocks = []
    for child in list(body):
        blocks.extend(_walk_el(child, depth=0))
    if not blocks and _text_of(doc).strip():
        blocks = [Block("text", html=f'<p class="diff-p">{html_escape(_text_of(doc))}</p>',
                        title=_text_of(doc)[:20])]
    return blocks


def _walk_el(el, depth=0, max_depth=8):
    """递归把 HTML 元素映射为 Block; 仅在 multi-content (div 包含若干) 时展开."""
    if depth > max_depth:
        return []
    tag = _tag(el)
    if tag in HEADING_TAGS:
        lvl = HEADING_TAGS[tag]
        title = _text_of(el)
        html = _serialize(el)
        # 强制 class="diff-h" (替换原 class)
        html = re.sub(r'<(h\d)\b[^>]*>', f'<\\1 class="diff-h">', html, count=1)
        return [Block("heading", level=lvl, html=html, title=title)]

    if tag == "p":
        text = _text_of(el)
        return [Block("text", html=f'<p class="diff-p">{_inner_html(el)}</p>',
                      title=text[:24] or "段落")]

    if tag == "table":
        return [_make_table_block(el)]

    if tag in ("ul", "ol"):
        text = _text_of(el)
        cls = "data-list"
        # 输出元素, 替换 class 为 data-list
        inner = _inner_html(el)
        # inner 已含 <li>, 我们用 \w+ 替换 list 元素的 class
        return [Block("list", html=f'<{tag} class="{cls}">{inner}</{tag}>', title=text[:24] or "列表")]

    if tag == "div":
        # div 中包含 <img> -> image block
        imgs = el.xpath('.//img')
        if imgs:
            return [_make_image_block(el, imgs)]
        # div 仅含 <div class="cap"> + <img> -> 已处理; 否则考虑递归向下展平
        text_children = [c for c in el if _tag(c) in ("p", "table", "ul", "ol") or _tag(c) in HEADING_TAGS]
        # 含多个子块 -> 展开递归; 单一段落 -> 仍作为段落块
        if text_children:
            sub = []
            for c in list(el):
                sub.extend(_walk_el(c, depth+1, max_depth))
            return sub
        # 单纯 div 文本兜底
        if _text_of(el).strip():
            return [Block("text", html=f'<p class="diff-p">{_inner_html(el)}</p>',
                          title=_text_of(el)[:24])]
        return []

    if tag == "img":
        return [_make_image_block(el, [el])]

    if tag in ("br", "hr"):
        return []

    # 其他元素 -> 展开向下递归
    sub = []
    for c in list(el):
        sub.extend(_walk_el(c, depth+1, max_depth))
    if not sub and _text_of(el).strip():
        sub = [Block("text", html=f'<p class="diff-p">{html_escape(_text_of(el))}</p>',
                     title=_text_of(el)[:24])]
    return sub


def _inner_html(el) -> str:
    """元素 inner html 字符串 (text + children + children tail); 含直接文本的 p/li 也要拿到."""
    s = etree.tostring(el, encoding="unicode", with_tail=False)
    # 去掉外层 tag (e.g. <p class="x">...</p> -> ...), 含 <br/> 自闭合情形另算
    m = re.match(r"<([a-zA-Z\d]+)\b[^>]*>(.*)</\1>\s*$", s, re.DOTALL)
    if m:
        return m.group(2).strip()
    # 自闭合 / 空元素 -> ""
    return s.strip()


def _make_table_block(el) -> Block:
    """把它当作 data-table 渲染."""
    inner = _inner_html(el)
    # 强制 <table class="data-table">
    return Block("table", html=f'<table class="data-table">{inner}</table>',
                 title=_text_of(el)[:24] or "表格")


def _make_image_block(div_el, imgs) -> Block:
    """生成 image structure (image-block / image-caption)."""
    img_el = imgs[0]
    src = (img_el.get("src") or "").strip()
    alt = (img_el.get("alt") or "").strip()
    cap_search = div_el.xpath('.//div[contains(@class,"cap")]/text()')
    if not cap_search:
        cap_search = div_el.xpath('.//div[contains(@class,"caption")]/text()')
    caption = "".join(cap_search).strip() or alt
    img_html = f'<div class="image-block"><img src="{src}" alt="{alt}"/><div class="image-caption">{caption}</div></div>'
    return Block("image", html=img_html, title=caption or alt or "图片",
                 image={"src": src, "caption": caption, "alt": alt})


# ----------------------------- diff -----------------------------

def signature(block: Block) -> str:
    """用于段落对齐的稳定签名 (取 type + 内容前 80 字 + heading level)."""
    if block.type == "heading":
        # heading 抽文本内容做签名, 排除 inline 高亮标签
        text = re.sub(r"<[^>]+>", "", block.html)
        return f"H{block.level}|{text.strip()[:80]}"
    if block.type in ("text", "list"):
        text = re.sub(r"<[^>]+>", "", block.html)
        return f"T|{text.strip()[:80]}"
    if block.type == "table":
        return f"B|{re.sub(r'<[^>]+>','',block.html).strip()[:80]}"
    if block.type == "image":
        return f"I|{block.image.get('src','')}"
    return "?"


def diff_blocks(old_blocks, new_blocks, pid_prefix="ch"):
    """对齐两段 block 序列, 返回最终的 paragraphs 列表 (含 status / contentHtml / oldHtml / newHtml 等).

    pid 形如 `<chapterId>-p<seq>`, 跨章节唯一, 避免前端 findChapterIdOfParagraph 误中并列章节.
    """
    sm = difflib.SequenceMatcher(a=[signature(b) for b in old_blocks],
                                 b=[signature(b) for b in new_blocks],
                                 autojunk=False)
    out = []
    pid_counter = 0
    def next_pid():
        nonlocal pid_counter
        pid_counter += 1
        return f"{pid_prefix}-p{pid_counter}"

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            # 对齐到 equal, 但需检查 html 字符串是否一致以决定 keep / chg
            for idx in range(i2 - i1):
                ob = old_blocks[i1 + idx]
                nb = new_blocks[j1 + idx]
                if _exact_html(ob.html, nb.html):
                    out.append(_mk_keep(ob, next_pid()))
                else:
                    out.append(_mk_chg(ob, nb, next_pid()))
        elif tag == "delete":
            # old 中存在, new 中不存在 -> del
            for idx in range(i1, i2):
                out.append(_mk_del(old_blocks[idx], next_pid()))
        elif tag == "insert":
            for idx in range(j1, j2):
                out.append(_mk_add(new_blocks[idx], next_pid()))
        elif tag == "replace":
            # 简化策略: 按位置对齐 (若两边块数量相同); 多余的走 dele/add
            n_old = i2 - i1
            n_new = j2 - j1
            pairing = min(n_old, n_new)
            for k in range(pairing):
                ob = old_blocks[i1 + k]
                nb = new_blocks[j1 + k]
                out.append(_mk_chg(ob, nb, next_pid()))
            for k in range(pairing, n_old):
                out.append(_mk_del(old_blocks[i1 + k], next_pid()))
            for k in range(pairing, n_new):
                out.append(_mk_add(new_blocks[j1 + k], next_pid()))
    return out


def _exact_html(a: str, b: str) -> bool:
    a = re.sub(r"\s+", " ", a).strip()
    b = re.sub(r"\s+", " ", b).strip()
    return a == b


def _mk_keep(block, pid):
    """keep 段统一用 contentHtml; 任一侧可都用."""
    if block.type == "image":
        return _image_para(pid, block, "keep",
                           old_img=block, new_img=block)
    return {
        "id": pid, "type": block.type, "status": "keep",
        "level": block.level if block.type == "heading" else None,
        "title": block.title, "contentHtml": block.html,
    }


def _mk_del(block, pid):
    if block.type == "image":
        return _image_para(pid, None, "del", old_img=block)
    return {
        "id": pid, "type": block.type, "status": "del",
        "level": block.level if block.type == "heading" else None,
        "title": block.title,
        "oldHtml": block.html,
        "newHtml": '<div class="diff-empty">(新版本中已删除)</div>',
    }


def _mk_add(block, pid):
    if block.type == "image":
        return _image_para(pid, None, "add", new_img=block)
    return {
        "id": pid, "type": block.type, "status": "add",
        "level": block.level if block.type == "heading" else None,
        "title": block.title,
        "oldHtml": '<div class="diff-empty">(旧版本无此内容)</div>',
        "newHtml": block.html,
    }


def _mk_chg(old_block, new_block, pid):
    """生成 chg 段; text/heading/list 用行内 token diff 高亮; table 用 cell 级; image 走 image-block."""
    if old_block.type == "image" or new_block.type == "image":
        return _image_para(pid, None, "chg", old_img=old_block, new_img=new_block)

    if old_block.type == "table" and new_block.type == "table":
        o, n = diff_table_html(old_block.html, new_block.html)
        return {
            "id": pid, "type": "table", "status": "chg",
            "level": None, "title": old_block.title, "oldHtml": o, "newHtml": n,
        }

    # text/heading/list: token 化 + SequenceMatcher + 高亮 span 包装
    o = _inline_diff_html(old_block.html, new_block.html, side="old")
    n = _inline_diff_html(old_block.html, new_block.html, side="new")
    return {
        "id": pid, "type": new_block.type, "status": "chg",
        "level": new_block.level if new_block.type == "heading" else None,
        "title": new_block.title, "oldHtml": o, "newHtml": n,
    }


def _image_para(pid, _block_unused, status, old_img=None, new_img=None):
    """统一生成 image 段 (含 old/new image 信息)."""
    def cap(b): return b.image if b else {}
    oi, ni = cap(old_img), cap(new_img or {})
    return {
        "id": pid, "type": "image", "status": status,
        "level": None,
        "title": (oi.get("caption") or ni.get("caption") or "图片"),
        "oldImage": oi.get("src"), "newImage": ni.get("src"),
        "oldCaption": oi.get("caption"), "newCaption": ni.get("caption"),
        "oldHash": "", "newHash": "",
    }


# ----- inline highlight span wrapping for text/heading/list -----
TOKEN_RE = re.compile(r"(&[a-zA-Z#0-9]+;|<[^>]+>|.)", re.DOTALL)


def _tokenize_html(s: str):
    """token 化: HTML tag/entity 单 token, 单字符文本单 token."""
    return TOKEN_RE.findall(s)


def _inline_diff_html(old: str, new: str, side: str):
    """token diff -> html: oldHtml 内插入 del span, newHtml 内插入 add span.

    side="old" -> 接受 old html 为骨架; 标记 delete/replace 段为 <span class="del">
    side="new" -> 接受 new html 为骨架; 标记 insert/replace 段为 <span class="add">
    """
    if not old and not new:
        return ""
    a = _tokenize_html(old)
    b = _tokenize_html(new)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            out.extend(a[i1:i2] if side == "old" else b[j1:j2])
        elif tag == "delete":
            if side == "old":
                out.append('<span class="del">')
                out.extend(a[i1:i2])
                out.append("</span>")
            # new 侧忽略
        elif tag == "insert":
            if side == "new":
                out.append('<span class="add">')
                out.extend(b[j1:j2])
                out.append("</span>")
            # old 侧忽略
        elif tag == "replace":
            if side == "old":
                out.append('<span class="del">')
                out.extend(a[i1:i2])
                out.append("</span>")
            elif side == "new":
                out.append('<span class="add">')
                out.extend(b[j1:j2])
                out.append("</span>")
    return "".join(out)


# ----- table diff cell-level coloring -----
def diff_table_html(old_t: str, new_t: str):
    """行对齐 + unit cell level coloring; 输出含 cell-add/del/chg class 的 old/new 表 HTML."""
    try:
        old_root = lxml_html.fromstring(old_t)
        new_root = lxml_html.fromstring(new_t)
    except Exception:
        return old_t, new_t
    # 找 tbody (或直接 rows)
    def rows(root):
        tb = root.find(".//tbody")
        if tb is not None:
            return [r for r in tb if _tag(r) == "tr"]
        return [r for r in root.iter() if _tag(r) == "tr"]
    def cell_text(tr):
        return [re.sub(r"\s+", " ", _text_of(td)).strip()
                for td in tr if _tag(td) in ("td", "th")]
    o_rows = rows(old_root)
    n_rows = rows(new_root)
    # 直接按序对齐 (同位置 -> 比较 cell)
    n_max = max(len(o_rows), len(n_rows))
    out_old_rows = []
    out_new_rows = []
    for k in range(n_max):
        if k < len(o_rows) and k < len(n_rows):
            orow = list(o_rows[k])
            nrow = list(n_rows[k])
            # 比较 row cell 文本 -> 标 chg
            o_em = []; n_em = []
            oc = len([c for c in orow if _tag(c) in ("td","th")])
            nc = len([c for c in nrow if _tag(c) in ("td","th")])
            jj = max(oc, nc)
            for kk in range(jj):
                if kk >= oc:
                    # new 专属 cell -> cell-add
                    e = nrow[kk]
                    _add_cell_class(e, "cell-add")
                    continue
                if kk >= nc:
                    # old 专属: cell-del (仍保留在 old)
                    e = orow[kk]
                    _add_cell_class(e, "cell-del")
                    continue
                ocell = orow[kk]; ncell = nrow[kk]
                if cell_equal(ocell, ncell):
                    _clear_cell_class(ocell); _clear_cell_class(ncell)
                else:
                    _add_cell_class(ocell, "cell-del")
                    _add_cell_class(ncell, "cell-add")
            out_old_rows.append(orow); out_new_rows.append(nrow)
        elif k < len(o_rows):
            # 仅 old 有
            for c in o_rows[k]:
                if _tag(c) in ("td","th"):
                    _add_cell_class(c, "cell-del")
            out_old_rows.append(list(o_rows[k]))
        elif k < len(n_rows):
            for c in n_rows[k]:
                if _tag(c) in ("td","th"):
                    _add_cell_class(c, "cell-add")
            out_new_rows.append(list(n_rows[k]))
    out_old = _rebuild_table(old_root, out_old_rows)
    out_new = _rebuild_table(new_root, out_new_rows)
    return out_old, out_new


def cell_equal(a, b):
    sa = re.sub(r"\s+", " ", _text_of(a)).strip()
    sb = re.sub(r"\s+", " ", _text_of(b)).strip()
    return sa == sb


def _add_cell_class(el, cls):
    cur = (el.get("class") or "").split()
    if cls not in cur:
        cur.append(cls)
    el.set("class", " ".join(cur))


def _clear_cell_class(el):
    if el.get("class"):
        del el.attrib["class"]


def _rebuild_table(root, rows_list):
    tb = root.find(".//tbody")
    if tb is not None:
        # 清空再 append
        for child in list(tb):
            tb.remove(child)
        for r in rows_list:
            tb.append(_row_from(r))
    else:
        # 没有 tbody, rows 直接挂在 root 下
        for child in list(root):
            if _tag(child) == "tr":
                root.remove(child)
        for r in rows_list:
            root.append(_row_from(r))
    s = etree.tostring(root, encoding="unicode")
    # 去除 xmlns 属性序列化产物
    s = s.replace(' xmlns:html="http://www.w3.org/1999/xhtml"', "").replace(' xmlns="http://www.w3.org/1999/xhtml"', "")
    return s


def _row_from(cells_list):
    """将 lxml cell 元素列表合并到新的 <tr> (不复制元素本身, append 复用)."""
    tr = etree.Element("tr")
    for c in cells_list:
        if _tag(c) in ("td","th"):
            tr.append(c)  # lxml appends by reference
    return tr


# ----------------------------- 图片资源处理 -----------------------------

class AssetImageResolver:
    """把章节 html 内 ${URL_PREFIX}//resources//xxx.svg 解析为相对 report 的图片路径, 并拷贝文件."""
    def __init__(self, hedex_dir: Path, out_dir: Path, url_prefix="assets/images/hedex"):
        self.hedex = hedex_dir
        self.out = out_dir
        self.url_prefix = url_prefix
        self.copied = set()
        out_dir.mkdir(parents=True, exist_ok=True)

    def resolve_src(self, src: str):
        if not src:
            return src
        m = URL_PREFIX_RE.match(src)
        if not m:
            # 已是普通 url -> 不动
            return src
        filename = m.group(1)
        # 找源文件
        cand = self.hedex / "resources" / filename
        if not cand.exists():
            cand = self.hedex / filename
        out_path = self.out / filename
        if cand.exists():
            if out_path not in self.copied:
                shutil.copyfile(cand, out_path)
                self.copied.add(out_path)
            return f"{self.url_prefix}/{filename}"
        # 文件不存在, 仍然替换为相对路径 (后续渲染时浏览器 BrokenImg)
        return f"{self.url_prefix}/{filename}"

    def sha1_of(self, src: str):
        """取 URL_PREFIX 之外绝对路径对应的的 sha1, 不可知时返回 None."""
        m = URL_PREFIX_RE.match(src or "")
        if not m:
            return None
        fname = m.group(1)
        cand = self.hedex / "resources" / fname
        if not cand.exists():
            cand = self.hedex / fname
        if not cand.exists():
            return None
        return hashlib.sha1(cand.read_bytes()).hexdigest()[:12]


# ----------------------------- 渲染输出 -----------------------------

def render_tree(node: ChapterNode):
    """把章节节点转为 DIFF_DATA.chapters 子项 (recursive)."""
    children = [render_tree(c) for c in node.children if _node_visible(c)]
    return {
        "id": node.id,
        "title": node.title,
        "status": node.status,
        "bridge": bool(getattr(node, "bridge", False)),
        "children": children,
    }


def _node_visible(node):
    return bool(node.id) or any(_node_visible(c) for c in node.children)


def collect_paragraphs(node: ChapterNode, resolver: AssetImageResolver):
    """根据 old/new entry 解析并 diff 段落, 复用到 dict node.id -> [block dictionaries].

    pid 前缀用本节点 id (e.g. 'ch1-1-1'), 输出 `<cid>-p<seq>`,
    保证跨章节唯一, 避免前端 findChapterIdOfParagraph 误中并列章节.
    """
    old_e = node.old_entry
    new_e = node.new_entry
    if not old_e and not new_e:
        return None  # 无 entry -> 无 paragraphs
    has_old = bool(node.old_entry)
    has_new = bool(node.new_entry)
    pid_prefix = node.id or "ch"
    if has_old and has_new:
        old_blocks = parse_blocks(old_e["html"])
        new_blocks = parse_blocks(new_e["html"])
        paras = diff_blocks(old_blocks, new_blocks, pid_prefix=pid_prefix)
    elif has_old:
        paras = [_mk_del(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(parse_blocks(old_e["html"]))]
    elif has_new:
        paras = [_mk_add(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(parse_blocks(new_e["html"]))]
    else:
        paras = []

    # 处理图片 url 替换 + 计算 old/new hash
    for p in paras:
        if p.get("type") == "image":
            old = p.get("oldImage"); new = p.get("newImage")
            if old:
                p["oldImage"] = resolver.resolve_src(old)
                h = resolver.sha1_of(old); p["oldHash"] = h or p["oldHash"] or ""
            if new:
                p["newImage"] = resolver.resolve_src(new)
                h = resolver.sha1_of(new); p["newHash"] = h or p["newHash"] or ""
    return paras


def collect_all_paragraphs(root: ChapterNode, resolver):
    out = {}
    stack = [root]
    while stack:
        n = stack.pop()
        if n.id:
            ps = collect_paragraphs(n, resolver)
            if ps is not None:
                out[n.id] = ps
        for c in n.children:
            stack.append(c)
    return out


def calc_stats(root: ChapterNode):
    """统计有内容章节 (非 bridge) 中各状态 count -> meta.stats."""
    counts = {"add": 0, "del": 0, "chg": 0}
    def walk(n):
        if n.id and not getattr(n, "bridge", False):
            if n.status in counts: counts[n.status] += 1
        for c in n.children:
            walk(c)
    walk(root)
    return counts


# ----------------------------- main -----------------------------

def main(argv=None):
    p = argparse.ArgumentParser(prog="generate_report.py")
    p.add_argument("--old", required=True, help="旧版本 JSON (文件或目录)")
    p.add_argument("--new", required=True, help="新版本 JSON (文件或目录)")
    p.add_argument("--hedex", default="data/parse/hedex",
                   help="解压后的 hedex 目录 (含 resources/)")
    p.add_argument("--out", default="report/data/diff-data.js",
                   help="输出 JS 文件路径")
    p.add_argument("--assets", default="report/assets/images/hedex",
                   help="图片资源输出目录")
    p.add_argument("--name", default="5G RAN 特性文档 版本对比",
                   help="报告中显示的标题")
    p.add_argument("--old-version", default=None,
                   help="旧版本标签 (默认从 path 自动嗅探)")
    p.add_argument("--new-version", default=None,
                   help="新版本标签 (默认从 path 自动嗅探)")
    args = p.parse_args(argv)

    repo = Path(__file__).resolve().parent.parent
    old = load_entries(str(Path(args.old)))
    new = load_entries(str(Path(args.new)))
    if not old and not new:
        print("ERROR: neither old nor new has entries", file=sys.stderr); return 2

    # 嗅探版本名 (取 path 第一个 segment)
    def sniff_version(entries, fallback):
        for e in entries:
            m = VERSION_RE.match(e["path"].strip())
            if m:
                return m.group(1).replace("  ", " ")
        return fallback
    old_ver = args.old_version or sniff_version(old, "OLD")
    new_ver = args.new_version or sniff_version(new, "NEW")

    # 构建树 + 状态
    root = build_tree(old, new)
    assign_ids(root)
    determine_tree_status(root)

    # 资源解析器
    hedex_dir = (repo / args.hedex) if not Path(args.hedex).is_absolute() else Path(args.hedex)
    out_dir = (repo / args.assets) if not Path(args.assets).is_absolute() else Path(args.assets)
    resolver = AssetImageResolver(hedex_dir, out_dir)

    chapters = [render_tree(c) for c in root.children if _node_visible(c)]
    paragraphs_by_chapter = collect_all_paragraphs(root, resolver)
    stats = calc_stats(root)
    img_count = sum(1 for ps in paragraphs_by_chapter.values() for p in ps if p.get("type") == "image")
    stats["img"] = img_count

    DiffData = {
        "meta": {
            "name": args.name,
            "oldVersion": old_ver,
            "newVersion": new_ver,
            "generatedAt": _now_str(),
            "sourceDoc": f"5G RAN 特性文档 ({old_ver} → {new_ver})",
            "stats": stats,
        },
        "chapters": chapters,
        "paragraphsByChapter": paragraphs_by_chapter,
    }

    out_path = (repo / args.out) if not Path(args.out).is_absolute() else Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(DiffData, ensure_ascii=False, indent=2)
    out_path.write_text(
        "/**\n"
        " * 本文件由 scripts/generate_report.py 自动生成, 请勿手工编辑.\n"
        " * 输入: data/parse/json/<OLD_VER> 与 <NEW_VER> 下的章节 JSON;\n"
        " * 输出: window.DIFF_DATA, 供 report/index.html 渲染.\n"
        " */\n"
        "window.DIFF_DATA = " + body + ";\n",
        encoding="utf-8"
    )
    print(f"OK: wrote {out_path}")
    print(f"    chapters: {len(chapters)}")
    print(f"    paragraphsByChapter keys: {len(paragraphs_by_chapter)}")
    print(f"    stats: {stats}")
    return 0


def _now_str():
    import datetime
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")


if __name__ == "__main__":
    sys.exit(main())
