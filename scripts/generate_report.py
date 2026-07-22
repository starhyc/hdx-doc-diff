#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HDX 文档版本对比报告生成器

输入 (mock 或真实数据)：
  --old DIR|FILE     旧版本数据: 已解析的章节 JSON (字段 titleStr / path / html),
                     可以是目录 (递归载入其中所有 .json) 或单个 .json 文件。
  --new DIR|FILE     新版本数据, 同上。
  --hedex DIR        解压后的 hedex 资源目录, 旧新版本公用时的默认值
  --hedex-old DIR     旧版本 hedex 资源目录 (不指定则用 --hedex)
  --hedex-new DIR     新版本 hedex 资源目录 (不指定则用 --hedex)
  --no-images         跳过图片块解析和资源拷贝, 报告中不展示图片
  --out-dir DIR      报告输出目录 (默认 output/); 模板(report/)+数据+图片都拷进去。
  --filter FILE      过滤配置 JSON (path/heading 黑/白名单; 命中的层级仅展示不对比)。
  --log-level LVL    DEBUG / INFO / WARN (默认 INFO)。
  --name STR         报告显示标题。
  --old-version STR  强制指定 OLD 版本标签 (默认从 path 嗅探)。
  --new-version STR  同上。

输出:
  <out-dir>/
    index.html                              # 从 report/ 拷贝
    css/  js/                                # 从 report/ 拷贝 (模板本身不动)
    data/diff-data.js                        # window.DIFF_DATA = {meta, chapters, paragraphsByChapter};
    assets/images/hedex/                     # 解析引用拷贝过来的资源

数据处理流程:
  1. 载入 OLD / NEW 章节; 用 strip_version() 过滤 path 中的版本前缀
     (例如 "5G RAN10.1 特性文档 > 文档包信息" -> "特性文档 > 文档包信息")
  2. 按 path 的 ">" 层级构建章节树 (chunks 不带版本前缀, 跨版本归一化对齐)
  3. 对每个章节按 old/new 是否存在与 Filter 命中, 决定 status (add/del/keep/chg/skip)
  4. 解析每个章节 html 提取段落块 (heading/text/table/list/image)
  5. 对 old/new 都存在、未 skip 的章节做 para-级差对齐并产生 oldHtml/newHtml 高亮内容
  6. 把图片引用拷贝到输出目录, 缺失资源仅 WARN 不阻断, 前端用占位文案渲染
  7. 串行化为 DiffData 并写入输出目录
"""
import argparse
import datetime
import difflib
import fnmatch
import hashlib
import json
import logging
import os
import re
import requests
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from html import escape as html_escape, unescape as html_unescape
from pathlib import Path
from lxml import etree, html as lxml_html

# ----------------------------- 日志 -----------------------------

log = logging.getLogger("generate_report")


def setup_logging(level):
    """配置根 logger, console 输出到 stderr."""
    if isinstance(level, str):
        lvl = getattr(logging, level.upper(), logging.INFO)
    else:
        lvl = level
    logging.basicConfig(
        level=lvl,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )


def _human_size(nbytes: int) -> str:
    """字节数转为可读字符串."""
    if nbytes < 1024:
        return f"{nbytes} B"
    for unit in ("KB", "MB", "GB", "TB"):
        nbytes /= 1024.0
        if nbytes < 1024:
            return f"{nbytes:.1f} {unit}"
    return f"{nbytes:.1f} PB"


# ----------------------------- 常量 -----------------------------

# 版本前缀正则: 形如 "5G RAN10.1", "5G RAN10.1.0", "5G RAN 10.1"...
VERSION_RE = re.compile(r"^\s*(\d+G\s*RAN\s*\d+\.\d+(?:\.\d+)?)\s+", re.IGNORECASE)

# ${URL_PREFIX}//resources//abc.svg
URL_PREFIX_RE = re.compile(r"\$\{URL_PREFIX\}\/\/resources\/\/([^\"'\s>]+)")

# 新增 skip 状态: 与 keep/add/del/chg 同级, 表示 Filter 跳过差异 (仅展示内容)
SKIP_STATUS = "skip"

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

    路径不存在或无权访问时不会抛异常, 而是 WARN 并返回空列表.
    """
    p = Path(arg)
    files = []
    if not p.exists():
        log.warning("input path does not exist: %s", arg)
        return []
    if p.is_dir():
        files = sorted(p.rglob("*.json"))
        if not files:
            log.warning("no .json files found under: %s", arg)
            return []
    elif p.is_file():
        files = [p]
    else:
        log.warning("input is neither file nor directory: %s", arg)
        return []

    entries = []
    for f in files:
        try:
            _load_one_file(f, entries)
        except PermissionError as e:
            log.warning("permission denied reading %s: %s", f, e)
        except OSError as e:
            log.warning("read error for %s: %s", f, e)
    return entries


