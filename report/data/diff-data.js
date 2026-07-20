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
    stats: { add: 24, del: 7, chg: 15, img: 3 }
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
      }
    ],

    // 1.2.2 组网限制 - 修改 (覆盖文本/标题/表格/图片四种类型)
    'ch1-2-2': [
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

    // 1.2.1 接口类型 - 无变更
    'ch1-2-1': [],

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
      }
    ],

    // 2.4 接口聚合 - 修改
    'ch2-4': [
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
      }
    ]
  }
};
