#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 mock 输入数据，模拟真实 HDX 解析后产出的 JSON 章节。

生成的目录结构：
  data/parse/json/5G RAN10.1/chapters.json   # OLD 版本章节
  data/parse/json/5G RAN10.2/chapters.json   # NEW 版本章节
  data/parse/hedex/resources/*.svg / *.html # 资源文件 (图片引用)

每条 JSON 章节包含字段：
  titleStr : 章节名称 (例如 "文档包信息")
  path     : 章节路径 (例如 "5G RAN10.1 特性文档 > 文档包信息")
  html     : 整个 <html> 标签原文，图片以 ${URL_PREFIX}//resources//xxx.svg 引用
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD_VER = "5G RAN10.1"
NEW_VER = "5G RAN10.2"
URL = "${URL_PREFIX}//resources//"  # hedex 内引用资源前缀


def page(title: str, body_inner: str) -> str:
    """拼出一个完整 <html> 文档字符串，并把 __RES__ 占位替换为 URL 前缀。"""
    body_inner = body_inner.replace("__RES__", URL)
    return (
        '<html><head><meta charset="UTF-8">'
        f"<title>{title}</title></head>"
        f"<body>{body_inner}</body></html>"
    )


# ----------------------- 章节内容（OLD & NEW 版本各自一份） -----------------------

# 章节 1：文档包信息 (无标题层级 — 中栏空场景演示)
PATH_PKG = "特性文档 > 文档包信息"
PKG_OLD = page("文档包信息", """
<p class="p">
本特性文档面向 5G RAN 网络规划与运维人员，介绍 5G RAN10.1 系统的设备组成、功能特性、
修订历史与文档体系结构等信息，便于读者快速了解产品定位与改造范围。
</p>
<p class="p">
文档采用层级结构组织：<b>特性文档</b> 为顶层目录，下含 <b>文档包信息</b>、
<b>接口与流量</b>、<b>修订历史</b> 等章节。如需了解具体子模块，可在左侧章节树点击向下展开。
</p>
""")
PKG_NEW = page("文档包信息", """
<p class="p">
本特性文档面向 5G RAN 网络规划与运维人员，介绍 5G RAN10.2 系统的设备组成、功能特性、
修订历史与文档体系结构等信息，便于读者快速了解产品定位与改造范围。
</p>
<p class="p">
文档采用层级结构组织：<b>特性文档</b> 为顶层目录，下含 <b>文档包信息</b>、
<b>接口与流量</b>、<b>修订历史</b> 等章节。如需了解具体子模块，可在左侧章节树点击向下展开。
</p>
""")

# 章节 2：无线文档体系 (有标题层级 + 表格 + 列表 + 图片，多类型 diff)
PATH_WLESS = "特性文档 > 文档包信息 > 无线文档体系"
WLESS_OLD = page("无线文档体系", """
<h2 class="h2">无线文档体系概述</h2>
<p class="p">
本章介绍 5G RAN10.1 各功能平台文档的组成与存放规则，并说明无线文档体系的层级划分、版本管理与发布流程。
</p>
<h3 class="h3">文档层级结构</h3>
<p class="p">
无线文档体系按 <b>特性文档</b> → <b>子模块文档</b> → <b>接口/命令参考</b> 三级组织，
覆盖 RAN10.1 系统的 gNB、传输网、运维面三大子域。
</p>
<table class="tbl">
<caption>表 2-1 RAN10.1 平台文档存放规则</caption>
<thead><tr><th>平台</th><th>存放路径</th><th>维护责任</th></tr></thead>
<tbody>
<tr><td>gNB 平台</td><td>/opt/ran10.1/gnb</td><td>无线研发</td></tr>
<tr><td>传输网平台</td><td>/opt/ran10.1/tn</td><td>传输研发</td></tr>
<tr><td>运维面</td><td>/opt/ran10.1/ops</td><td>运维研发</td></tr>
</tbody>
</table>
<h3 class="h3">版本管理与发布</h3>
<p class="p">
RAN10.1 文档版本通过 git tag 管理，每月发布一次小版本；季度发布一次特性版本，
每次发布同步更新产品 LAN 与组网拓扑示意图如下：
</p>
<div class="img">
<img src="__RES__topo_v1.svg" alt="RAN10.1 组网拓扑" />
<div class="cap">图 2-1 RAN10.1 单上联组网拓扑</div>
</div>
<ul class="ul">
<li>常规发布周期：每月 15 日</li>
<li>特性发布周期：每季度首月发布</li>
<li>紧急修订：通过 hotfix 分支单独发布</li>
</ul>
""")
WLESS_NEW = page("无线文档体系", """
<h2 class="h2">无线文档体系概述</h2>
<p class="p">
本章介绍 5G RAN10.2 各功能平台文档的组成与存放规则，并说明无线文档体系的层级划分、版本管理与发布流程。
</p>
<h3 class="h3">文档层级结构</h3>
<p class="p">
无线文档体系按 <b>特性文档</b> → <b>子模块文档</b> → <b>接口/命令参考</b> 三级组织，
覆盖 RAN10.2 系统的 gNB、传输网、运维面与 <b>云网管理</b> 四大子域。
</p>
<table class="tbl">
<caption>表 2-1 RAN10.2 平台文档存放规则</caption>
<thead><tr><th>平台</th><th>存放路径</th><th>维护责任</th></tr></thead>
<tbody>
<tr><td>gNB 平台</td><td>/opt/ran10.2/gnb</td><td>无线研发</td></tr>
<tr><td>传输网平台</td><td>/opt/ran10.2/tn</td><td>传输研发</td></tr>
<tr><td>运维面</td><td>/opt/ran10.2/ops</td><td>运维研发</td></tr>
<tr><td>云网管理</td><td>/opt/ran10.2/cnm</td><td>云网研发</td></tr>
</tbody>
</table>
<h3 class="h3">版本管理与发布</h3>
<p class="p">
RAN10.2 文档版本通过 git tag 管理，每月发布一次小版本；季度发布一次特性版本，
每次发布同步更新产品 LAN 与组网拓扑示意图如下；新增支持 <b>双上联冗余</b> 拓扑：
</p>
<div class="img">
<img src="__RES__topo_v2.svg" alt="RAN10.2 组网拓扑" />
<div class="cap">图 2-1 RAN10.2 双上联冗余组网拓扑</div>
</div>
<ul class="ul">
<li>常规发布周期：每月 15 日</li>
<li>特性发布周期：每季度首月发布</li>
<li>紧急修订：通过 hotfix 分支单独发布</li>
<li>新增 <b>灰度发布</b> 渠道，支持分租户灰度验证</li>
</ul>
""")

# 章节 3：状态接口 (有标题层级 + 段落 + 表格)
PATH_IF = "特性文档 > 接口与流量 > 状态接口"
IF_OLD = page("状态接口", """
<h2 class="h2">状态接口概述</h2>
<p class="p">
状态接口用于上报 RAN 节点运行状态，包括 CPU 利用率、内存占用、链路通断、连接数与告警聚合信息，
为运维系统提供基础监控数据来源。
</p>
<table class="tbl">
<caption>表 3-1 RAN10.1 状态接口字段</caption>
<thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead>
<tbody>
<tr><td>cpu_usage</td><td>int</td><td>CPU 利用率百分比</td></tr>
<tr><td>mem_usage</td><td>int</td><td>内存利用率百分比</td></tr>
<tr><td>link_status</td><td>bitset</td><td>链路状态位图</td></tr>
</tbody>
</table>
""")
IF_NEW = page("状态接口", """
<h2 class="h2">状态接口说明</h2>
<p class="p">
状态接口用于上报 RAN 节点运行状态，包括 CPU 利用率、内存占用、链路通断、连接数、告警聚合信息与
<b>电源状态</b>，为运维系统提供基础监控数据来源，并支持按需推送到第三方监控平台。
</p>
<table class="tbl">
<caption>表 3-1 RAN10.2 状态接口字段</caption>
<thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead>
<tbody>
<tr><td>cpu_usage</td><td>int</td><td>CPU 利用率百分比</td></tr>
<tr><td>mem_usage</td><td>int</td><td>内存利用率百分比</td></tr>
<tr><td>link_status</td><td>bitset</td><td>链路状态位图</td></tr>
<tr><td>power_state</td><td>enum</td><td>电源状态 (ON/OFF/STANDBY)</td></tr>
</tbody>
</table>
""")

# 章节 4：流量控制策略 (整章删除 — 中栏空场景)
PATH_QOS = "特性文档 > 接口与流量 > 流量控制策略"
QOS_OLD = page("流量控制策略", """
<p class="p">
本章节描述 5G RAN10.1 的流量控制策略，包括全局速率限制、流分类与队列调度机制；
该章节在 RAN10.2 中被合并到 <b>接口与流量</b> 总章节，本章不再独立维护。
</p>
<p class="p">默认队列调度算法采用 <code>SP + WRR</code>，单板最大支持 8 个调度队列。</p>
""")

# 章节 5：VLAN 隔离特性 (NEW 新增章节 — 整章新增)
PATH_VLAN = "特性文档 > 接口与流量 > VLAN 隔离特性"
VLAN_NEW = page("VLAN 隔离特性", """
<h2 class="h2">VLAN 隔离特性概述</h2>
<p class="p">
本章节为 RAN10.2 新增功能，描述 5G RAN 在用户面与控制面分离场景下 VLAN 隔离的实现方式与
典型部署约束，避免不同业务 VLAN 间的二层数据互通。
</p>
<h3 class="h3">典型部署约束</h3>
<ul class="ul">
<li>同一 VLAN 内的 gNB 节点应部署在同一物理子网，避免跨网段转发</li>
<li>不同业务 VLAN 间启用端口隔离组 (port-isolate group)</li>
<li>多租户场景推荐使用 VLAN Mapping + VRF 实现三层隔离</li>
</ul>
""")

# 章节 6：修订历史 (表格 + 标题，修改 + 新增条目)
PATH_REV = "特性文档 > 修订历史"
REV_OLD = page("修订历史", """
<h2 class="h2">修订历史</h2>
<table class="tbl">
<caption>修订历史表 (RAN10.1)</caption>
<thead><tr><th>版本</th><th>发布日期</th><th>修订要点</th></tr></thead>
<tbody>
<tr><td>RAN10.1.0</td><td>2024-03-15</td><td>首次发布 RAN10.1 基线版本</td></tr>
<tr><td>RAN10.1.1</td><td>2024-06-15</td><td>新增 gNB 接口与流量章节修订</td></tr>
</tbody>
</table>
""")
REV_NEW = page("修订历史", """
<h2 class="h2">修订历史</h2>
<table class="tbl">
<caption>修订历史表 (RAN10.2)</caption>
<thead><tr><th>版本</th><th>发布日期</th><th>修订要点</th></tr></thead>
<tbody>
<tr><td>RAN10.1.0</td><td>2024-03-15</td><td>首次发布 RAN10.1 基线版本</td></tr>
<tr><td>RAN10.1.1</td><td>2024-06-15</td><td>新增 gNB 接口与流量章节修订</td></tr>
<tr><td>RAN10.2.0</td><td>2024-09-15</td><td>RAN10.2 基线版本：新增 VLAN 隔离与管理面状态扩展</td></tr>
</tbody>
</table>
<p class="p">
后续修订历史将由 RAN10.2 维护团队维护，RAN10.1 进入冻结状态不再追加新条目。
</p>
""")


def make_old():
    return [
        {"titleStr": "文档包信息", "path": f"{OLD_VER} {PATH_PKG}", "html": PKG_OLD},
        {"titleStr": "无线文档体系", "path": f"{OLD_VER} {PATH_WLESS}", "html": WLESS_OLD},
        {"titleStr": "状态接口", "path": f"{OLD_VER} {PATH_IF}", "html": IF_OLD},
        {"titleStr": "流量控制策略", "path": f"{OLD_VER} {PATH_QOS}", "html": QOS_OLD},
        {"titleStr": "修订历史", "path": f"{OLD_VER} {PATH_REV}", "html": REV_OLD},
    ]


def make_new():
    return [
        {"titleStr": "文档包信息", "path": f"{NEW_VER} {PATH_PKG}", "html": PKG_NEW},
        {"titleStr": "无线文档体系", "path": f"{NEW_VER} {PATH_WLESS}", "html": WLESS_NEW},
        {"titleStr": "状态接口", "path": f"{NEW_VER} {PATH_IF}", "html": IF_NEW},
        # 注意：流量控制策略 在 NEW 中不存在 (整章删除)
        {"titleStr": "VLAN 隔离特性", "path": f"{NEW_VER} {PATH_VLAN}", "html": VLAN_NEW},
        {"titleStr": "修订历史", "path": f"{NEW_VER} {PATH_REV}", "html": REV_NEW},
    ]


# ----------------------- 资源 SVG 文件 (图片引用) -----------------------

TOPO_OLD = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="160" viewBox="0 0 420 160">
  <rect width="420" height="160" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="210" y="22" text-anchor="middle" font-size="13" font-weight="600" fill="#0f172a">RAN10.1 单上联拓扑</text>
  <circle cx="60" cy="80" r="22" fill="#eef2ff" stroke="#6366f1"/>
  <text x="60" y="84" text-anchor="middle" font-size="11" fill="#4338ca">gNB-1</text>
  <circle cx="180" cy="80" r="22" fill="#eef2ff" stroke="#6366f1"/>
  <text x="180" y="84" text-anchor="middle" font-size="11" fill="#4338ca">gNB-2</text>
  <line x1="82" y1="80" x2="160" y2="80" stroke="#6366f1" stroke-width="2"/>
  <rect x="280" y="55" width="100" height="50" rx="6" fill="#dcfce7" stroke="#16a34a"/>
  <text x="330" y="84" text-anchor="middle" font-size="12" fill="#15803d">核心汇聚</text>
  <line x1="200" y1="80" x2="280" y2="80" stroke="#16a34a" stroke-width="2"/>
</svg>
"""

TOPO_NEW = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="460" height="180" viewBox="0 0 460 180">
  <rect width="460" height="180" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="230" y="24" text-anchor="middle" font-size="13" font-weight="600" fill="#0f172a">RAN10.2 双上联冗余拓扑</text>
  <circle cx="70" cy="90" r="22" fill="#eef2ff" stroke="#6366f1"/>
  <text x="70" y="94" text-anchor="middle" font-size="11" fill="#4338ca">gNB-1</text>
  <circle cx="200" cy="90" r="22" fill="#eef2ff" stroke="#6366f1"/>
  <text x="200" y="94" text-anchor="middle" font-size="11" fill="#4338ca">gNB-2</text>
  <line x1="92" y1="90" x2="180" y2="90" stroke="#6366f1" stroke-width="2"/>
  <rect x="330" y="40" width="100" height="50" rx="6" fill="#dcfce7" stroke="#16a34a"/>
  <text x="380" y="69" text-anchor="middle" font-size="12" fill="#15803d">汇聚-1</text>
  <rect x="330" y="105" width="100" height="50" rx="6" fill="#dcfce7" stroke="#16a34a"/>
  <text x="380" y="134" text-anchor="middle" font-size="12" fill="#15803d">汇聚-2</text>
  <line x1="222" y1="78" x2="330" y2="65" stroke="#16a34a" stroke-width="2"/>
  <line x1="222" y1="102" x2="330" y2="130" stroke="#16a34a" stroke-width="2"/>
</svg>
"""


def main():
    base = ROOT / "data" / "parse"
    old_dir = base / "json" / OLD_VER
    new_dir = base / "json" / NEW_VER
    res_dir = base / "hedex" / "resources"
    for d in (old_dir, new_dir, res_dir):
        d.mkdir(parents=True, exist_ok=True)

    (old_dir / "chapters.json").write_text(
        json.dumps(make_old(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (new_dir / "chapters.json").write_text(
        json.dumps(make_new(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (res_dir / "topo_v1.svg").write_text(TOPO_OLD, encoding="utf-8")
    (res_dir / "topo_v2.svg").write_text(TOPO_NEW, encoding="utf-8")

    # 一个以 .html 结尾的资源引用样例，模拟真实 hedex 中 zh-cn_topic_*.html 文件
    (res_dir / "zh-cn_topic_mock_image.html").write_text(
        '<!doctype html><title>mock image resource</title>'
        '<img src="topo_v1.svg" alt="mock"/>', encoding="utf-8"
    )
    print(f"OK: wrote OLD={len(make_old())} chapters to {old_dir / 'chapters.json'}")
    print(f"OK: wrote NEW={len(make_new())} chapters to {new_dir / 'chapters.json'}")
    print(f"OK: wrote resources (topo_v1.svg, topo_v2.svg, zh-cn_topic_mock_image.html) to {res_dir}")


if __name__ == "__main__":
    main()
