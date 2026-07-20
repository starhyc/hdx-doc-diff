#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke test: 校验 generate_report.py 输出的 diff-data.js 结构完整.

断言:
 1. window.DIFF_DATA 含 meta / chapters / paragraphsByChapter
 2. chapters 树中每个节点要么有 paragraphsByChapter[id], 要么 bridge=true
 3. paragraphsByChapter 每个键都能在 chapters 树找到对应 id
 4. heading 段的 level 字段同 h2/h3/h4 对应; text/list/table/image 段的 level 为 null
 5. status 取值仅 {keep/add/del/chg}; meta.stats 总数等于 chapters 树非 bridge 节点 count
"""
import json
import re
from pathlib import Path


def load_diff_data(path: Path):
    txt = path.read_text(encoding="utf-8")
    m = re.search(r"window\.DIFF_DATA\s*=\s*(\{.*\});", txt, re.DOTALL)
    assert m, "window.DIFF_DATA 不存在!"
    return json.loads(m.group(1))


def walk(chapters, ids, bridges):
    for c in chapters:
        if c.get("id"):
            ids.add(c["id"])
        if c.get("bridge"):
            bridges.add(c["id"])
        if c.get("children"):
            walk(c["children"], ids, bridges)


def main():
    dd = load_diff_data(Path("report/data/diff-data.js"))
    assert "meta" in dd and "chapters" in dd and "paragraphsByChapter" in dd
    print("PASS: 顶层字段完整")

    chapter_ids, bridge_ids = set(), set()
    walk(dd["chapters"], chapter_ids, bridge_ids)
    pbc_keys = set(dd["paragraphsByChapter"].keys())

    # every paragraph key must appear in tree
    missing = pbc_keys - chapter_ids
    assert not missing, f"orphan keys not in tree: {missing}"
    print(f"PASS: {len(pbc_keys)} paragraph keys 都在 chapters 树")

    # every non-bridge id should have paragraphs; bridge ids should NOT
    bad_bridge = []
    bad_leaf = []
    all_ids = chapter_ids
    for cid in all_ids:
        is_bridge = cid in bridge_ids
        has_paras = cid in pbc_keys
        if is_bridge and has_paras:
            bad_bridge.append(cid)
        if not is_bridge and not has_paras:
            bad_leaf.append(cid)
    assert not bad_bridge, f"bridge nodes should not have paragraphs: {bad_bridge}"
    assert not bad_leaf, f"leaf chapters without paragraphs: {bad_leaf}"
    print(f"PASS: bridge={len(bridge_ids)} 节点无 paras, leaf={len(all_ids - bridge_ids)} 节点都有 paras")

    valid_status = {"keep", "add", "del", "chg"}
    for cid, paras in dd["paragraphsByChapter"].items():
        for p in paras:
            assert p.get("status") in valid_status, f"{cid}/{p.get('id')} bad status"
            if p["type"] == "heading":
                lvl = p.get("level")
                assert lvl in (1, 2, 3, 4, 5, 6), f"{cid}/{p['id']} heading level={lvl}"
            else:
                # non-heading types should not carry level
                assert p.get("level") in (None,), \
                    f"{cid}/{p['id']} type={p['type']} carrying level={p.get('level')}"
            # keep -> 有 contentHtml; add/del/chg -> 有 oldHtml/newHtml
            if p["status"] == "keep":
                assert "contentHtml" in p or p["type"] == "image", f"{cid}/{p['id']} keep缺contentHtml"
            else:
                if p["type"] != "image":
                    assert "oldHtml" in p and "newHtml" in p, f"{cid}/{p['id']} 非keep缺old/newHtml"
                else:
                    assert "oldImage" in p and "newImage" in p, f"{cid}/{p['id']} image缺old/newImage"
    print(f"PASS: 段落结构字段符合契约")

    stats = dd["meta"]["stats"]
    # 走一遍 chapters 数 status
    actual = {"add": 0, "del": 0, "chg": 0}
    def walk_stats(c):
        s = c.get("status") or "keep"
        if c.get("bridge"):
            pass  # 不计入
        elif s in actual:
            actual[s] += 1
        for cc in c.get("children", []):
            walk_stats(cc)
    for c in dd["chapters"]:
        walk_stats(c)
    for k, exp in (("add", stats["add"]), ("del", stats["del"]), ("chg", stats["chg"])):
        assert actual[k] == exp, f"stats {k} mismatch: {actual[k]} vs {exp}"
    print(f"PASS: meta.stats 与树非-bridge count 一致: {actual}")

    img_n = sum(1 for ps in dd["paragraphsByChapter"].values()
                for p in ps if p.get("type") == "image")
    assert img_n == stats.get("img", 0), f"img count mismatch {img_n} vs {stats.get('img')}"
    print(f"PASS: image count={img_n} 与 meta.stats.img 一致")

    # 中栏空场景 (无 headings 的章节) 至少有 1 个 -> 覆盖用户要求 #1
    heading_any = [k for k, ps in dd["paragraphsByChapter"].items()
                   if any(p["type"] == "heading" for p in ps)]
    no_heading = [k for k, ps in dd["paragraphsByChapter"].items()
                  if not any(p["type"] == "heading" for p in ps)]
    print(f"INFO: 含 heading 的章节 {len(heading_any)}; 无 heading 中栏空章节 {len(no_heading)} -> {no_heading}")
    assert no_heading, "测试希望至少有 1 个无 heading 章节 (演示中栏空场景)"
    print(f"PASS: 至少有一个 '无标题层级' 章节可演示")
    print("\nALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()
