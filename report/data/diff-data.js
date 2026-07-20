/**
 * 本文件由 scripts/generate_report.py 自动生成, 请勿手工编辑.
 * 输入: data/parse/json/<OLD_VER> 与 <NEW_VER> 下的章节 JSON;
 * 输出: window.DIFF_DATA, 供 report/index.html 渲染.
 */
window.DIFF_DATA = {
  "meta": {
    "name": "5G RAN 特性文档 版本对比",
    "oldVersion": "5G RAN10.1",
    "newVersion": "5G RAN10.2",
    "generatedAt": "2026-07-20 21:03",
    "sourceDoc": "5G RAN 特性文档 (5G RAN10.1 → 5G RAN10.2)",
    "stats": {
      "add": 1,
      "del": 1,
      "chg": 4,
      "img": 1
    }
  },
  "chapters": [
    {
      "id": "ch1",
      "title": "特性文档",
      "status": "chg",
      "bridge": true,
      "children": [
        {
          "id": "ch1-1",
          "title": "文档包信息",
          "status": "chg",
          "bridge": false,
          "children": [
            {
              "id": "ch1-1-1",
              "title": "无线文档体系",
              "status": "chg",
              "bridge": false,
              "children": []
            }
          ]
        },
        {
          "id": "ch1-2",
          "title": "接口与流量",
          "status": "chg",
          "bridge": true,
          "children": [
            {
              "id": "ch1-2-1",
              "title": "状态接口",
              "status": "chg",
              "bridge": false,
              "children": []
            },
            {
              "id": "ch1-2-2",
              "title": "流量控制策略",
              "status": "del",
              "bridge": false,
              "children": []
            },
            {
              "id": "ch1-2-3",
              "title": "VLAN 隔离特性",
              "status": "add",
              "bridge": false,
              "children": []
            }
          ]
        },
        {
          "id": "ch1-3",
          "title": "修订历史",
          "status": "chg",
          "bridge": false,
          "children": []
        }
      ]
    }
  ],
  "paragraphsByChapter": {
    "ch1-3": [
      {
        "id": "ch1-3-p1",
        "type": "heading",
        "status": "keep",
        "level": 2,
        "title": "修订历史",
        "contentHtml": "<h2 class=\"diff-h\">修订历史</h2>"
      },
      {
        "id": "ch1-3-p2",
        "type": "table",
        "status": "chg",
        "level": null,
        "title": "修订历史表 (RAN10.1)\n版本发布日期修订",
        "oldHtml": "<table class=\"data-table\"><caption>修订历史表 (RAN10.1)</caption>\n<thead><tr><th>版本</th><th>发布日期</th><th>修订要点</th></tr></thead>\n<tbody>\n<tr><td>RAN10.1.0</td><td>2024-03-15</td><td>首次发布 RAN10.1 基线版本</td></tr><tr><td>RAN10.1.1</td><td>2024-06-15</td><td>新增 gNB 接口与流量章节修订</td></tr></tbody></table>",
        "newHtml": "<table class=\"data-table\"><caption>修订历史表 (RAN10.2)</caption>\n<thead><tr><th>版本</th><th>发布日期</th><th>修订要点</th></tr></thead>\n<tbody>\n<tr><td>RAN10.1.0</td><td>2024-03-15</td><td>首次发布 RAN10.1 基线版本</td></tr><tr><td>RAN10.1.1</td><td>2024-06-15</td><td>新增 gNB 接口与流量章节修订</td></tr><tr><td class=\"cell-add\">RAN10.2.0</td><td class=\"cell-add\">2024-09-15</td><td class=\"cell-add\">RAN10.2 基线版本：新增 VLAN 隔离与管理面状态扩展</td></tr></tbody></table>"
      },
      {
        "id": "ch1-3-p3",
        "type": "text",
        "status": "add",
        "level": null,
        "title": "后续修订历史将由 RAN10.2 维护团队维护，",
        "oldHtml": "<div class=\"diff-empty\">(旧版本无此内容)</div>",
        "newHtml": "<p class=\"diff-p\">后续修订历史将由 RAN10.2 维护团队维护，RAN10.1 进入冻结状态不再追加新条目。</p>"
      }
    ],
    "ch1-2-3": [
      {
        "id": "ch1-2-3-p1",
        "type": "heading",
        "status": "add",
        "level": 2,
        "title": "VLAN 隔离特性概述",
        "oldHtml": "<div class=\"diff-empty\">(旧版本无此内容)</div>",
        "newHtml": "<h2 class=\"diff-h\">VLAN 隔离特性概述</h2>"
      },
      {
        "id": "ch1-2-3-p2",
        "type": "text",
        "status": "add",
        "level": null,
        "title": "本章节为 RAN10.2 新增功能，描述 5G ",
        "oldHtml": "<div class=\"diff-empty\">(旧版本无此内容)</div>",
        "newHtml": "<p class=\"diff-p\">本章节为 RAN10.2 新增功能，描述 5G RAN 在用户面与控制面分离场景下 VLAN 隔离的实现方式与\n典型部署约束，避免不同业务 VLAN 间的二层数据互通。</p>"
      },
      {
        "id": "ch1-2-3-p3",
        "type": "heading",
        "status": "add",
        "level": 3,
        "title": "典型部署约束",
        "oldHtml": "<div class=\"diff-empty\">(旧版本无此内容)</div>",
        "newHtml": "<h3 class=\"diff-h\">典型部署约束</h3>"
      },
      {
        "id": "ch1-2-3-p4",
        "type": "list",
        "status": "add",
        "level": null,
        "title": "同一 VLAN 内的 gNB 节点应部署在同一物",
        "oldHtml": "<div class=\"diff-empty\">(旧版本无此内容)</div>",
        "newHtml": "<ul class=\"data-list\"><li>同一 VLAN 内的 gNB 节点应部署在同一物理子网，避免跨网段转发</li>\n<li>不同业务 VLAN 间启用端口隔离组 (port-isolate group)</li>\n<li>多租户场景推荐使用 VLAN Mapping + VRF 实现三层隔离</li></ul>"
      }
    ],
    "ch1-2-2": [
      {
        "id": "ch1-2-2-p1",
        "type": "text",
        "status": "del",
        "level": null,
        "title": "本章节描述 5G RAN10.1 的流量控制策略",
        "oldHtml": "<p class=\"diff-p\">本章节描述 5G RAN10.1 的流量控制策略，包括全局速率限制、流分类与队列调度机制；\n该章节在 RAN10.2 中被合并到 <b>接口与流量</b> 总章节，本章不再独立维护。</p>",
        "newHtml": "<div class=\"diff-empty\">(新版本中已删除)</div>"
      },
      {
        "id": "ch1-2-2-p2",
        "type": "text",
        "status": "del",
        "level": null,
        "title": "默认队列调度算法采用 SP + WRR，单板最大",
        "oldHtml": "<p class=\"diff-p\">默认队列调度算法采用 <code>SP + WRR</code>，单板最大支持 8 个调度队列。</p>",
        "newHtml": "<div class=\"diff-empty\">(新版本中已删除)</div>"
      }
    ],
    "ch1-2-1": [
      {
        "id": "ch1-2-1-p1",
        "type": "heading",
        "status": "chg",
        "level": 2,
        "title": "状态接口说明",
        "oldHtml": "<h2 class=\"diff-h\">状态接口<span class=\"del\">概述</span></h2>",
        "newHtml": "<h2 class=\"diff-h\">状态接口<span class=\"add\">说明</span></h2>"
      },
      {
        "id": "ch1-2-1-p2",
        "type": "text",
        "status": "chg",
        "level": null,
        "title": "状态接口用于上报 RAN 节点运行状态，包括 C",
        "oldHtml": "<p class=\"diff-p\">状态接口用于上报 RAN 节点运行状态，包括 CPU 利用率、内存占用、链路通断、连接数<span class=\"del\">与</span>告警聚合信息，<span class=\"del\">\n</span>为运维系统提供基础监控数据来源。</p>",
        "newHtml": "<p class=\"diff-p\">状态接口用于上报 RAN 节点运行状态，包括 CPU 利用率、内存占用、链路通断、连接数<span class=\"add\">、</span>告警聚合信息<span class=\"add\">与\n<b>电源状态</b></span>，为运维系统提供基础监控数据来源<span class=\"add\">，并支持按需推送到第三方监控平台</span>。</p>"
      },
      {
        "id": "ch1-2-1-p3",
        "type": "table",
        "status": "chg",
        "level": null,
        "title": "表 3-1 RAN10.1 状态接口字段\n字段类",
        "oldHtml": "<table class=\"data-table\"><caption>表 3-1 RAN10.1 状态接口字段</caption>\n<thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead>\n<tbody>\n<tr><td>cpu_usage</td><td>int</td><td>CPU 利用率百分比</td></tr><tr><td>mem_usage</td><td>int</td><td>内存利用率百分比</td></tr><tr><td>link_status</td><td>bitset</td><td>链路状态位图</td></tr></tbody></table>",
        "newHtml": "<table class=\"data-table\"><caption>表 3-1 RAN10.2 状态接口字段</caption>\n<thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead>\n<tbody>\n<tr><td>cpu_usage</td><td>int</td><td>CPU 利用率百分比</td></tr><tr><td>mem_usage</td><td>int</td><td>内存利用率百分比</td></tr><tr><td>link_status</td><td>bitset</td><td>链路状态位图</td></tr><tr><td class=\"cell-add\">power_state</td><td class=\"cell-add\">enum</td><td class=\"cell-add\">电源状态 (ON/OFF/STANDBY)</td></tr></tbody></table>"
      }
    ],
    "ch1-1": [
      {
        "id": "ch1-1-p1",
        "type": "text",
        "status": "chg",
        "level": null,
        "title": "本特性文档面向 5G RAN 网络规划与运维人员",
        "oldHtml": "<p class=\"diff-p\">本特性文档面向 5G RAN 网络规划与运维人员，介绍 5G RAN10.<span class=\"del\">1</span> 系统的设备组成、功能特性、\n修订历史与文档体系结构等信息，便于读者快速了解产品定位与改造范围。</p>",
        "newHtml": "<p class=\"diff-p\">本特性文档面向 5G RAN 网络规划与运维人员，介绍 5G RAN10.<span class=\"add\">2</span> 系统的设备组成、功能特性、\n修订历史与文档体系结构等信息，便于读者快速了解产品定位与改造范围。</p>"
      },
      {
        "id": "ch1-1-p2",
        "type": "text",
        "status": "keep",
        "level": null,
        "title": "文档采用层级结构组织：特性文档 为顶层目录，下含",
        "contentHtml": "<p class=\"diff-p\">文档采用层级结构组织：<b>特性文档</b> 为顶层目录，下含 <b>文档包信息</b>、\n<b>接口与流量</b>、<b>修订历史</b> 等章节。如需了解具体子模块，可在左侧章节树点击向下展开。</p>"
      }
    ],
    "ch1-1-1": [
      {
        "id": "ch1-1-1-p1",
        "type": "heading",
        "status": "keep",
        "level": 2,
        "title": "无线文档体系概述",
        "contentHtml": "<h2 class=\"diff-h\">无线文档体系概述</h2>"
      },
      {
        "id": "ch1-1-1-p2",
        "type": "text",
        "status": "chg",
        "level": null,
        "title": "本章介绍 5G RAN10.2 各功能平台文档的",
        "oldHtml": "<p class=\"diff-p\">本章介绍 5G RAN10.<span class=\"del\">1</span> 各功能平台文档的组成与存放规则，并说明无线文档体系的层级划分、版本管理与发布流程。</p>",
        "newHtml": "<p class=\"diff-p\">本章介绍 5G RAN10.<span class=\"add\">2</span> 各功能平台文档的组成与存放规则，并说明无线文档体系的层级划分、版本管理与发布流程。</p>"
      },
      {
        "id": "ch1-1-1-p3",
        "type": "heading",
        "status": "keep",
        "level": 3,
        "title": "文档层级结构",
        "contentHtml": "<h3 class=\"diff-h\">文档层级结构</h3>"
      },
      {
        "id": "ch1-1-1-p4",
        "type": "text",
        "status": "chg",
        "level": null,
        "title": "无线文档体系按 特性文档 → 子模块文档 → 接",
        "oldHtml": "<p class=\"diff-p\">无线文档体系按 <b>特性文档</b> → <b>子模块文档</b> → <b>接口/命令参考</b> 三级组织，\n覆盖 RAN10.<span class=\"del\">1</span> 系统的 gNB、传输网、运维面<span class=\"del\">三</span>大子域。</p>",
        "newHtml": "<p class=\"diff-p\">无线文档体系按 <b>特性文档</b> → <b>子模块文档</b> → <b>接口/命令参考</b> 三级组织，\n覆盖 RAN10.<span class=\"add\">2</span> 系统的 gNB、传输网、运维面<span class=\"add\">与 <b>云网管理</b> 四</span>大子域。</p>"
      },
      {
        "id": "ch1-1-1-p5",
        "type": "table",
        "status": "chg",
        "level": null,
        "title": "表 2-1 RAN10.1 平台文档存放规则\n平",
        "oldHtml": "<table class=\"data-table\"><caption>表 2-1 RAN10.1 平台文档存放规则</caption>\n<thead><tr><th>平台</th><th>存放路径</th><th>维护责任</th></tr></thead>\n<tbody>\n<tr><td>gNB 平台</td><td class=\"cell-del\">/opt/ran10.1/gnb</td><td>无线研发</td></tr><tr><td>传输网平台</td><td class=\"cell-del\">/opt/ran10.1/tn</td><td>传输研发</td></tr><tr><td>运维面</td><td class=\"cell-del\">/opt/ran10.1/ops</td><td>运维研发</td></tr></tbody></table>",
        "newHtml": "<table class=\"data-table\"><caption>表 2-1 RAN10.2 平台文档存放规则</caption>\n<thead><tr><th>平台</th><th>存放路径</th><th>维护责任</th></tr></thead>\n<tbody>\n<tr><td>gNB 平台</td><td class=\"cell-add\">/opt/ran10.2/gnb</td><td>无线研发</td></tr><tr><td>传输网平台</td><td class=\"cell-add\">/opt/ran10.2/tn</td><td>传输研发</td></tr><tr><td>运维面</td><td class=\"cell-add\">/opt/ran10.2/ops</td><td>运维研发</td></tr><tr><td class=\"cell-add\">云网管理</td><td class=\"cell-add\">/opt/ran10.2/cnm</td><td class=\"cell-add\">云网研发</td></tr></tbody></table>"
      },
      {
        "id": "ch1-1-1-p6",
        "type": "heading",
        "status": "keep",
        "level": 3,
        "title": "版本管理与发布",
        "contentHtml": "<h3 class=\"diff-h\">版本管理与发布</h3>"
      },
      {
        "id": "ch1-1-1-p7",
        "type": "text",
        "status": "chg",
        "level": null,
        "title": "RAN10.2 文档版本通过 git tag 管",
        "oldHtml": "<p class=\"diff-p\">RAN10.<span class=\"del\">1</span> 文档版本通过 git tag 管理，每月发布一次小版本；季度发布一次特性版本，\n每次发布同步更新产品 LAN 与组网拓扑示意图如下：</p>",
        "newHtml": "<p class=\"diff-p\">RAN10.<span class=\"add\">2</span> 文档版本通过 git tag 管理，每月发布一次小版本；季度发布一次特性版本，\n每次发布同步更新产品 LAN 与组网拓扑示意图如下<span class=\"add\">；新增支持 <b>双上联冗余</b> 拓扑</span>：</p>"
      },
      {
        "id": "ch1-1-1-p8",
        "type": "image",
        "status": "chg",
        "level": null,
        "title": "图 2-1 RAN10.1 单上联组网拓扑",
        "oldImage": "assets/images/hedex/topo_v1.svg",
        "newImage": "assets/images/hedex/topo_v2.svg",
        "oldCaption": "图 2-1 RAN10.1 单上联组网拓扑",
        "newCaption": "图 2-1 RAN10.2 双上联冗余组网拓扑",
        "oldHash": "89f236be199e",
        "newHash": "e259e5bb083d"
      },
      {
        "id": "ch1-1-1-p9",
        "type": "list",
        "status": "chg",
        "level": null,
        "title": "常规发布周期：每月 15 日\n特性发布周期：每季",
        "oldHtml": "<ul class=\"data-list\"><li>常规发布周期：每月 15 日</li>\n<li>特性发布周期：每季度首月发布</li>\n<li>紧急修订：通过 hotfix 分支单独发布</li></ul>",
        "newHtml": "<ul class=\"data-list\"><li>常规发布周期：每月 15 日</li>\n<li>特性发布周期：每季度首月发布</li>\n<li>紧急修订：通过 hotfix 分支单独发布</li><span class=\"add\">\n<li>新增 <b>灰度发布</b> 渠道，支持分租户灰度验证</li></span></ul>"
      }
    ]
  }
};
