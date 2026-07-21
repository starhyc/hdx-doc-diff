#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate the heading-subtree scoping algorithm (Python mirror of report.js getScopedParas)
against the generated diff-data.js, so the Issue #3 fix can be checked without a real browser.
"""
import json
import re
from pathlib import Path


def get_scoped_paras(paras, focus_pid):
    if not paras or not focus_pid:
        return paras
    focus_idx = -1
    for i, p in enumerate(paras):
        if p["id"] == focus_pid:
            focus_idx = i
            break
    if focus_idx == -1:
        return paras
    focus = paras[focus_idx]
    if focus["type"] != "heading":
        return [focus]
    out = [focus]
    focus_level = focus.get("level") or 2
    for i in range(focus_idx + 1, len(paras)):
        p = paras[i]
        if p["type"] == "heading" and (p.get("level") or 99) <= focus_level:
            break
        out.append(p)
    return out


def main():
    import sys
    data_path = sys.argv[1] if len(sys.argv) > 1 else "report/data/diff-data.js"
    txt = Path(data_path).read_text(encoding="utf-8")
    m = re.search(r"window\.DIFF_DATA\s*=\s*(\{.*\});", txt, re.DOTALL)
    dd = json.loads(m.group(1))
    data_dir = Path(data_path).parent
    out_dir = data_dir.parent  # paragraphPaths 相对于输出目录根
    if "paragraphPaths" in dd:
        pbc = {}
        for cid, rel in dd["paragraphPaths"].items():
            fpath = out_dir / rel
            if fpath.exists():
                txt = fpath.read_text(encoding="utf-8")
                # .js 格式: window.DIFF_PARAGRAPHS["<id>"] = <json>;
                m2 = re.search(r'window\.DIFF_PARAGRAPHS\["([^"]+)"\]\s*=\s*(.*);', txt, re.DOTALL)
                if m2:
                    pbc[cid] = json.loads(m2.group(2))
                else:
                    pbc[cid] = json.loads(txt)
    else:
        pbc = dd["paragraphsByChapter"]

    fails = 0
    print("== 各章节自匹配 scoped 子树 ==")
    for cid, paras in pbc.items():
        headings = [p for p in paras if p["type"] == "heading"]
        print(f"\n[{cid}] total paras={len(paras)} headings={len(headings)}")
        for h in headings:
            scoped = get_scoped_paras(paras, h["id"])
            scoped_headings = [p for p in scoped if p["type"] == "heading"]
            scope_ids = [p["id"] for p in scoped]
            print(f"  -> heading {h['id']} (level={h['level']} '{h['title']}') "
                  f"subtree={len(scoped)} 段, 含 heading={len(scoped_headings)}: {scope_ids}")
            # 不变量: scoped 中第一个必是该 heading; scoped 中后续 heading 都严格更深 level
            if scoped[0]["id"] != h["id"]:
                print(f"  FAIL: scoped 首段不是聚焦 heading 本身")
                fails += 1; continue
            for sh in scoped_headings[1:]:
                if (sh.get("level") or 99) <= (h.get("level") or 2):
                    print(f"  FAIL: scoped 含同级/上级 heading {sh['id']} level={sh.get('level')}, 应已截断")
                    fails += 1
            # 不变量: scoped 中含的 next-heading-next-sibling 必须在 scoped 外 (即 paras 中 scoped 末尾后第一个 heading 同/上级 不在 scoped)
            if scoped[-1]["id"] != paras[-1]["id"]:
                # 找 scoped 末尾的下一个段落
                last_idx = next(i for i, p in enumerate(paras) if p["id"] == scoped[-1]["id"])
                for p in paras[last_idx + 1:]:
                    if p["type"] == "heading":
                        # 第一个 heading 必须是同级或上级 heading (即 scope 边界)
                        lvl_p = p.get("level") or 99
                        lvl_h = h.get("level") or 2
                        assert lvl_p <= lvl_h, \
                            f"FAIL: 截断 heading {p['id']} level={lvl_p} > focused L{lvl_h}"
                        break
            else:
                # scoped 走到章节末尾 -> 末尾不应当再有同级/上级 heading (否则 scope 应截断)
                pass

    # 关键场景演示: ch1-1-1 含 9 段, heading p1 (level 2) 是顶层, 它的子树应该全部 9 段
    # heading p3 (level 3) 的子树应是从 p3 到 p6 之前, 即 [p3, p4, p5] 3 段 (p6 同 level 3 截断)
    # heading p6 (level 3) 的子树应为 [p6, p7, p8, p9] (末尾, 没截断)
    print("\n== ch1-1-1 关键场景 ==")
    paras = pbc["ch1-1-1"]
    expectations = [
        ("ch1-1-1-p1", "无线文档体系概述", 2, 9),
        ("ch1-1-1-p3", "文档层级结构", 3, 3),
        ("ch1-1-1-p6", "版本管理与发布", 3, 4),
    ]
    for pid, title, lvl, n in expectations:
        scoped = get_scoped_paras(paras, pid)
        h = scoped[0]
        ok_h = h["id"] == pid and h["title"] == title and h.get("level") == lvl
        ok_n = len(scoped) == n
        if ok_h and ok_n:
            print(f"  PASS: {pid} '{title}' L{lvl} -> 子树 {len(scoped)} 段 (预期 {n})")
        else:
            print(f"  FAIL: {pid} -> got {len(scoped)} 段 (预期 {n}); heading match={ok_h}")
            fails += 1

    # 章节无 heading (中栏空) 时 -> 全章内容 (9 段 / 2 段... etc.)
    for cid in ("ch1-1", "ch1-2-2"):
        paras = pbc[cid]
        scoped = get_scoped_paras(paras, None)
        if len(scoped) == len(paras):
            print(f"  PASS: {cid} 无 heading -> 全章 {len(scoped)} 段完整展示")
        else:
            print(f"  FAIL: {cid} 无 heading 时 scoped={len(scoped)} expected {len(paras)}")
            fails += 1

    print()
    if fails:
        print(f"Scope algorithm fail count = {fails}")
        raise SystemExit(1)
    print("Scope algorithm smoke OK")


if __name__ == "__main__":
    main()