def _load_one_file(f: Path, entries: list):
    """读取单个 JSON 文件, 用 raw_decode 迭代消费顶层 JSON 值, 兼容大文件与多值拼接.

    增强调试日志:
      - 文件大小 (可读格式)
      - 读取耗时
      - 解析进度百分比 (大文件 > 1 MB 时每解析 5% 字节位置打印一次)
      - 总耗时与跳过错误数
    """
    t_start = time.time()
    try:
        fsize = f.stat().st_size if f.exists() else 0
    except OSError:
        fsize = 0
    log.info("loading %s (%s)", f, _human_size(fsize) if fsize else "unknown size")
    try:
        text = f.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        log.warning("decode utf-8-sig failed for %s, fallback to utf-8 ignore", f)
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError as e:
            log.warning("read %s failed (fallback): %s", f, e); return 0
    except OSError as e:
        log.warning("read %s failed: %s", f, e); return 0
    t_read = time.time()
    decoder = json.JSONDecoder()
    idx, n = 0, len(text)
    count = 0
    skipped_count = 0
    max_block_dbg = 50
    # 大文件 (> 1 MB) 额外按字节百分比打印进度
    large_file = n > 1_048_576
    pct_step = max(n // 20, 1)  # 每 5%
    next_pct_mark = pct_step if large_file else n + 1
    while idx < n:
        # 跳过空白与常见分隔字符
        while idx < n and text[idx] in " \t\r\n,":
            idx += 1
        if idx >= n:
            break
        # 进度百分比日志 (大文件)
        if large_file and idx >= next_pct_mark:
            pct = idx * 100 // n
            elapsed = time.time() - t_read
            rate = idx / elapsed / 1024 / 1024 if elapsed > 0 else 0
            log.debug("  parse progress: %d%% (%s / %s), parsed %d values, %.1f MB/s",
                      pct, _human_size(idx), _human_size(n), count, rate)
            next_pct_mark = idx + pct_step
        try:
            value, end = decoder.raw_decode(text, idx)
        except json.JSONDecodeError as e:
            log.warning("skip %s: JSONDecodeError at char %d (%d%%): %s",
                        f, idx, idx * 100 // max(n, 1), e)
            skipped_count += 1
            # 从失败位置附近往后找下一个 '{' 或 '[' 再继续
            nxt = min(n, idx + 1)
            while nxt < n and text[nxt] not in "{[":
                nxt += 1
            idx = nxt
            continue
        prev_len = len(entries)
        _emit_value(value, f, entries)
        appended = len(entries) - prev_len
        count += 1
        if log.isEnabledFor(logging.DEBUG) and (count % max_block_dbg == 0 or count == 1):
            log.debug("  parsed value #%d at char %d-%d (appended %d entries)", count, idx, end, appended)
        idx = end
    t_total = time.time()
    t_read_elapsed = t_read - t_start
    t_parse_elapsed = t_total - t_read
    t_all = t_total - t_start
    if log.isEnabledFor(logging.DEBUG) or t_all > 5:
        log.info("  %s: read %.1fs, parsed %d values in %.1fs, total %.1fs (skipped %d decode errors)",
                 f.name, t_read_elapsed, count, t_parse_elapsed, t_all, skipped_count)
    if count == 0:
        log.warning("%s 没解析到任何 JSON 值", f)
    else:
        log.info("  %s -> %d top-level value(s), total entries so far: %d", f, count, len(entries))
    return count


def _emit_value(value, src: Path, entries: list):
    """把单个顶层 JSON 值展开为 entry 列表附加进去.
    只接受含 titleStr / path / html 至少之一的 dict (避免吞掉 sentinel/garbage).
    html 字段必须以 <html 开头, 否则视为非文档片段 (如递归/导航节点) 并丢弃."""
    pushed = 0
    sentinel_dropped = 0
    html_dropped = 0
    def push(item):
        nonlocal pushed, sentinel_dropped, html_dropped
        if not isinstance(item, dict):
            return
        if not any(k in item for k in ("titleStr", "path", "html")):
            sentinel_dropped += 1
            return
        # 丢弃 html 不是完整文档的条目 (如 <div></div> 递归片段)
        if not _is_valid_html(item.get("html", "")):
            html_dropped += 1
            return
        entries.append(_normalize_entry(item, src))
        pushed += 1
    if isinstance(value, dict):
        if "chapters" in value and isinstance(value["chapters"], list):
            for c in value["chapters"]:
                push(c)
        else:
            push(value)
    elif isinstance(value, list):
        for c in value:
            push(c)
    if log.isEnabledFor(logging.DEBUG):
        if sentinel_dropped:
            log.debug("  dropped %d sentinel/garbage dict(s) in %s", sentinel_dropped, src)
        if html_dropped:
            log.debug("  dropped %d non-document html fragment(s) in %s", html_dropped, src)
    if html_dropped:
        log.info("  filtered %d non-document html entries in %s", html_dropped, src)


def _is_valid_html(html_str: str) -> bool:
    """html 字段必须以 <html 开头 (大小写不敏感), 筛选掉递归/导航等非文档片段."""
    if not html_str or not html_str.strip():
        return False
    return html_str.strip().lower().startswith("<html")


def _normalize_entry(raw, src):
    """规范化单条 entry, 至少保证含 titleStr / path / html 字段."""
    raw = dict(raw)  # shallow copy
    raw.setdefault("titleStr", "")
    raw.setdefault("path", "")
    raw.setdefault("html", "")
    raw["_src"] = str(src)
    return raw


# ----------------------------- 过滤器 (path / heading 黑/白名单) -----------------------------

class Filter:
    """配置示例 filter.json:
    {
      "pathWhitelist":      [],          # 为空 = 不启用白名单
      "pathBlacklist":      ["接口与流量"],
      "headingWhitelist":   [],
      "headingBlacklist":   ["修订历史", "第*节:*"],
      "maxHeadingLevel":    0            # 0=展示全部标题层级; N>0=仅展示 h1~hN
    }

    匹配规则:
      - 默认模糊包含: "修订历史" 自动匹配 "*修订历史*"
      - 匹配时忽略空格: "目  录" 可命中 "目录"
      - 仍支持 * 通配符做更精细的 pattern: "第*节:*"

    命中黑名单 (或白名单存在但未命中) 的层级 -> status=skip:
      - 章节跳过对比, 但章节树仍展示该路径 (左侧)
      - heading 跳过对比, 中栏与右栏仍展示该 heading 与其后段落 (按 keep 风格)
    maxHeadingLevel 控制中栏展示的标题层级数, 0 表示不限制.
    全部为空时, Filter 不生效 (等价于不禁用任何层级).
    """
    def __init__(self, cfg=None):
        cfg = cfg or {}
        self.path_wh = cfg.get("pathWhitelist", []) or []
        self.path_bl = cfg.get("pathBlacklist", []) or []
        self.heading_wh = cfg.get("headingWhitelist", []) or []
        self.heading_bl = cfg.get("headingBlacklist", []) or []
        self.max_heading_level = cfg.get("maxHeadingLevel", 0) or 0  # 0=展示全部标题层级
        # 编译为 fnmatch translate 正则
        self.path_wh_re = [self._compile(p) for p in self.path_wh]
        self.path_bl_re = [self._compile(p) for p in self.path_bl]
        self.heading_wh_re = [self._compile(p) for p in self.heading_wh]
        self.heading_bl_re = [self._compile(p) for p in self.heading_bl]
        self.active = any([self.path_wh, self.path_bl, self.heading_wh, self.heading_bl])
        log.debug("Filter init: pathWh=%s pathBl=%s headingWh=%s headingBl=%s maxHeadingLevel=%s active=%s",
                 self.path_wh, self.path_bl, self.heading_wh, self.heading_bl, self.max_heading_level, self.active)

    @staticmethod
    def _compile(pat):
        # 去掉空格后自动前后加 * → 默认模糊包含匹配
        pat = re.sub(r'\s+', '', pat)
        pat = f'*{pat}*'
        return re.compile(fnmatch.translate(pat))

    @staticmethod
    def _any_match(s, regs):
        # 目标字符串去掉空格再匹配 (兼容 "目  录" 这类含多余空格文本)
        s = re.sub(r'\s+', '', s)
        return any(r.fullmatch(s) for r in regs)

    def should_skip_path(self, stripped_path: str) -> bool:
        """章节是否跳过对比 (status=skip)."""
        if not self.active:
            return False
        if self.path_bl_re and self._any_match(stripped_path, self.path_bl_re):
            return True
        if self.path_wh_re and not self._any_match(stripped_path, self.path_wh_re):
            return True
        return False

    def should_skip_heading(self, heading_title: str) -> bool:
        """heading 是否跳过对比 (status=skip, 含其下所有段落)."""
        if not self.active:
            return False
        if self.heading_bl_re and self._any_match(heading_title, self.heading_bl_re):
            return True
        if self.heading_wh_re and not self._any_match(heading_title, self.heading_wh_re):
            return True
        return False


def load_filter(path=None):
    """加载 filter 配置; 未给定 path -> 默认无过滤."""
    if not path:
        return Filter()
    p = Path(path)
    if not p.is_file():
        log.warning("filter file not found: %s (will skip filtering)", p)
        return Filter()
    try:
        cfg = json.loads(p.read_text(encoding="utf-8-sig"))
    except Exception as e:
        log.error("filter file %s parse failed: %s (will skip filtering)", p, e)
        return Filter()
    if not isinstance(cfg, dict):
        log.error("filter cfg top-level must be object: %s", p)
        return Filter()
    f = Filter(cfg)
    log.info("filter loaded from %s: pathWh=%s pathBl=%s headingWh=%s headingBl=%s",
             p, f.path_wh, f.path_bl, f.heading_wh, f.heading_bl)
    return f


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
    """比较两段 HTML 的可见文本是否相同 (忽略标签/属性/空白差异)."""
    return _text_of_html(a) == _text_of_html(b)


# ----------------------------- 并行 worker -----------------------------

def _worker_parse_chapter(args):
    """Worker: 纯 CPU 的段落解析 + diff, 返回 (node_id, paras). 用于多进程并行."""
    node_id, old_html, new_html, has_old, has_new, pid_prefix, node_status, filter_cfg, no_images = args
    heading_filter = Filter(filter_cfg) if filter_cfg else None
    # path 过滤命中 → 全部段落标记为 skip, 不运行 diff
    if node_status == "skip":
        source_html = new_html if has_new else old_html
        blocks = parse_blocks(source_html, no_images=no_images)
        paras = [_mk_skip(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(blocks)]
        return (node_id, paras)
    if has_old and has_new:
        old_blocks = parse_blocks(old_html, no_images=no_images)
        new_blocks = parse_blocks(new_html, no_images=no_images)
        paras = diff_blocks(old_blocks, new_blocks, pid_prefix=pid_prefix, heading_filter=heading_filter)
    elif has_old:
        paras = [_mk_del(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(parse_blocks(old_html, no_images=no_images))]
    elif has_new:
        paras = [_mk_add(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(parse_blocks(new_html, no_images=no_images))]
    else:
        paras = []
    return (node_id, paras)


def _filter_to_cfg(filter_obj):
    """提取 Filter 的原始配置 dict, 供 worker 进程重建."""
    if filter_obj is None:
        return None
    return {
        "pathWhitelist": filter_obj.path_wh,
        "pathBlacklist": filter_obj.path_bl,
        "headingWhitelist": filter_obj.heading_wh,
        "headingBlacklist": filter_obj.heading_bl,
    }


def _resolve_images_in_paras(paras, resolver_old, resolver_new):
    """处理图片 url 替换 + 计算 old/new hash (需文件 I/O, 串行执行)."""
    for p in paras:
        if p.get("type") == "image":
            old = p.get("oldImage"); new = p.get("newImage")
            if old:
                p["oldImage"] = resolver_old.resolve_src(old)
                h = resolver_old.sha1_of(old); p["oldHash"] = h or p["oldHash"] or ""
            if new:
                p["newImage"] = resolver_new.resolve_src(new)
                h = resolver_new.sha1_of(new); p["newHash"] = h or p["newHash"] or ""
    return paras


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
    """lxml 元素 tag 去掉命名空间前缀; 非标准元素返回空串."""
    try:
        t = el.tag
    except Exception:
        return ""
    if isinstance(t, str):
        return t.split("}", 1)[-1].lower()
    return ""


def _text_of(el) -> str:
    """元素的全部直系文本, 用于段落标题摘要与签名."""
    try:
        parts = list(el.itertext())
        return "".join(parts).strip()
    except Exception:
        return ""


def _serialize(el):
    """把 lxml 元素序列化为字符串 (含自身)."""
    try:
        return etree.tostring(el, encoding="unicode", with_tail=False).strip()
    except Exception:
        return ""


def parse_blocks(html_str: str, no_images: bool = False):
    """解析章节 html 字符串, 抽取段落块列表 (按文档顺序).

    no_images=True 时跳过所有图片块 (不生成 image 类型的 Block).
    """
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
        blocks.extend(_walk_el(child, depth=0, no_images=no_images))
    if not blocks and _text_of(doc).strip():
        blocks = [Block("text", html=f'<p class="diff-p">{html_escape(_text_of(doc))}</p>',
                        title=_text_of(doc)[:20])]
    return blocks


def _has_text_descendant(el):
    """检查元素及其后代是否包含文字承载元素 (heading/p/table/ul/ol).
    用于 div 处理: 即使没有直接文字子块, 深层嵌套 div 中的文字/标题也不应被吞掉."""
    for child in el.iter():
        if not isinstance(child.tag, str):
            continue
        t = _tag(child)
        if t in ("p", "table", "ul", "ol") or t in HEADING_TAGS:
            return True
    return False


# 块级标签: 在收集 div 内联前缀时, 这些标签作为内联/块级的分界线
_BLOCK_TAGS = {"p", "table", "ul", "ol", "div"} | set(HEADING_TAGS.keys())


def _first_block_child_index(el):
    """返回第一个块级子元素索引 (div/p/table/ul/ol/heading), 若无则返回 None."""
    for i, c in enumerate(list(el)):
        if _tag(c) in _BLOCK_TAGS:
            return i
    return None


def _collect_inline_prefix(el):
    """收集 div 中第一个块级子元素之前的全部内联内容 (直接文本 + 内联子元素 + tail).
    返回内联 HTML 字符串, 无内容时返回空字符串."""
    first_block = _first_block_child_index(el)
    children = list(el)
    inline_children = children[:first_block] if first_block is not None else children
    parts = [el.text or ""]
    for c in inline_children:
        parts.append(etree.tostring(c, encoding="unicode", with_tail=False))
        if c.tail:
            parts.append(c.tail)
    return "".join(parts).strip()


def _emit_inline_prefix_block(el, result_list):
    """若 div 的第一个块级子元素前有内联内容, 将其作为 Block('text') 输出."""
    prefix = _collect_inline_prefix(el)
    if prefix:
        text = re.sub(r'<[^>]+>', '', prefix).strip()
        if not text:
            return  # 去掉标签后无可视文本 → 跳过 (纯 anchor/空标签)
        result_list.append(Block("text",
            html=f'<p class="diff-p">{prefix}</p>',
            title=text[:24] or "段落"))


def _walk_el(el, depth=0, max_depth=8, no_images=False):
    """递归把 HTML 元素映射为 Block; 仅在 multi-content (div 包含若干) 时展开.

    no_images=True 时跳过 <img> 标签和仅有图片的 div.
    """
    if depth > max_depth:
        return []
    # 跳过注释和 PI 节点 (lxml HtmlComment.tag 是 callable, 不是 str)
    if not isinstance(el.tag, str):
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
        # 先检查是否有文字子块 (heading/p/table/ul/ol), 避免含图片的 div 吞掉所有内容
        text_children = [c for c in el if _tag(c) in ("p", "table", "ul", "ol") or _tag(c) in HEADING_TAGS]
        if text_children:
            # 有文字子块 → 展开递归 (嵌套 img 也会被 _walk_el 递归到)
            # 先收集第一个块级子元素前的内联内容 (避免直接文本/内联子元素被吞掉)
            sub = []
            _emit_inline_prefix_block(el, sub)
            first_block = _first_block_child_index(el)
            for i, c in enumerate(list(el)):
                if first_block is not None and i < first_block:
                    continue  # 已作为内联前缀处理
                sub.extend(_walk_el(c, depth+1, max_depth, no_images=no_images))
            return sub
        # 即使没有直接文字子块, 也要检查深层后代是否包含文字元素.
        # 例如: <div class="topicbody"><div class="section"><h3>...</h3></div></div>
        # 如果不递归, h3 会被下面的 image fallback 或 text fallback 吞掉.
        if _has_text_descendant(el):
            sub = []
            _emit_inline_prefix_block(el, sub)
            first_block = _first_block_child_index(el)
            for i, c in enumerate(list(el)):
                if first_block is not None and i < first_block:
                    continue  # 已作为内联前缀处理
                sub.extend(_walk_el(c, depth+1, max_depth, no_images=no_images))
            return sub
        # div 仅有图片无文字子块 → 纯图片块 (no_images 时跳过)
        if not no_images:
            imgs = el.xpath('.//img')
            if imgs:
                return [_make_image_block(el, imgs)]
        # 纯 div 文本兜底
        if _text_of(el).strip():
            return [Block("text", html=f'<p class="diff-p">{_inner_html(el)}</p>',
                          title=_text_of(el)[:24])]
        return []

    if tag == "img":
        if no_images:
            return []
        return [_make_image_block(el, [el])]

    if tag in ("br", "hr", "script", "style", "noscript", "meta", "link"):
        return []

    # 其他元素 -> 展开向下递归
    sub = []
    for c in list(el):
        sub.extend(_walk_el(c, depth+1, max_depth, no_images=no_images))
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


def diff_blocks(old_blocks, new_blocks, pid_prefix="ch", heading_filter=None):
    """对齐两段 block 序列, 返回最终的 paragraphs 列表 (含 status / contentHtml / oldHtml / newHtml 等).

    pid 形如 `<chapterId>-p<seq>`, 跨章节唯一, 避免前端 findChapterIdOfParagraph 误中并列章节.

    如果 heading_filter 不为 None, 对每个 heading 调用 should_skip_heading(title),
    命中的 heading 与其下到下一个同级/上级 heading 之间的所有段落都标记为 skip.
    """
    sm = difflib.SequenceMatcher(a=[signature(b) for b in old_blocks],
                                 b=[signature(b) for b in new_blocks],
                                 autojunk=False)
    raw_paras = []
    pid_counter = 0
    def next_pid():
        nonlocal pid_counter
        pid_counter += 1
        return f"{pid_prefix}-p{pid_counter}"

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for idx in range(i2 - i1):
                ob = old_blocks[i1 + idx]
                nb = new_blocks[j1 + idx]
                if _exact_html(ob.html, nb.html):
                    raw_paras.append(_mk_keep(ob, next_pid()))
                else:
                    raw_paras.append(_mk_chg(ob, nb, next_pid()))
        elif tag == "delete":
            for idx in range(i1, i2):
                raw_paras.append(_mk_del(old_blocks[idx], next_pid()))
        elif tag == "insert":
            for idx in range(j1, j2):
                raw_paras.append(_mk_add(new_blocks[idx], next_pid()))
        elif tag == "replace":
            n_old = i2 - i1
            n_new = j2 - j1
            pairing = min(n_old, n_new)
            for k in range(pairing):
                ob = old_blocks[i1 + k]
                nb = new_blocks[j1 + k]
                # 去空白后可能完全一致 → 降级为 keep 而非 chg
                if _exact_html(ob.html, nb.html):
                    raw_paras.append(_mk_keep(nb, next_pid()))
                else:
                    raw_paras.append(_mk_chg(ob, nb, next_pid()))
            for k in range(pairing, n_old):
                raw_paras.append(_mk_del(old_blocks[i1 + k], next_pid()))
            for k in range(pairing, n_new):
                raw_paras.append(_mk_add(new_blocks[j1 + k], next_pid()))

    # 后处理: heading filter 应用
    if heading_filter is not None and heading_filter.active:
        out = _apply_heading_filter(raw_paras, heading_filter)
    else:
        out = raw_paras
    return out


def _apply_heading_filter(raw_paras, heading_filter):
    """遍历 raw_paras, 对每个 heading 与其下属段落标记 skip."""
    result = []
    in_skip_scope = False
    skip_level = None
    for p in raw_paras:
        if p.get("type") == "heading":
            lvl = p.get("level")
            # headingBlacklist 只对 level-1 标题生效
            if lvl == 1:
                should_skip = heading_filter.should_skip_heading(p.get("title", ""))
                if should_skip:
                    in_skip_scope = True
                    skip_level = lvl
                else:
                    in_skip_scope = False
                    skip_level = None
            elif in_skip_scope and skip_level is not None and lvl is not None and lvl <= skip_level:
                # 遇到同级或上级标题, 退出 skip 作用域
                in_skip_scope = False
                skip_level = None
        if in_skip_scope:
            p = dict(p)
            p["status"] = "skip"
        result.append(p)
    return result


def _exact_html(a: str, b: str) -> bool:
    """比较两段 HTML 的可见文本是否相同 (忽略所有标签/属性差异)."""
    return _text_of_html(a) == _text_of_html(b)


def _text_of_html(html: str) -> str:
    """从 HTML 提取纯文本: 去标签 → 解实体 → 归一化空白. 用于内容等价判断."""
    # 去除 HTML 注释
    text = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    # 去除 <style>/<script> 内容
    text = re.sub(r'<(style|script)\b[^>]*>.*?</\1>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # 去除所有标签
    text = re.sub(r'<[^>]+>', '', text)
    # 解码 HTML 实体 (&amp; → &, &#160; → 空格 等)
    text = html_unescape(text)
    # 归一化空白
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# 行内 diff 用: 归一化 tag token 中的属性, 避免属性差异产生高亮噪点
_TAG_STRIP_RE = re.compile(r'\s[^>]*')


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


def _mk_skip(block, pid):
    """skip 段: 不展示内容, 右栏显示'已跳过'."""
    if block.type == "image":
        return _image_para(pid, block, "skip",
                           old_img=block, new_img=block)
    return {
        "id": pid, "type": block.type, "status": "skip",
        "level": block.level if block.type == "heading" else None,
        "title": block.title,
    }


def _mk_del(block, pid):
    if block.type == "image":
        return _image_para(pid, None, "del", old_img=block)
    old_html = block.html
    if block.type == "heading":
        old_html = _heading_add_status_class(old_html, "del")
    return {
        "id": pid, "type": block.type, "status": "del",
        "level": block.level if block.type == "heading" else None,
        "title": block.title,
        "oldHtml": old_html,
        "newHtml": '<div class="diff-empty">(新版本中已删除)</div>',
    }


def _mk_add(block, pid):
    if block.type == "image":
        return _image_para(pid, None, "add", new_img=block)
    new_html = block.html
    if block.type == "heading":
        new_html = _heading_add_status_class(new_html, "add")
    return {
        "id": pid, "type": block.type, "status": "add",
        "level": block.level if block.type == "heading" else None,
        "title": block.title,
        "oldHtml": '<div class="diff-empty">(旧版本无此内容)</div>',
        "newHtml": new_html,
    }


def _heading_add_status_class(html_str, cls):
    """给标题 HTML 的 diff-h class 后追加状态 class (add/del/chg)."""
    return re.sub(r'class="diff-h"', f'class="diff-h {cls}"', html_str, count=1)


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

    token 比较时先归一化 URL 属性 (href/src), 避免纯链接差异产生 <span> 包裹造成 HTML 结构错乱;
    输出仍用原始 token, 保证链接可用.
    """
    if not old and not new:
        return ""
    a = _tokenize_html(old)
    b = _tokenize_html(new)

    # 归一化 tag token: 去除所有属性, 仅保留标签名 (属性差异不产生高亮噪点)
    def _norm_tag(t: str) -> str:
        if t.startswith("<") and not t.startswith("</"):
            return _TAG_STRIP_RE.sub("", t, count=1)
        return t

    a_norm = [_norm_tag(t) for t in a]
    b_norm = [_norm_tag(t) for t in b]

    sm = difflib.SequenceMatcher(a=a_norm, b=b_norm, autojunk=False)
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
    """行内容对齐 + cell 级着色; 用 SequenceMatcher 对齐行, 避免插入/删除一行导致后续全部错位."""
    try:
        old_root = lxml_html.fromstring(old_t)
        new_root = lxml_html.fromstring(new_t)
    except Exception:
        return old_t, new_t

    def rows(root):
        tb = root.find(".//tbody")
        if tb is not None:
            return [r for r in tb if _tag(r) == "tr"]
        return [r for r in root.iter() if _tag(r) == "tr"]

    def cell_text(tr):
        return [re.sub(r"\s+", " ", _text_of(td)).strip()
                for td in tr if _tag(td) in ("td", "th")]

    def cell_list(tr):
        """返回行中所有 td/th 元素 (保留引用用于后续加 class)."""
        return [c for c in tr if _tag(c) in ("td", "th")]

    o_rows = rows(old_root)
    n_rows = rows(new_root)

    # 用 SequenceMatcher 按行内容对齐, 而非按位置
    o_sigs = ["|".join(cell_text(r)) for r in o_rows]
    n_sigs = ["|".join(cell_text(r)) for r in n_rows]
    sm = difflib.SequenceMatcher(a=o_sigs, b=n_sigs, autojunk=False)

    # old_row_map[i] = j (matched new row) or None (unmatched)
    old_row_map = [None] * len(o_rows)
    new_row_map = [None] * len(n_rows)

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                old_row_map[i1 + k] = j1 + k
                new_row_map[j1 + k] = i1 + k
        elif tag == "replace":
            pairing = min(i2 - i1, j2 - j1)
            for k in range(pairing):
                old_row_map[i1 + k] = j1 + k
                new_row_map[j1 + k] = i1 + k

    def _compare_cells(old_row_el, new_row_el):
        """逐 cell 比较一对行, 在相应 cell 上加 cell-del / cell-add class."""
        o_cells = cell_list(old_row_el)
        n_cells = cell_list(new_row_el)
        n_max = max(len(o_cells), len(n_cells))
        for kk in range(n_max):
            if kk >= len(o_cells):
                _add_cell_class(n_cells[kk], "cell-add")
            elif kk >= len(n_cells):
                _add_cell_class(o_cells[kk], "cell-del")
            else:
                if cell_equal(o_cells[kk], n_cells[kk]):
                    _clear_cell_class(o_cells[kk])
                    _clear_cell_class(n_cells[kk])
                else:
                    _add_cell_class(o_cells[kk], "cell-del")
                    _add_cell_class(n_cells[kk], "cell-add")

    # 构建 old 侧输出 (保持原始行序)
    out_old_rows = []
    for i, orow in enumerate(o_rows):
        row_copy = list(orow)
        n_idx = old_row_map[i]
        if n_idx is not None:
            _compare_cells(orow, n_rows[n_idx])
        else:
            for c in cell_list(orow):
                _add_cell_class(c, "cell-del")
        out_old_rows.append(list(orow))  # 保留可能已修改的元素

    # 构建 new 侧输出 (保持原始行序)
    out_new_rows = []
    for j, nrow in enumerate(n_rows):
        row_copy = list(nrow)
        o_idx = new_row_map[j]
        if o_idx is not None:
            _compare_cells(o_rows[o_idx], nrow)
        else:
            for c in cell_list(nrow):
                _add_cell_class(c, "cell-add")
        out_new_rows.append(list(nrow))

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
                out_path.parent.mkdir(parents=True, exist_ok=True)
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


def collect_paragraphs(node: ChapterNode, resolvers, heading_filter=None, no_images=False):
    """根据 old/new entry 解析并 diff 段落, 复用到 dict node.id -> [block dictionaries].

    pid 前缀用本节点 id (e.g. 'ch1-1-1'), 输出 `<cid>-p<seq>`,
    保证跨章节唯一, 避免前端 findChapterIdOfParagraph 误中并列章节.
    heading_filter 应用到本节点的所有段落.
    resolvers 为 (resolver_old, resolver_new) 元组.
    no_images=True 时跳过图片块解析和资源拷贝.
    """
    resolver_old, resolver_new = resolvers
    old_e = node.old_entry
    new_e = node.new_entry
    if not old_e and not new_e:
        return None
    has_old = bool(node.old_entry)
    has_new = bool(node.new_entry)
    pid_prefix = node.id or "ch"
    if has_old and has_new:
        old_blocks = parse_blocks(old_e["html"], no_images=no_images)
        new_blocks = parse_blocks(new_e["html"], no_images=no_images)
        paras = diff_blocks(old_blocks, new_blocks, pid_prefix=pid_prefix, heading_filter=heading_filter)
    elif has_old:
        paras = [_mk_del(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(parse_blocks(old_e["html"], no_images=no_images))]
    elif has_new:
        paras = [_mk_add(b, f"{pid_prefix}-p{i+1}") for i, b in enumerate(parse_blocks(new_e["html"], no_images=no_images))]
    else:
        paras = []

    # 处理图片 url 替换 + 计算 old/new hash
    for p in paras:
        if p.get("type") == "image":
            old = p.get("oldImage"); new = p.get("newImage")
            if old:
                p["oldImage"] = resolver_old.resolve_src(old)
                h = resolver_old.sha1_of(old); p["oldHash"] = h or p["oldHash"] or ""
            if new:
                p["newImage"] = resolver_new.resolve_src(new)
                h = resolver_new.sha1_of(new); p["newHash"] = h or p["newHash"] or ""
    return paras


def collect_all_paragraphs(root: ChapterNode, resolvers, filter_obj=None, workers=1, no_images=False):
    """收集所有叶子章节的段落 diff.

    流程:
      1. 遍历树收集任务列表 (提取 html, 释放 entry 内存)
      2. 并行 (workers>1) 或串行 CPU 解析 + diff
      3. 串行处理图片资源 (文件 I/O)

    resolvers 为 (resolver_old, resolver_new) 元组, 分别用于解析旧/新版本的图片引用.
    no_images=True 时跳过图片块解析和资源拷贝, 报告中不展示图片.
    """
    resolver_old, resolver_new = resolvers

    # 阶段 1: 收集任务, 同时释放 entry html
    log.info("  gathering chapter tasks ...")
    tasks, node_refs = _gather_chapter_tasks(root)
    total = len(tasks)
    log.info("  %d leaf chapters to process", total)

    # 提取 filter 配置供 worker 重建
    filter_cfg = _filter_to_cfg(filter_obj) if (filter_obj and filter_obj.active) else None

    out = {}
    t_start = time.time()
    done = 0
    log_interval = max(total // 10, 1)
    next_report_count = log_interval
    next_report_time = time.time() + 30

    if workers > 1 and total > 1:
        log.info("  using %d parallel workers ...", workers)
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(_worker_parse_chapter, (*t, filter_cfg, no_images)): t[0]
                for t in tasks
            }
            for future in as_completed(futures):
                node_id, paras = future.result()
                if paras is not None:
                    out[node_id] = paras
                done += 1
                now = time.time()
                if done >= next_report_count or now >= next_report_time:
                    pct = done * 100 // max(total, 1)
                    elapsed = now - t_start
                    rate = done / elapsed if elapsed > 0 else 0
                    eta = (total - done) / rate if rate > 0 else 0
                    log.info("  paragraphs: %d/%d (%d%%) done in %.1fs, %.0f ch/s, ETA %.0fs",
                             done, total, pct, elapsed, rate, eta)
                    next_report_count = done + log_interval
                    next_report_time = now + 30
    else:
        # 串行路径 (原有行为)
        for task in tasks:
            node_id, paras = _worker_parse_chapter((*task, filter_cfg, no_images))
            if paras is not None:
                out[node_id] = paras
            done += 1
            now = time.time()
            if done >= next_report_count or now >= next_report_time:
                pct = done * 100 // max(total, 1)
                elapsed = now - t_start
                rate = done / elapsed if elapsed > 0 else 0
                eta = (total - done) / rate if rate > 0 else 0
                log.info("  paragraphs: %d/%d (%d%%) done in %.1fs, %.0f ch/s, ETA %.0fs",
                         done, total, pct, elapsed, rate, eta)
                next_report_count = done + log_interval
                next_report_time = now + 30

    # 阶段 3: 串行处理图片资源 (文件复制不能多进程并发)
    if not no_images and any(p.get("type") == "image" for ps in out.values() for p in ps):
        log.info("  resolving image resources ...")
        for paras in out.values():
            _resolve_images_in_paras(paras, resolver_old, resolver_new)
    return out


def _gather_chapter_tasks(root: ChapterNode):
    """遍历树, 收集所有叶子章节的解析任务, 同时释放 entry html."""
    tasks = []
    node_refs = {}
    stack = [root]
    while stack:
        n = stack.pop()
        if n.id:
            old_e = n.old_entry
            new_e = n.new_entry
            if old_e or new_e:
                old_html = old_e["html"] if old_e else ""
                new_html = new_e["html"] if new_e else ""
                has_old = bool(old_e)
                has_new = bool(new_e)
                pid_prefix = n.id or "ch"
                node_status = n.status
                tasks.append((n.id, old_html, new_html, has_old, has_new, pid_prefix, node_status))
                node_refs[n.id] = n
            # 释放 entry html (数据已提取到 tasks)
            _free_entry_html(n)
        for c in n.children:
            stack.append(c)
    return tasks, node_refs


def _count_leaves(root: ChapterNode) -> int:
    """统计树中带 id 的非 bridge 节点数."""
    cnt = 0
    stack = [root]
    while stack:
        n = stack.pop()
        if n.id:
            cnt += 1
        for c in n.children:
            stack.append(c)
    return cnt


def _free_entry_html(node: ChapterNode):
    """释放章节节点上 entry 中的 html 字段, 减少内存占用 (段落已提取)."""
    for attr in ("entry", "old_entry", "new_entry"):
        e = getattr(node, attr, None)
        if e is not None and isinstance(e, dict) and "html" in e:
            e["html"] = ""


def calc_stats(root: ChapterNode):
    """统计有内容章节 (非 bridge) 中各状态 count -> meta.stats."""
    counts = {"add": 0, "del": 0, "chg": 0, "skip": 0}
    def walk(n):
        if n.id and not getattr(n, "bridge", False):
            if n.status in counts: counts[n.status] += 1
        for c in n.children:
            walk(c)
    walk(root)
    return counts


# ----------------------------- 报告目录创建 -----------------------------

REPORT_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "report"
REPORT_TEMPLATE_FILES = [
    "index.html",
    "css/report.css",
    "js/report.js",
    "js/splitter.js",
    "js/scroll-sync.js",
]


def copy_report_template(out_dir: Path):
    """从 report/ 模板目录拷贝 HTML/CSS/JS 到输出目录, 保留原模板不动."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for rel in REPORT_TEMPLATE_FILES:
        src = REPORT_TEMPLATE_DIR / rel
        dst = out_dir / rel
        if not src.exists():
            log.warning("template file not found, skipping: %s", src)
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        log.debug("copied %s -> %s", src, dst)
    log.info("report template copied to %s", out_dir)


def _write_diff_data_stream(DiffData: dict, out_path: Path):
    """流式写入 diff-data.js, 逐段序列化避免整串 JSON 在内存中.

    meta 和 chapters 较小直接序列化; paragraphPaths 是 chapterId -> 文件路径映射.
    """
    def _reindent(s: str, extra: int) -> str:
        return "\n".join(" " * extra + line if line else ""
                         for line in s.split("\n"))

    with out_path.open("w", encoding="utf-8") as f:
        f.write(
            "/**\n"
            " * 本文件由 scripts/generate_report.py 自动生成, 请勿手工编辑.\n"
            " * 输入: data/parse/json/<OLD_VER> 与 <NEW_VER> 下的章节 JSON;\n"
            " * 输出: window.DIFF_DATA, 供 report/index.html 渲染.\n"
            " * 段落数据按章节拆分在 data/paragraphs/ 下, 由前端按需加载.\n"
            " */\n"
            "window.DIFF_DATA = {\n"
        )
        # meta (小)
        meta_json = json.dumps(DiffData["meta"], ensure_ascii=False, indent=2)
        f.write("  \"meta\": " + _reindent(meta_json, 2).lstrip() + ",\n")

        # chapters (小)
        ch_json = json.dumps(DiffData["chapters"], ensure_ascii=False, indent=2)
        f.write("  \"chapters\": " + _reindent(ch_json, 2).lstrip() + ",\n")

        # paragraphPaths (chapterId -> 文件路径)
        pp_json = json.dumps(DiffData["paragraphPaths"], ensure_ascii=False, indent=2)
        f.write("  \"paragraphPaths\": " + _reindent(pp_json, 2).lstrip() + "\n")
        f.write("};\n")


def _write_paragraph_files(paragraphs_by_chapter: dict, paragraphs_dir: Path):
    """将每个章节的段落数据写入独立 JS 文件 (script 标签注入方式, 兼容 file:// 协议)."""
    paragraphs_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    for cid, paras in paragraphs_by_chapter.items():
        fname = f"{cid}.js"
        fpath = paragraphs_dir / fname
        body = json.dumps(paras, ensure_ascii=False, indent=2)
        fpath.write_text(
            f"window.DIFF_PARAGRAPHS=window.DIFF_PARAGRAPHS||{{}};"
            f"window.DIFF_PARAGRAPHS[\"{cid}\"]={body};\n",
            encoding="utf-8"
        )
        paths[cid] = f"data/paragraphs/{fname}"
    return paths


# ----------------------------- AI 变更摘要 -----------------------------

# 摘要系统提示词 (中文, 面向 5G RAN 技术文档)
_SUMMARY_SYSTEM_PROMPT = """\
你是一份技术文档版本对比报告的 AI 摘要助手。请根据提供的变更列表，用简洁的中文概括该章节从旧版本到新版本的主要变化。

要求：
1. 关注实质性内容变化（新增/删除/修改的功能、参数、流程、配置等），忽略纯格式变化。
2. 按重要性排序，最重要的变化放在前面。
3. 使用 2-5 条要点概括，每条不超过 100 字。
4. 如果变更很多，只挑最重要的 5 条。
5. 仅在完全没有实质性变更时才输出"无实质性变更"。"""

_EXECUTIVE_SYSTEM_PROMPT = """\
你是一份技术文档版本对比报告的总览摘要助手。以下是各章节的变更摘要，请生成一份总览摘要（Executive Summary）。

要求：
1. 开头用一段话概述本次文档更新的整体情况（50-100 字）。
2. 然后列出最重要的 5-10 条跨章节的关键变更，按重要性排序。
3. 每条标注涉及的章节名称。
4. 使用中文。"""


class ChangeSummarizer:
    """基于 OpenAI 兼容 API 的文档变更 AI 摘要器.

    对每个有变更的章节提取纯文本变更列表, 调用 LLM 生成章节级摘要,
    最后汇总为文档级总览摘要.
    """

    def __init__(self, api_base, api_key, model, max_chars_per_chunk=12000):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.max_chars_per_chunk = max_chars_per_chunk

    # ---- 章节路径映射 ----

    @staticmethod
    def build_chapter_path_map(root):
        """遍历章节树, 构建 node_id -> 完整层级路径 的映射."""
        path_map = {}

        def walk(node, ancestors):
            current = ancestors + [node.title]
            if node.id:
                path_map[node.id] = " > ".join(current)
            for child in node.children:
                walk(child, current)

        for c in root.children:
            walk(c, [])
        return path_map

    # ---- 提取变更 ----

    def extract_chapter_changes(self, paragraphs_by_chapter, path_map):
        """从段落 diff 中提取有变更章节的纯文本变更列表.

        Returns:
            list of (chapter_id, chapter_path, changes_text)
        """
        results = []
        for cid, paras in paragraphs_by_chapter.items():
            changed = [p for p in paras if p.get("status") in ("add", "del", "chg")]
            if not changed:
                continue
            text = self._format_changes(changed)
            if not text.strip():
                continue
            chapter_path = path_map.get(cid, cid)
            results.append((cid, chapter_path, text))
        return results

    def _format_changes(self, changed_paras):
        """将变更段落列表格式化为结构化纯文本."""
        lines = []
        type_labels = {
            "heading": "标题", "text": "文本", "table": "表格",
            "list": "列表", "image": "图片",
        }
        for p in changed_paras:
            status = p.get("status", "?")
            ptype = p.get("type", "?")
            title = (p.get("title") or "")[:80]

            if ptype == "image":
                # 图片块: 用 caption + 文件名描述变更
                if status == "add":
                    label = "[新增]"
                    content = f"图片: {p.get('newImage', '')}\n说明: {p.get('newCaption', '')}"
                elif status == "del":
                    label = "[删除]"
                    content = f"图片: {p.get('oldImage', '')}\n说明: {p.get('oldCaption', '')}"
                elif status == "chg":
                    label = "[修改]"
                    content = (f"旧图: {p.get('oldImage', '')} ({p.get('oldCaption', '')})\n"
                               f"    新图: {p.get('newImage', '')} ({p.get('newCaption', '')})")
                else:
                    continue
            elif status == "add":
                label = "[新增]"
                content = self._strip_html(p.get("newHtml", ""))
            elif status == "del":
                label = "[删除]"
                content = self._strip_html(p.get("oldHtml", ""))
            elif status == "chg":
                label = "[修改]"
                old_text = self._strip_html(p.get("oldHtml", ""))
                new_text = self._strip_html(p.get("newHtml", ""))
                if old_text == new_text:
                    continue  # 纯标签差异, 跳过
                content = f"旧: {old_text}\n    新: {new_text}"
            else:
                continue

            tlabel = type_labels.get(ptype, ptype)
            heading_lvl = f"H{p.get('level')}" if ptype == "heading" and p.get("level") else ""
            header = f"{label} {tlabel}{heading_lvl}: {title}" if title else f"{label} {tlabel}"
            lines.append(header)
            if content and content.strip():
                # 限制单段长度
                truncated = content[:600]
                if len(content) > 600:
                    truncated += f"...(截断, 原文 {len(content)} 字)"
                lines.append(f"  {truncated}")
        return "\n".join(lines)

    @staticmethod
    def _strip_html(html_str):
        """从 HTML 提取纯文本: 去掉 diff span 包装 -> 去掉所有标签 -> 解实体 -> 归一化空白."""
        if not html_str:
            return ""
        # 先去掉 diff span (保留内部文本)
        text = re.sub(r'<span class="(?:add|del)">', "", html_str)
        text = re.sub(r"</span>", "", text)
        # 去掉所有 HTML 标签
        text = re.sub(r"<[^>]+>", " ", text)
        # 解码 HTML 实体
        text = html_unescape(text)
        # 归一化空白
        text = re.sub(r"\s+", " ", text).strip()
        return text

    # ---- LLM 调用 ----

    def call_llm(self, system_prompt, user_content, temperature=0.3):
        """调用 OpenAI 兼容的 chat/completions API, 返回 assistant 文本."""
        url = f"{self.api_base}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": temperature,
        }
        resp = requests.post(url, json=payload, headers=headers, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    # ---- 章节摘要 (支持超长章节自动分片) ----

    def summarize_chapter(self, chapter_path, changes_text):
        """对单个章节的变更列表生成 AI 摘要.

        如果变更文本超出 max_chars_per_chunk, 按 heading 边界分片后分别摘要再合并.
        """
        chunks = self._split_changes(changes_text)

        if len(chunks) == 1:
            user = f"章节路径: {chapter_path}\n\n变更列表:\n{changes_text}"
            return self.call_llm(_SUMMARY_SYSTEM_PROMPT, user)

        log.info("    chapter split into %d chunks: %s", len(chunks), chapter_path)
        chunk_summaries = []
        for i, chunk in enumerate(chunks):
            user = f"章节路径: {chapter_path} (部分 {i + 1}/{len(chunks)})\n\n变更列表:\n{chunk}"
            chunk_summaries.append(
                self.call_llm(_SUMMARY_SYSTEM_PROMPT, user))
            time.sleep(0.3)  # 限流间隔

        # 合并各分片摘要
        combined = "\n\n---\n\n".join(
            f"部分 {j + 1} 摘要:\n{s}"
            for j, s in enumerate(chunk_summaries))
        combine_prompt = (
            "以下是一份技术文档某个章节各部分的变更摘要，请合并为一份完整的章节摘要。\n"
            "按重要性排序，用 2-5 条要点概括，每条不超过 100 字。"
        )
        return self.call_llm(combine_prompt, combined)

    def _split_changes(self, changes_text):
        """将变更文本按 heading 边界分片, 使每片不超过 max_chars_per_chunk."""
        if len(changes_text) <= self.max_chars_per_chunk:
            return [changes_text]

        # 按 [新增/删除/修改] 标题: 分界
        sections = re.split(
            r"\n(?=\[(?:新增|删除|修改)\] 标题(?:\d|H))", changes_text)

        chunks = []
        current = ""
        for sec in sections:
            candidate = (current + "\n" + sec).strip() if current else sec
            if len(candidate) > self.max_chars_per_chunk and current:
                chunks.append(current.strip())
                current = sec
            else:
                current = candidate
        if current.strip():
            chunks.append(current.strip())
        return chunks or [changes_text]

    # ---- 总览摘要 ----

    def generate_executive_summary(self, chapter_summaries, old_ver, new_ver, doc_name):
        """从各章节摘要汇总生成文档级总览摘要."""
        if not chapter_summaries:
            return "未检测到任何实质性变更。"

        # 构造紧凑的摘要列表
        parts = []
        for i, (path, summary) in enumerate(chapter_summaries):
            parts.append(f"### {i + 1}. {path}\n{summary}")
        all_text = "\n\n".join(parts)

        user = (
            f"文档名称: {doc_name}\n"
            f"版本: {old_ver} → {new_ver}\n"
            f"共 {len(chapter_summaries)} 个章节有变更.\n\n"
            f"各章节变更摘要:\n\n{all_text}"
        )

        # 如果总内容超限, 只取前 N 条最重要的摘要
        if len(all_text) > self.max_chars_per_chunk * 2:
            # 按摘要长度粗略评估重要性 (更长可能更重要), 取前 30 条
            top_n = min(30, len(chapter_summaries))
            parts = []
            for i, (path, summary) in enumerate(chapter_summaries[:top_n]):
                parts.append(f"### {i + 1}. {path}\n{summary}")
            parts.append(f"\n(共 {len(chapter_summaries)} 个章节有变更, "
                         f"以上为前 {top_n} 条, 其余已省略)")
            all_text = "\n\n".join(parts)
            user = (
                f"文档名称: {doc_name}\n"
                f"版本: {old_ver} → {new_ver}\n"
                f"共 {len(chapter_summaries)} 个章节有变更 (以下展示前 {top_n} 条).\n\n"
                f"各章节变更摘要:\n\n{all_text}"
            )

        return self.call_llm(_EXECUTIVE_SYSTEM_PROMPT, user)


def _write_summary_files(chapter_summaries, executive_summary, meta, out_dir):
    """将 AI 摘要写入 summary.md 和 summary.json."""
    out_dir.mkdir(parents=True, exist_ok=True)

    # Markdown
    md_path = out_dir / "summary.md"
    lines = [
        f"# {meta.get('name', '文档版本对比')} - AI 变更摘要",
        "",
        f"**版本**: {meta.get('oldVersion', 'OLD')} → {meta.get('newVersion', 'NEW')}",
        f"**生成时间**: {meta.get('generatedAt', '')}",
        "",
        "---",
        "",
        "## 总览摘要",
        "",
        executive_summary,
        "",
        "---",
        "",
        "## 各章节变更详情",
        "",
    ]
    for i, (path, summary) in enumerate(chapter_summaries):
        lines.append(f"### {i + 1}. {path}")
        lines.append("")
        lines.append(summary)
        lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")
    log.info("summary markdown written to %s", md_path)

    # JSON
    json_path = out_dir / "summary.json"
    json_data = {
        "meta": {
            "name": meta.get("name", ""),
            "oldVersion": meta.get("oldVersion", ""),
            "newVersion": meta.get("newVersion", ""),
            "generatedAt": meta.get("generatedAt", ""),
        },
        "executiveSummary": executive_summary,
        "chapterSummaries": [
            {"path": path, "summary": summary}
            for path, summary in chapter_summaries
        ],
    }
    json_path.write_text(
        json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("summary json written to %s", json_path)


# ----------------------------- main -----------------------------

def main(argv=None):
    p = argparse.ArgumentParser(prog="generate_report.py")
    p.add_argument("--old", required=True, help="旧版本 JSON (文件或目录)")
    p.add_argument("--new", required=True, help="新版本 JSON (文件或目录)")
    p.add_argument("--hedex", default="data/parse/hedex",
                   help="解压后的 hedex 资源目录 (含 resources/), 旧新版本公用时的默认值")
    p.add_argument("--hedex-old", default=None,
                   help="旧版本 hedex 资源目录, 不指定则用 --hedex")
    p.add_argument("--hedex-new", default=None,
                   help="新版本 hedex 资源目录, 不指定则用 --hedex")
    p.add_argument("--no-images", action="store_true", default=False,
                   help="跳过图片块解析和资源拷贝, 报告中不展示图片")
    p.add_argument("--out-dir", default=None,
                   help="报告输出目录 (默认 output/report-<timestamp>/); 拷入模板+数据+图片")
    p.add_argument("--filter", default=None,
                   help="过滤配置 JSON (path/heading 黑/白名单)")
    p.add_argument("--log-level", default="INFO",
                   help="日志级别: DEBUG / INFO / WARN (默认 INFO)")
    p.add_argument("--workers", default=1, type=int,
                   help="并行 worker 数 (默认 1=串行, 0=CPU 核数, N>1=N 进程)")
    p.add_argument("--name", default="5G RAN 特性文档 版本对比",
                   help="报告中显示的标题")
    p.add_argument("--old-version", default=None,
                   help="旧版本标签 (默认从 path 自动嗅探)")
    p.add_argument("--new-version", default=None,
                   help="新版本标签 (默认从 path 自动嗅探)")
    p.add_argument("--summary", action="store_true", default=False,
                   help="启用 AI 变更摘要 (需同时提供 --summary-api-key)")
    p.add_argument("--summary-model", default="gpt-4o-mini",
                   help="摘要使用的 LLM 模型名 (默认 gpt-4o-mini)")
    p.add_argument("--summary-api-base", default="https://api.openai.com/v1",
                   help="OpenAI 兼容 API 地址 (默认 https://api.openai.com/v1)")
    p.add_argument("--summary-api-key", default="",
                   help="API Key; 也可通过环境变量 SUMMARY_API_KEY 传入")
    p.add_argument("--summary-max-chars", default=12000, type=int,
                   help="单次 LLM 调用的最大变更文本字符数 (默认 12000)")
    args = p.parse_args(argv)

    setup_logging(args.log_level)

    repo = Path(__file__).resolve().parent.parent

    # 确定输出目录
    if args.out_dir:
        out_dir = Path(args.out_dir)
        if not out_dir.is_absolute():
            out_dir = repo / out_dir
    else:
        ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        out_dir = repo / "output" / f"report-{ts}"

    # 加载 filter 配置
    filter_obj = load_filter(args.filter)

    # 加载数据, 容错缺失文件
    old = load_entries(str(Path(args.old)))
    new = load_entries(str(Path(args.new)))
    if not old and not new:
        log.error("neither old nor new has entries")
        return 2
    if not old:
        log.warning("OLD side has no entries, all chapters will be marked 'add'")
    if not new:
        log.warning("NEW side has no entries, all chapters will be marked 'del'")

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
    t0 = time.time()
    log.info("building chapter tree from %d old + %d new entries ...", len(old), len(new))
    root = build_tree(old, new)
    # 释放 entry 列表引用 (树节点已持有需要的 entry, 列表不再需要)
    old.clear(); new.clear()
    del old, new
    assign_ids(root)
    determine_tree_status(root)
    t1 = time.time()
    log.info("chapter tree built in %.1fs", t1 - t0)

    # 应用 path filter: 将命中节点标记为 skip
    if filter_obj.active:
        _apply_path_filter(root, filter_obj)

    # 资源解析器 (旧/新版本可分别指定 hedex 目录)
    hedex_old = args.hedex_old or args.hedex
    hedex_new = args.hedex_new or args.hedex
    hedex_old_dir = (repo / hedex_old) if not Path(hedex_old).is_absolute() else Path(hedex_old)
    hedex_new_dir = (repo / hedex_new) if not Path(hedex_new).is_absolute() else Path(hedex_new)
    assets_dir = out_dir / "assets" / "images" / "hedex"
    resolver_old = AssetImageResolver(hedex_old_dir, assets_dir)
    resolver_new = AssetImageResolver(hedex_new_dir, assets_dir)

    # 确定 workers 数量
    n_workers = args.workers
    if n_workers == 0:
        n_workers = os.cpu_count() or 4

    chapters = [render_tree(c) for c in root.children if _node_visible(c)]
    log.info("collecting paragraphs & diff for %d visible chapters ...", len(chapters))
    paragraphs_by_chapter = collect_all_paragraphs(root, (resolver_old, resolver_new), filter_obj=filter_obj,
                                                    workers=n_workers, no_images=args.no_images)
    t2 = time.time()
    log.info("paragraphs collected in %.1fs (%d leaf chapters)", t2 - t1, len(paragraphs_by_chapter))
    stats = calc_stats(root)
    img_count = sum(1 for ps in paragraphs_by_chapter.values() for p in ps if p.get("type") == "image")
    stats["img"] = img_count

    # 拷贝报告模板到输出目录
    copy_report_template(out_dir)

    # 写段落数据为独立文件 (按章节拆分, 前端按需加载)
    paragraphs_dir = out_dir / "data" / "paragraphs"
    log.info("writing %d paragraph files ...", len(paragraphs_by_chapter))
    paragraph_paths = _write_paragraph_files(paragraphs_by_chapter, paragraphs_dir)

    DiffData = {
        "meta": {
            "name": args.name,
            "oldVersion": old_ver,
            "newVersion": new_ver,
            "generatedAt": _now_str(),
            "sourceDoc": f"5G RAN 特性文档 ({old_ver} → {new_ver})",
            "stats": stats,
            "maxHeadingLevel": filter_obj.max_heading_level,
        },
        "chapters": chapters,
        "paragraphPaths": paragraph_paths,
    }

    # 写主数据文件 (meta + chapters + paragraphPaths)
    data_dir = out_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    out_path = data_dir / "diff-data.js"
    log.info("writing diff data index to %s ...", out_path)
    _write_diff_data_stream(DiffData, out_path)
    t3 = time.time()
    log.info("diff data written in %.1fs", t3 - t2)

    # ---- AI 变更摘要 ----
    if args.summary:
        api_key = args.summary_api_key or os.environ.get("SUMMARY_API_KEY", "")
        if not api_key:
            log.error("--summary requires an API key (--summary-api-key or SUMMARY_API_KEY env)")
            return 3
        log.info("generating AI change summary (model=%s, max_chars=%d) ...",
                 args.summary_model, args.summary_max_chars)
        summarizer = ChangeSummarizer(
            api_base=args.summary_api_base,
            api_key=api_key,
            model=args.summary_model,
            max_chars_per_chunk=args.summary_max_chars,
        )
        path_map = summarizer.build_chapter_path_map(root)
        chapter_changes = summarizer.extract_chapter_changes(paragraphs_by_chapter, path_map)
        total = len(chapter_changes)
        log.info("  %d chapters with changes to summarize", total)

        chapter_summaries = []
        failed = 0
        for idx, (cid, path, changes_text) in enumerate(chapter_changes):
            log.info("  [%d/%d] summarizing: %s (%d chars)",
                     idx + 1, total, path, len(changes_text))
            try:
                summary = summarizer.summarize_chapter(path, changes_text)
                chapter_summaries.append((path, summary))
                log.debug("    -> %s", summary[:120])
            except Exception as exc:
                log.warning("  [%d/%d] LLM call failed for '%s': %s",
                            idx + 1, total, path, exc)
                failed += 1
                # 退化为纯统计摘要
                chapter_summaries.append((
                    path,
                    f"*(LLM 调用失败, 共 {len(changes_text.splitlines())} 条变更)*"
                ))
                continue
            # 限流间隔
            if idx < total - 1:
                time.sleep(0.2)

        log.info("  chapter summaries done: %d success, %d failed", total - failed, failed)

        # 生成总览摘要
        log.info("  generating executive summary from %d chapter summaries ...",
                 len(chapter_summaries))
        try:
            meta_for_summary = {
                "name": args.name,
                "oldVersion": old_ver,
                "newVersion": new_ver,
                "generatedAt": _now_str(),
            }
            executive = summarizer.generate_executive_summary(
                chapter_summaries, old_ver, new_ver, args.name)
        except Exception as exc:
            log.warning("  executive summary failed: %s", exc)
            executive = f"*(总览摘要生成失败: {exc})*"

        _write_summary_files(chapter_summaries, executive, meta_for_summary, data_dir)
        t_summary = time.time()
        log.info("summary generated in %.1fs", t_summary - t3)
        t3 = t_summary

    t4 = time.time()
    log.info("report written in %.1fs total", t4 - t0)
    print(f"OK: report generated in {out_dir}")
    print(f"    Open {out_dir / 'index.html'} in a browser to view.")
    if args.summary:
        print(f"    AI Summary: {out_dir / 'data' / 'summary.md'}")
    return 0


def _apply_path_filter(root: ChapterNode, filter_obj: Filter):
    """遍历章节树, 对 path 命中过滤的节点及其子树设置 status=skip."""
    stack = [(root, False)]
    while stack:
        node, inherit_skip = stack.pop()
        if node.id and not getattr(node, "bridge", False):
            if inherit_skip:
                node.status = "skip"
            else:
                full_path = _rebuild_path(node)
                if filter_obj.should_skip_path(full_path):
                    node.status = "skip"
                    inherit_skip = True
                    log.debug("path filter skip: %s", full_path)
        for c in node.children:
            stack.append((c, inherit_skip))


def _rebuild_path(node: ChapterNode):
    """从 entry 中取原始的 stripped path; 若无 entry 则从树向上拼接."""
    if node.entry:
        return strip_version(node.entry["path"])
    if node.old_entry:
        return strip_version(node.old_entry["path"])
    if node.new_entry:
        return strip_version(node.new_entry["path"])
    return node.title


def _now_str():
    import datetime
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")


if __name__ == "__main__":
    sys.exit(main())
