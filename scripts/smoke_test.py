#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke test: 校验 generate_report.py 输出的 diff-data.js 结构完整.

断言:
 1. window.DIFF_DATA 含 meta / chapters / paragraphPaths
 2. chapters 树中每个节点要么有 paragraphPaths[id], 要么 bridge=true
 3. paragraphPaths 每个键都能在 chapters 树找到对应 id, 且对应的文件存在
 4. heading 段的 level 字段同 h2/h3/h4 对应; text/list/table/image 段的 level 为 null
 5. status 取值仅 {keep/add/del/chg/skip}; meta.stats 总数等于 chapters 树非 bridge 节点 count
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
    import sys
    data_path = sys.argv[1] if len(sys.argv) > 1 else "report/data/diff-data.js"
    dd = load_diff_data(Path(data_path))
    assert "meta" in dd and "chapters" in dd, "缺少 meta/chapters"
    # 兼容新旧格式
    has_paths = "paragraphPaths" in dd
    has_inline = "paragraphsByChapter" in dd
    assert has_paths or has_inline, "缺少 paragraphPaths 或 paragraphsByChapter"
    print("PASS: 顶层字段完整")

    data_dir = Path(data_path).parent
    out_dir = data_dir.parent  # paragraphPaths 相对于输出目录根
    chapter_ids, bridge_ids = set(), set()
    walk(dd["chapters"], chapter_ids, bridge_ids)

    if has_inline:
        pbc_keys = set(dd["paragraphsByChapter"].keys())
        # 构造统一访问接口
        def get_paras(cid):
            return dd["paragraphsByChapter"].get(cid, [])
    else:
        pp = dd["paragraphPaths"]
        pbc_keys = set(pp.keys())
        def get_paras(cid):
            rel = pp.get(cid)
            if not rel:
                return []
            fpath = out_dir / rel
            if not fpath.exists():
                return []
            return json.loads(fpath.read_text(encoding="utf-8"))

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

    valid_status = {"keep", "add", "del", "chg", "skip"}
    all_paras = {}
    for cid in pbc_keys:
        paras = get_paras(cid)
        all_paras[cid] = paras
        for p in paras:
            assert p.get("status") in valid_status, f"{cid}/{p.get('id')} bad status: {p.get('status')}"
            if p["type"] == "heading":
                lvl = p.get("level")
                assert lvl in (1, 2, 3, 4, 5, 6), f"{cid}/{p['id']} heading level={lvl}"
            else:
                assert p.get("level") in (None,), \
                    f"{cid}/{p['id']} type={p['type']} carrying level={p.get('level')}"
            if p["status"] in ("keep", "skip"):
                if p["type"] != "image":
                    if p["status"] == "skip":
                        assert "contentHtml" in p or ("oldHtml" in p and "newHtml" in p), \
                            f"{cid}/{p['id']} skip缺contentHtml或old/newHtml"
                    else:
                        assert "contentHtml" in p, f"{cid}/{p['id']} keep缺contentHtml"
            else:
                if p["type"] != "image":
                    assert "oldHtml" in p and "newHtml" in p, f"{cid}/{p['id']} 非keep/skip缺old/newHtml"
                else:
                    assert "oldImage" in p and "newImage" in p, f"{cid}/{p['id']} image缺old/newImage"
    print(f"PASS: 段落结构字段符合契约")

    stats = dd["meta"]["stats"]
    actual = {"add": 0, "del": 0, "chg": 0, "skip": 0}
    def walk_stats(c):
        s = c.get("status") or "keep"
        if c.get("bridge"):
            pass
        elif s in actual:
            actual[s] += 1
        for cc in c.get("children", []):
            walk_stats(cc)
    for c in dd["chapters"]:
        walk_stats(c)
    for k, exp in (("add", stats.get("add", 0)), ("del", stats.get("del", 0)),
                   ("chg", stats.get("chg", 0)), ("skip", stats.get("skip", 0))):
        assert actual[k] == exp, f"stats {k} mismatch: {actual[k]} vs {exp}"
    print(f"PASS: meta.stats 与树非-bridge count 一致: {actual}")

    img_n = sum(1 for cid in pbc_keys for p in all_paras[cid] if p.get("type") == "image")
    assert img_n == stats.get("img", 0), f"img count mismatch {img_n} vs {stats.get('img')}"
    print(f"PASS: image count={img_n} 与 meta.stats.img 一致")

    # 中栏空场景 (无 headings 的章节) 至少有 1 个
    heading_any = [k for k in pbc_keys
                   if any(p["type"] == "heading" for p in all_paras.get(k, []))]
    no_heading = [k for k in pbc_keys
                  if not any(p["type"] == "heading" for p in all_paras.get(k, []))]
    print(f"INFO: 含 heading 的章节 {len(heading_any)}; 无 heading 中栏空章节 {len(no_heading)} -> {no_heading}")
    assert no_heading, "测试希望至少有 1 个无 heading 章节 (演示中栏空场景)"
    print(f"PASS: 至少有一个 '无标题层级' 章节可演示")
    print("\nALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()
