/**
 * HDX 版本对比报告 假数据样例
 * 说明：
 *  - status: add(新增) / del(删除) / chg(修改) / keep(无变更)
 *  - 类型为 heading/text/table 时使用 oldHtml / newHtml 字符串直接渲染 (前端做 innerHTML)
 *    其中可包含 <span class="add|del|chg"> 做行内 diff 高亮
 *  - 类型为 image 时使用 oldImage/newImage 路径 + 旧/新描述 + hash
 *  - 章节 status 仅用于树高亮；段落 status 用于段落列表徽标及 diff 展示
 */
window.DIFF_DATA = {
  meta: {
    name: '华为 S5700 系列交换机 产品手册 版本对比',
    product: 'S5700',
    oldVersion: 'V1.8',
    newVersion: 'V1.9',
    generatedAt: '2026-07-20 10:30',
    sourceDoc: 'S5700 产品手册.hdx',
    stats: { add: 8, del: 6, chg: 7, img: 1 }
  },

  // ----- 章节树 -----
  chapters: [
    {
      id: 'ch1', title: '1 概述', status: 'chg',
      children: [
        { id: 'ch1-1', title: '1.1 产品定位', status: 'add', children: [] },
        {
          id: 'ch1-2', title: '1.2 功能特性', status: 'chg',
          children: [
            { id: 'ch1-2-1', title: '1.2.1 接口类型', status: 'keep', children: [] },
            { id: 'ch1-2-2', title: '1.2.2 组网限制', status: 'chg', children: [] },
            { id: 'ch1-2-3', title: '1.2.3 端口速率限制', status: 'del', children: [] }
          ]
        },
        { id: 'ch1-3', title: '1.3 硬件规格', status: 'keep', children: [] }
      ]
    },
    {
      id: 'ch2', title: '2 配置指南', status: 'chg',
      children: [
        { id: 'ch2-1', title: '2.1 初始配置', status: 'keep', children: [] },
        { id: 'ch2-2', title: '2.2 VLAN 配置', status: 'del', children: [] },
        { id: 'ch2-3', title: '2.3 安全配置', status: 'add', children: [] },
        { id: 'ch2-4', title: '2.4 接口聚合', status: 'chg', children: [] }
      ]
    }
  ],

  // ----- 段落（按章节聚合） -----
  paragraphsByChapter: {

    // 1.1 产品定位 - 新增
    'ch1-1': [
      {
        id: 'ch1-1-h', type: 'heading', status: 'add', title: '标题 1.1 产品定位',
        oldHtml: '<div class="diff-empty">(旧版无此章节)</div>',
        newHtml: '<h3 class="diff-h">1.1 产品定位</h3>'
      },
      {
        id: 'ch1-1-p1', type: 'text', status: 'add', title: '段落1 产品简介',
        oldHtml: '<div class="diff-empty">(旧版无此段落)</div>',
        newHtml: '<p class="diff-p">S5700 系列交换机是面向企业园区网接入/汇聚层的高性能千兆以太网交换机，提供 24/48 个 GE 下行端口及 4 个 10GE SFP+ 上行端口，支持堆叠、虚拟化、IPv6 等丰富特性。</p>'
      },
      {
        id: 'ch1-1-l1', type: 'list', status: 'add', title: '列表1 核心特性',
        oldHtml: '<div class="diff-empty">(新增列表)</div>',
        newHtml: '<ul class="data-list"><li>24/48 个 GE 下行端口</li><li>4 个 10GE SFP+ 上行端口</li><li>堆叠 (iStack)、虚拟化 (CSS)、IPv6 双栈</li></ul>'
      }
    ],

    // 1.2.2 组网限制 - keep + chg + add + keep + chg + chg + keep 穿插
    'ch1-2-2': [
      {
        id: 'ch1-2-2-intro', type: 'text', status: 'keep', title: '段落0 概述 (未变更)',
        contentHtml: '<p class="diff-p">本节描述 S5700 在典型园区组网场景下的部署约束与建议，供规划与运维参考。</p>'
      },
      {
        id: 'ch1-2-2-h', type: 'heading', status: 'chg', title: '标题 1.2.2',
        oldHtml: '<h3 class="diff-h">1.2.2 <span class="del">组网限制</span></h3>',
        newHtml: '<h3 class="diff-h">1.2.2 <span class="add">端口组网限制</span></h3>'
      },
      {
        id: 'ch1-2-2-p1', type: 'text', status: 'chg', title: '段落1 端口速率限制',
        oldHtml: '<p class="diff-p">接口速率上限为 <span class="del">1 Gbps</span>，下行端口支持半双工/全双工模式，最大转发速率 1.4 Mpps。</p>',
        newHtml: '<p class="diff-p">接口速率上限为 <span class="add">10 Gbps</span>，下行端口支持半双工/全双工模式与<span class="add">硬件流控</span>，最大转发速率 <span class="chg">14 Mpps</span>。</p>'
      },
      {
        id: 'ch1-2-2-p2', type: 'text', status: 'add', title: '段落2 端口隔离原则 (新增)',
        oldHtml: '<div class="diff-empty">(新增段落)</div>',
        newHtml: '<p class="diff-p">为防止单端口广播风暴跨域影响，建议在不同业务 VLAN 间启用端口隔离组 (port-isolate group 1~32)，避免不必要的二层数据互通。</p>'
      },
      {
        id: 'ch1-2-2-mid', type: 'text', status: 'keep', title: '段落3 端口默认值说明 (未变更)',
        contentHtml: '<p class="diff-p">下表给出各端口类型的出厂默认配置。如需修改，通过 interface 接口视图命令行调整。</p>'
      },
      {
        id: 'ch1-2-2-t1', type: 'table', status: 'chg', title: '表格1 端口默认参数',
        oldHtml:
          '<table class="data-table"><caption>表 1-1 端口默认参数 (V1.8)</caption>' +
          '<thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr>' +
          '<tr><td>10GE 光口</td><td class="cell-del">10 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr>' +
          '</tbody></table>',
        newHtml:
          '<table class="data-table"><caption>表 1-1 端口默认参数 (V1.9)</caption>' +
          '<thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr>' +
          '<tr><td>10GE 光口</td><td class="cell-add">25 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr>' +
          '<tr><td class="cell-add">25GE 光口</td><td class="cell-add">25 Gbps</td><td class="cell-add">全双工</td><td class="cell-add">开启</td></tr>' +
          '</tbody></table>'
      },
      {
        id: 'ch1-2-2-i1', type: 'image', status: 'chg', title: '图片1 典型组网拓扑',
        oldImage: 'assets/images/topo_v1.svg',
        newImage: 'assets/images/topo_v2.svg',
        oldCaption: 'V1.8 拓扑 (单上联)',
        newCaption: 'V1.9 拓扑 (双上联冗余)',
        oldHash: 'a3f1d2…',
        newHash: 'b8c4e0…'
      },
      {
        id: 'ch1-2-2-tail', type: 'text', status: 'keep', title: '段落5 部署提示 (未变更)',
        contentHtml: '<p class="diff-p">在双上联冗余场景下，应配合 MSTP/VRRP 使用，以保证二层无环与三层网关切换。</p>'
      }
    ],

    // 1.2.3 端口速率限制 - 整段删除
    'ch1-2-3': [
      {
        id: 'ch1-2-3-h', type: 'heading', status: 'del', title: '标题 1.2.3',
        oldHtml: '<h3 class="diff-h">1.2.3 <span class="del">端口速率限制</span></h3>',
        newHtml: '<div class="diff-empty">(新版本中整节已删除)</div>'
      },
      {
        id: 'ch1-2-3-p1', type: 'text', status: 'del', title: '段落1 限速策略 (整段删除)',
        oldHtml: '<p class="diff-p"><span class="del">每端口支持基于 CAR (Committed Access Rate) 的入方向限速，最低步长 64 kbps，最大 4 Gbps。</span></p>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>'
      }
    ],

    // 1.2.1 接口类型 - 整章无变更 (上下文)
    'ch1-2-1': [
      {
        id: 'ch1-2-1-h', type: 'heading', status: 'keep', title: '标题 1.2.1 接口类型',
        contentHtml: '<h3 class="diff-h">1.2.1 接口类型</h3>'
      },
      {
        id: 'ch1-2-1-p1', type: 'text', status: 'keep', title: '段落1 接口概述',
        contentHtml: '<p class="diff-p">S5700 提供丰富的端口形态，包括 GE 电口、GE 光口 (SFP)、10GE 光口 (SFP+)，下行带宽 48 Gbps，上行带宽 40 Gbps。</p>'
      },
      {
        id: 'ch1-2-1-t1', type: 'table', status: 'keep', title: '表格1 接口规格',
        contentHtml:
          '<table class="data-table"><caption>表 1-1 S5700 接口规格</caption>' +
          '<thead><tr><th>接口</th><th>速率</th><th>介质</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>GE 电口</td><td>1 Gbps</td><td>双绞线 Cat5e+</td></tr>' +
          '<tr><td>GE 光口</td><td>1 Gbps</td><td>SFP</td></tr>' +
          '<tr><td>10GE 光口</td><td>10 Gbps</td><td>SFP+</td></tr>' +
          '</tbody></table>'
      }
    ],

    // 2.2 VLAN 配置 - 整节删除
    'ch2-2': [
      {
        id: 'ch2-2-h', type: 'heading', status: 'del', title: '标题 2.2 VLAN 配置',
        oldHtml: '<h3 class="diff-h">2.2 <span class="del">VLAN 配置</span></h3>',
        newHtml: '<div class="diff-empty">(整节已删除)</div>'
      },
      {
        id: 'ch2-2-p1', type: 'text', status: 'del', title: '段落1 VLAN 创建 (已删除)',
        oldHtml: '<p class="diff-p"><span class="del">使用 vlan batch 10 20 30 命令可批量创建 VLAN，且支持 1~4094 范围。</span></p>',
        newHtml: '<div class="diff-empty">(已删除)</div>'
      },
      {
        id: 'ch2-2-t1', type: 'table', status: 'del', title: '表格1 VLAN 命令对照 (已删除)',
        oldHtml:
          '<table class="data-table"><caption>表 2-1 VLAN 常用命令 (V1.8)</caption>' +
          '<thead><tr><th>操作</th><th>命令</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>创建 VLAN</td><td class="cell-del">vlan batch 10 20</td></tr>' +
          '<tr><td>命名 VLAN</td><td class="cell-del">vlan 10 description user-zone</td></tr>' +
          '<tr><td>查看 VLAN</td><td class="cell-del">display vlan</td></tr>' +
          '</tbody></table>',
        newHtml: '<div class="diff-empty">(已删除)</div>'
      }
    ],

    // 2.3 安全配置 - 新增整节
    'ch2-3': [
      {
        id: 'ch2-3-h', type: 'heading', status: 'add', title: '标题 2.3 安全配置',
        oldHtml: '<div class="diff-empty">(新增章节)</div>',
        newHtml: '<h3 class="diff-h">2.3 <span class="add">安全配置</span></h3>'
      },
      {
        id: 'ch2-3-p1', type: 'text', status: 'add', title: '段落1 ACL 配置 (新增)',
        oldHtml: '<div class="diff-empty">(新增段落)</div>',
        newHtml: '<p class="diff-p">支持基于 ACL 3000-3999 的 IPv4 高级访问控制列表，可对五元组精确匹配，单板最大规则数 <span class="add">8192</span> 条。</p>'
      },
      {
        id: 'ch2-3-t1', type: 'table', status: 'add', title: '表格1 安全特性矩阵 (新增)',
        oldHtml: '<div class="diff-empty">(新增表格)</div>',
        newHtml:
          '<table class="data-table"><caption>表 2-2 安全特性支持矩阵 (V1.9 新增)</caption>' +
          '<thead><tr><th>特性</th><th>支持版本</th><th>说明</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>ACL</td><td class="cell-add">V1.9+</td><td class="cell-add">IPv4/IPv6 双栈</td></tr>' +
          '<tr><td>ARP 防护</td><td class="cell-add">V1.9+</td><td class="cell-add">动态 ARP 检测 + IP-MAC 绑定</td></tr>' +
          '<tr><td>端口安全</td><td class="cell-add">V1.9+</td><td class="cell-add">MAC 限制 + Sticky MAC</td></tr>' +
          '</tbody></table>'
      },
      {
        id: 'ch2-3-l1', type: 'list', status: 'add', title: '列表1 新增命令 (新增)',
        oldHtml: '<div class="diff-empty">(新增列表)</div>',
        newHtml: '<ul class="data-list"><li><span class="add">display acl all</span>: 查看所有 ACL</li><li><span class="add">traffic-filter inbound acl 3001</span>: 端口入方向应用 ACL</li><li><span class="add">arp detection</span>: 启用动态 ARP 检测</li></ul>'
      }
    ],

    // 2.4 接口聚合 - keep + chg + chg + chg + keep 穿插
    'ch2-4': [
      {
        id: 'ch2-4-intro', type: 'text', status: 'keep', title: '段落0 概述 (未变更)',
        contentHtml: '<p class="diff-p">Eth-Trunk (链路聚合) 将多条物理链路捆绑为一条逻辑链路，提升带宽并提供链路冗余。</p>'
      },
      {
        id: 'ch2-4-h', type: 'heading', status: 'chg', title: '标题 2.4',
        oldHtml: '<h3 class="diff-h">2.4 <span class="del">接口聚合</span></h3>',
        newHtml: '<h3 class="diff-h">2.4 <span class="add">链路聚合 (Eth-Trunk)</span></h3>'
      },
      {
        id: 'ch2-4-p1', type: 'text', status: 'chg', title: '段落1 聚合模式',
        oldHtml: '<p class="diff-p">S5700 支持<span class="del">手工负载分担</span>模式聚合，最大<span class="del">8</span>条成员链路。</p>',
        newHtml: '<p class="diff-p">S5700 支持<span class="add">手工负载分担 + LACP 动态聚合</span>模式，最大<span class="add">16</span>条成员链路，单 Eth-Trunk 转发带宽提升至 <span class="add">160 Gbps</span>。</p>'
      },
      {
        id: 'ch2-4-t1', type: 'table', status: 'chg', title: '表格1 聚合模式对照',
        oldHtml:
          '<table class="data-table"><caption>表 2-3 Eth-Trunk 模式 (V1.8)</caption>' +
          '<thead><tr><th>模式</th><th>成员数上限</th><th>负载分担</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>手工</td><td>8</td><td>源/目的 MAC</td></tr>' +
          '<tr><td class="cell-empty">LACP</td><td class="cell-empty">—</td><td class="cell-empty">未支持</td></tr>' +
          '</tbody></table>',
        newHtml:
          '<table class="data-table"><caption>表 2-3 Eth-Trunk 模式 (V1.9)</caption>' +
          '<thead><tr><th>模式</th><th>成员数上限</th><th>负载分担</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>手工</td><td class="cell-chg">16</td><td>源/目的 MAC + IP</td></tr>' +
          '<tr><td class="cell-add">LACP 动态</td><td class="cell-add">16</td><td class="cell-add">源/目的 MAC + IP + 端口</td></tr>' +
          '</tbody></table>'
      },
      {
        id: 'ch2-4-l1', type: 'list', status: 'keep', title: '列表1 配置建议 (未变更)',
        contentHtml: '<ul class="data-list"><li>同一 Eth-Trunk 内成员链路速率、双工需一致</li><li>跨设备堆叠场景支持跨框聚合 (CSS)</li><li>负载分担建议源+目的 IP+端口五元组</li></ul>'
      }
    ],

    // 1.3 硬件规格 - 整章无变更 (上下文)
    'ch1-3': [
      {
        id: 'ch1-3-h', type: 'heading', status: 'keep', title: '标题 1.3 硬件规格',
        contentHtml: '<h3 class="diff-h">1.3 硬件规格</h3>'
      },
      {
        id: 'ch1-3-p1', type: 'text', status: 'keep', title: '段落1 外形',
        contentHtml: '<p class="diff-p">S5700 采用 1U 标准 19 英寸机箱，支持前后通风，适合高密度数据中心与园区接入部署。</p>'
      },
      {
        id: 'ch1-3-t1', type: 'table', status: 'keep', title: '表格1 型号规格',
        contentHtml:
          '<table class="data-table"><caption>表 1-3 S5700 型号规格</caption>' +
          '<thead><tr><th>型号</th><th>下行端口</th><th>上行端口</th><th>功耗</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>S5700-24</td><td>24 GE</td><td>4×10GE</td><td><120 W</td></tr>' +
          '<tr><td>S5700-48</td><td>48 GE</td><td>4×10GE</td><td><160 W</td></tr>' +
          '</tbody></table>'
      }
    ],

    // 2.1 初始配置 - 整章无变更 (上下文)
    'ch2-1': [
      {
        id: 'ch2-1-h', type: 'heading', status: 'keep', title: '标题 2.1 初始配置',
        contentHtml: '<h3 class="diff-h">2.1 初始配置</h3>'
      },
      {
        id: 'ch2-1-p1', type: 'text', status: 'keep', title: '段落1 准备工作',
        contentHtml: '<p class="diff-p">开箱后请先通过 Console 口登录设备，完成主机名、管理 IP、SSH 用户开通等基础配置。</p>'
      },
      {
        id: 'ch2-1-l1', type: 'list', status: 'keep', title: '列表1 初始配置步骤',
        contentHtml: '<ul class="data-list"><li>Console 口连接与波特率配置 (9600 8N1)</li><li>设备命名: sysname S5700-Edge</li><li>管理 VLAN 与管理 IP 配置</li><li>SSH 用户与 AAA 远程认证</li></ul>'
      }
    ]
  }
};
