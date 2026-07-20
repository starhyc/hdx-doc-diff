/**
 * HDX 版本对比报告 假数据样例 (v3: 每章每节完整上下文 demo)
 * 数据说明：
 *  - status: add(新增) / del(删除) / chg(修改) / keep(无变更)
 *  - heading 段落带 level (1=章如 1, 2=节如 1.1, 3=子节如 1.2.1)
 *  - keep 段落用 contentHtml 单栏字段 (新旧一致)
 *  - 变更段落用 oldHtml / newHtml (前端做行内 diff 高亮)
 *  - image 段落用 oldImage/newImage + 描述 + hash
 *  - 父章节 (ch1, ch2, ch1-2) inline 子节完整内容 (用于"整章"视图)
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

  // ===== 章节树 (左侧导航) =====
  chapters: [
    {
      id: 'ch1', title: '1 概述', status: 'chg',
      children: [
        { id: 'ch1-1', title: '1.1 产品定位', status: 'add', children: [] },
        {
          id: 'ch1-2', title: '1.2 功能特性', status: 'chg',
          children: [
            { id: 'ch1-2-1', title: '1.2.1 接口类型',          status: 'keep', children: [] },
            { id: 'ch1-2-2', title: '1.2.2 组网限制',          status: 'chg',  children: [] },
            { id: 'ch1-2-3', title: '1.2.3 端口速率限制',      status: 'del',  children: [] }
          ]
        },
        { id: 'ch1-3', title: '1.3 硬件规格', status: 'keep', children: [] }
      ]
    },
    {
      id: 'ch2', title: '2 配置指南', status: 'chg',
      children: [
        { id: 'ch2-1', title: '2.1 初始配置',   status: 'keep', children: [] },
        { id: 'ch2-2', title: '2.2 VLAN 配置', status: 'del',  children: [] },
        { id: 'ch2-3', title: '2.3 安全配置',   status: 'add',  children: [] },
        { id: 'ch2-4', title: '2.4 接口聚合',   status: 'chg',  children: [] }
      ]
    }
  ],

  paragraphsByChapter: {

    // ============ 1 概述 (整章) ============
    'ch1': [
      { id: 'c1-i0', type: 'text', status: 'keep', title: '章节概述',
        contentHtml: '<p class="diff-p">本章节描述 S5700 系列交换机的整体定位、功能特性与硬件规格，作为产品入门与选型参考。</p>' },

      { id: 'c1-1h', type: 'heading', level: 2, status: 'add', title: '1.1 产品定位',
        oldHtml: '<div class="diff-empty">(旧版本无此节)</div>',
        newHtml: '<h2 class="diff-h">1.1 产品定位</h2>' },
      { id: 'c1-1p1', type: 'text', status: 'add', title: '产品简介',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<p class="diff-p">S5700 系列交换机是面向企业园区网接入/汇聚层的高性能千兆以太网交换机，提供 24/48 个 GE 下行端口及 4 个 10GE SFP+ 上行端口，支持堆叠、虚拟化、IPv6 等丰富特性。</p>' },
      { id: 'c1-1l1', type: 'list', status: 'add', title: '核心特性',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<ul class="data-list"><li>24/48 个 GE 下行端口</li><li>4 个 10GE SFP+ 上行端口</li><li>堆叠 (iStack)、虚拟化 (CSS)、IPv6 双栈</li></ul>' },

      { id: 'c1-2h', type: 'heading', level: 2, status: 'chg', title: '1.2 功能特性',
        oldHtml: '<h2 class="diff-h">1.2 <span class="del">功能特性</span></h2>',
        newHtml: '<h2 class="diff-h">1.2 <span class="add">核心特性</span></h2>' },
      { id: 'c1-2intro', type: 'text', status: 'keep', title: '本节概述',
        contentHtml: '<p class="diff-p">本节列出 S5700 的接口类型、组网限制与端口速率等关键特性，作为产品规划与运维参考。</p>' },

      { id: 'c1-2-1h', type: 'heading', level: 3, status: 'keep', title: '1.2.1 接口类型',
        contentHtml: '<h3 class="diff-h">1.2.1 接口类型</h3>' },
      { id: 'c1-2-1p', type: 'text', status: 'keep', title: '接口概述',
        contentHtml: '<p class="diff-p">S5700 提供丰富的端口形态，包括 GE 电口、GE 光口 (SFP)、10GE 光口 (SFP+)，下行带宽 48 Gbps，上行带宽 40 Gbps。</p>' },
      { id: 'c1-2-1t', type: 'table', status: 'keep', title: '接口规格',
        contentHtml: '<table class="data-table"><caption>表 1-1 S5700 接口规格</caption><thead><tr><th>接口</th><th>速率</th><th>介质</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>双绞线 Cat5e+</td></tr><tr><td>GE 光口</td><td>1 Gbps</td><td>SFP</td></tr><tr><td>10GE 光口</td><td>10 Gbps</td><td>SFP+</td></tr></tbody></table>' },

      { id: 'c1-2-2h', type: 'heading', level: 3, status: 'chg', title: '1.2.2 组网限制',
        oldHtml: '<h3 class="diff-h">1.2.2 <span class="del">组网限制</span></h3>',
        newHtml: '<h3 class="diff-h">1.2.2 <span class="add">端口组网限制</span></h3>' },
      { id: 'c1-2-2intro', type: 'text', status: 'keep', title: '概述',
        contentHtml: '<p class="diff-p">本节描述 S5700 在典型园区组网场景下的部署约束与建议。</p>' },
      { id: 'c1-2-2p1', type: 'text', status: 'chg', title: '端口速率限制',
        oldHtml: '<p class="diff-p">接口速率上限为 <span class="del">1 Gbps</span>，下行端口支持半双工/全双工模式，最大转发速率 1.4 Mpps。</p>',
        newHtml: '<p class="diff-p">接口速率上限为 <span class="add">10 Gbps</span>，下行端口支持半双工/全双工模式与<span class="add">硬件流控</span>，最大转发速率 <span class="chg">14 Mpps</span>。</p>' },
      { id: 'c1-2-2p2', type: 'text', status: 'add', title: '端口隔离原则',
        oldHtml: '<div class="diff-empty">(新增内容)</div>',
        newHtml: '<p class="diff-p">为防止单端口广播风暴跨域影响，建议在不同业务 VLAN 间启用端口隔离组 (port-isolate group 1~32)，避免不必要的二层数据互通。</p>' },
      { id: 'c1-2-2mid', type: 'text', status: 'keep', title: '端口默认值说明',
        contentHtml: '<p class="diff-p">下表给出各端口类型的出厂默认配置；如需修改，可通过 interface 接口视图命令行调整。</p>' },
      { id: 'c1-2-2t1', type: 'table', status: 'chg', title: '端口默认参数',
        oldHtml: '<table class="data-table"><caption>表 1-2 端口默认参数 (V1.8)</caption><thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr><tr><td>10GE 光口</td><td class="cell-del">10 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr></tbody></table>',
        newHtml: '<table class="data-table"><caption>表 1-2 端口默认参数 (V1.9)</caption><thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr><tr><td>10GE 光口</td><td class="cell-add">25 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr><tr><td class="cell-add">25GE 光口</td><td class="cell-add">25 Gbps</td><td class="cell-add">全双工</td><td class="cell-add">开启</td></tr></tbody></table>' },
      { id: 'c1-2-2img', type: 'image', status: 'chg', title: '组网拓扑',
        oldImage: 'assets/images/topo_v1.svg', newImage: 'assets/images/topo_v2.svg',
        oldCaption: 'V1.8 拓扑 (单上联)', newCaption: 'V1.9 拓扑 (双上联冗余)',
        oldHash: 'a3f1d2…', newHash: 'b8c4e0…' },
      { id: 'c1-2-2tail', type: 'text', status: 'keep', title: '部署提示',
        contentHtml: '<p class="diff-p">在双上联冗余场景下，应配合 MSTP/VRRP 使用，以保证二层无环与三层网关切换。</p>' },

      { id: 'c1-2-3h', type: 'heading', level: 3, status: 'del', title: '1.2.3 端口速率限制',
        oldHtml: '<h3 class="diff-h">1.2.3 <span class="del">端口速率限制</span></h3>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c1-2-3p1', type: 'text', status: 'del', title: '限速策略',
        oldHtml: '<p class="diff-p"><span class="del">每端口支持基于 CAR (Committed Access Rate) 的入方向限速，最低步长 64 kbps，最大 4 Gbps。</span></p>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },

      { id: 'c1-3h', type: 'heading', level: 2, status: 'keep', title: '1.3 硬件规格',
        contentHtml: '<h2 class="diff-h">1.3 硬件规格</h2>' },
      { id: 'c1-3p', type: 'text', status: 'keep', title: '外形',
        contentHtml: '<p class="diff-p">S5700 采用 1U 标准 19 英寸机箱，支持前后通风，适合高密度数据中心与园区接入部署。</p>' },
      { id: 'c1-3t', type: 'table', status: 'keep', title: '型号规格',
        contentHtml: '<table class="data-table"><caption>表 1-3 S5700 型号规格</caption><thead><tr><th>型号</th><th>下行端口</th><th>上行端口</th><th>功耗</th></tr></thead><tbody><tr><td>S5700-24</td><td>24 GE</td><td>4×10GE</td><td><120 W</td></tr><tr><td>S5700-48</td><td>48 GE</td><td>4×10GE</td><td><160 W</td></tr></tbody></table>' }
    ],

    // ============ 1.1 产品定位 (单节) ============
    'ch1-1': [
      { id: 'c11-h', type: 'heading', level: 2, status: 'add', title: '1.1 产品定位',
        oldHtml: '<div class="diff-empty">(旧版本无此节)</div>',
        newHtml: '<h2 class="diff-h">1.1 产品定位</h2>' },
      { id: 'c11-p1', type: 'text', status: 'add', title: '产品简介',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<p class="diff-p">S5700 系列交换机是面向企业园区网接入/汇聚层的高性能千兆以太网交换机，提供 24/48 个 GE 下行端口及 4 个 10GE SFP+ 上行端口，支持堆叠、虚拟化、IPv6 等丰富特性。</p>' },
      { id: 'c11-l1', type: 'list', status: 'add', title: '核心特性',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<ul class="data-list"><li>24/48 个 GE 下行端口</li><li>4 个 10GE SFP+ 上行端口</li><li>堆叠 (iStack)、虚拟化 (CSS)、IPv6 双栈</li></ul>' }
    ],

    // ============ 1.2 功能特性 (整节, 含 1.2.1/1.2.2/1.2.3 子节 inline) ============
    'ch1-2': [
      { id: 'c12-intro', type: 'text', status: 'keep', title: '本节概述',
        contentHtml: '<p class="diff-p">本节列出 S5700 的接口类型、组网限制与端口速率等关键特性，作为产品规划与运维参考。</p>' },

      { id: 'c12-2-1h', type: 'heading', level: 3, status: 'keep', title: '1.2.1 接口类型',
        contentHtml: '<h3 class="diff-h">1.2.1 接口类型</h3>' },
      { id: 'c12-2-1p', type: 'text', status: 'keep', title: '接口概述',
        contentHtml: '<p class="diff-p">S5700 提供丰富的端口形态，包括 GE 电口、GE 光口 (SFP)、10GE 光口 (SFP+)，下行带宽 48 Gbps，上行带宽 40 Gbps。</p>' },
      { id: 'c12-2-1t', type: 'table', status: 'keep', title: '接口规格',
        contentHtml: '<table class="data-table"><caption>表 1-1 S5700 接口规格</caption><thead><tr><th>接口</th><th>速率</th><th>介质</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>双绞线 Cat5e+</td></tr><tr><td>GE 光口</td><td>1 Gbps</td><td>SFP</td></tr><tr><td>10GE 光口</td><td>10 Gbps</td><td>SFP+</td></tr></tbody></table>' },

      { id: 'c12-2-2h', type: 'heading', level: 3, status: 'chg', title: '1.2.2 组网限制',
        oldHtml: '<h3 class="diff-h">1.2.2 <span class="del">组网限制</span></h3>',
        newHtml: '<h3 class="diff-h">1.2.2 <span class="add">端口组网限制</span></h3>' },
      { id: 'c12-2-2intro', type: 'text', status: 'keep', title: '概述',
        contentHtml: '<p class="diff-p">本节描述 S5700 在典型园区组网场景下的部署约束与建议。</p>' },
      { id: 'c12-2-2p1', type: 'text', status: 'chg', title: '端口速率限制',
        oldHtml: '<p class="diff-p">接口速率上限为 <span class="del">1 Gbps</span>，下行端口支持半双工/全双工模式，最大转发速率 1.4 Mpps。</p>',
        newHtml: '<p class="diff-p">接口速率上限为 <span class="add">10 Gbps</span>，下行端口支持半双工/全双工模式与<span class="add">硬件流控</span>，最大转发速率 <span class="chg">14 Mpps</span>。</p>' },
      { id: 'c12-2-2p2', type: 'text', status: 'add', title: '端口隔离原则',
        oldHtml: '<div class="diff-empty">(新增内容)</div>',
        newHtml: '<p class="diff-p">为防止单端口广播风暴跨域影响，建议在不同业务 VLAN 间启用端口隔离组 (port-isolate group 1~32)，避免不必要的二层数据互通。</p>' },
      { id: 'c12-2-2mid', type: 'text', status: 'keep', title: '端口默认值说明',
        contentHtml: '<p class="diff-p">下表给出各端口类型的出厂默认配置；如需修改，可通过 interface 接口视图命令行调整。</p>' },
      { id: 'c12-2-2t1', type: 'table', status: 'chg', title: '端口默认参数',
        oldHtml: '<table class="data-table"><caption>表 1-2 端口默认参数 (V1.8)</caption><thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr><tr><td>10GE 光口</td><td class="cell-del">10 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr></tbody></table>',
        newHtml: '<table class="data-table"><caption>表 1-2 端口默认参数 (V1.9)</caption><thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr><tr><td>10GE 光口</td><td class="cell-add">25 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr><tr><td class="cell-add">25GE 光口</td><td class="cell-add">25 Gbps</td><td class="cell-add">全双工</td><td class="cell-add">开启</td></tr></tbody></table>' },
      { id: 'c12-2-2img', type: 'image', status: 'chg', title: '组网拓扑',
        oldImage: 'assets/images/topo_v1.svg', newImage: 'assets/images/topo_v2.svg',
        oldCaption: 'V1.8 拓扑 (单上联)', newCaption: 'V1.9 拓扑 (双上联冗余)',
        oldHash: 'a3f1d2…', newHash: 'b8c4e0…' },
      { id: 'c12-2-2tail', type: 'text', status: 'keep', title: '部署提示',
        contentHtml: '<p class="diff-p">在双上联冗余场景下，应配合 MSTP/VRRP 使用，以保证二层无环与三层网关切换。</p>' },

      { id: 'c12-2-3h', type: 'heading', level: 3, status: 'del', title: '1.2.3 端口速率限制',
        oldHtml: '<h3 class="diff-h">1.2.3 <span class="del">端口速率限制</span></h3>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c12-2-3p1', type: 'text', status: 'del', title: '限速策略',
        oldHtml: '<p class="diff-p"><span class="del">每端口支持基于 CAR (Committed Access Rate) 的入方向限速，最低步长 64 kbps，最大 4 Gbps。</span></p>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' }
    ],

    // ============ 1.2.1 接口类型 (单节, 整体无变更) ============
    'ch1-2-1': [
      { id: 'c121-h', type: 'heading', level: 3, status: 'keep', title: '1.2.1 接口类型',
        contentHtml: '<h3 class="diff-h">1.2.1 接口类型</h3>' },
      { id: 'c121-p1', type: 'text', status: 'keep', title: '接口概述',
        contentHtml: '<p class="diff-p">S5700 提供丰富的端口形态，包括 GE 电口、GE 光口 (SFP)、10GE 光口 (SFP+)，下行带宽 48 Gbps，上行带宽 40 Gbps。</p>' },
      { id: 'c121-t1', type: 'table', status: 'keep', title: '接口规格',
        contentHtml: '<table class="data-table"><caption>表 1-1 S5700 接口规格</caption><thead><tr><th>接口</th><th>速率</th><th>介质</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>双绞线 Cat5e+</td></tr><tr><td>GE 光口</td><td>1 Gbps</td><td>SFP</td></tr><tr><td>10GE 光口</td><td>10 Gbps</td><td>SFP+</td></tr></tbody></table>' }
    ],

    // ============ 1.2.2 组网限制 (单节) ============
    'ch1-2-2': [
      { id: 'c122-h', type: 'heading', level: 3, status: 'chg', title: '1.2.2 组网限制',
        oldHtml: '<h3 class="diff-h">1.2.2 <span class="del">组网限制</span></h3>',
        newHtml: '<h3 class="diff-h">1.2.2 <span class="add">端口组网限制</span></h3>' },
      { id: 'c122-intro', type: 'text', status: 'keep', title: '概述',
        contentHtml: '<p class="diff-p">本节描述 S5700 在典型园区组网场景下的部署约束与建议。</p>' },
      { id: 'c122-p1', type: 'text', status: 'chg', title: '端口速率限制',
        oldHtml: '<p class="diff-p">接口速率上限为 <span class="del">1 Gbps</span>，下行端口支持半双工/全双工模式，最大转发速率 1.4 Mpps。</p>',
        newHtml: '<p class="diff-p">接口速率上限为 <span class="add">10 Gbps</span>，下行端口支持半双工/全双工模式与<span class="add">硬件流控</span>，最大转发速率 <span class="chg">14 Mpps</span>。</p>' },
      { id: 'c122-p2', type: 'text', status: 'add', title: '端口隔离原则',
        oldHtml: '<div class="diff-empty">(新增内容)</div>',
        newHtml: '<p class="diff-p">为防止单端口广播风暴跨域影响，建议在不同业务 VLAN 间启用端口隔离组 (port-isolate group 1~32)，避免不必要的二层数据互通。</p>' },
      { id: 'c122-mid', type: 'text', status: 'keep', title: '端口默认值说明',
        contentHtml: '<p class="diff-p">下表给出各端口类型的出厂默认配置；如需修改，可通过 interface 接口视图命令行调整。</p>' },
      { id: 'c122-t1', type: 'table', status: 'chg', title: '端口默认参数',
        oldHtml: '<table class="data-table"><caption>表 1-2 端口默认参数 (V1.8)</caption><thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr><tr><td>10GE 光口</td><td class="cell-del">10 Gbps</td><td>全双工</td><td class="cell-del">关闭</td></tr></tbody></table>',
        newHtml: '<table class="data-table"><caption>表 1-2 端口默认参数 (V1.9)</caption><thead><tr><th>端口类型</th><th>速率</th><th>双工</th><th>流控</th></tr></thead><tbody><tr><td>GE 电口</td><td>1 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr><tr><td>10GE 光口</td><td class="cell-add">25 Gbps</td><td>全双工</td><td class="cell-add">开启</td></tr><tr><td class="cell-add">25GE 光口</td><td class="cell-add">25 Gbps</td><td class="cell-add">全双工</td><td class="cell-add">开启</td></tr></tbody></table>' },
      { id: 'c122-img', type: 'image', status: 'chg', title: '组网拓扑',
        oldImage: 'assets/images/topo_v1.svg', newImage: 'assets/images/topo_v2.svg',
        oldCaption: 'V1.8 拓扑 (单上联)', newCaption: 'V1.9 拓扑 (双上联冗余)',
        oldHash: 'a3f1d2…', newHash: 'b8c4e0…' },
      { id: 'c122-tail', type: 'text', status: 'keep', title: '部署提示',
        contentHtml: '<p class="diff-p">在双上联冗余场景下，应配合 MSTP/VRRP 使用，以保证二层无环与三层网关切换。</p>' }
    ],

    // ============ 1.2.3 端口速率限制 (单节, 整节删除) ============
    'ch1-2-3': [
      { id: 'c123-h', type: 'heading', level: 3, status: 'del', title: '1.2.3 端口速率限制',
        oldHtml: '<h3 class="diff-h">1.2.3 <span class="del">端口速率限制</span></h3>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c123-p1', type: 'text', status: 'del', title: '限速策略',
        oldHtml: '<p class="diff-p"><span class="del">每端口支持基于 CAR (Committed Access Rate) 的入方向限速，最低步长 64 kbps，最大 4 Gbps。</span></p>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' }
    ],

    // ============ 1.3 硬件规格 (单节, 整节无变更) ============
    'ch1-3': [
      { id: 'c13-h', type: 'heading', level: 2, status: 'keep', title: '1.3 硬件规格',
        contentHtml: '<h2 class="diff-h">1.3 硬件规格</h2>' },
      { id: 'c13-p', type: 'text', status: 'keep', title: '外形',
        contentHtml: '<p class="diff-p">S5700 采用 1U 标准 19 英寸机箱，支持前后通风，适合高密度数据中心与园区接入部署。</p>' },
      { id: 'c13-t', type: 'table', status: 'keep', title: '型号规格',
        contentHtml: '<table class="data-table"><caption>表 1-3 S5700 型号规格</caption><thead><tr><th>型号</th><th>下行端口</th><th>上行端口</th><th>功耗</th></tr></thead><tbody><tr><td>S5700-24</td><td>24 GE</td><td>4×10GE</td><td><120 W</td></tr><tr><td>S5700-48</td><td>48 GE</td><td>4×10GE</td><td><160 W</td></tr></tbody></table>' }
    ],

    // ============ 2 配置指南 (整章) ============
    'ch2': [
      { id: 'c2-i0', type: 'text', status: 'keep', title: '章节概述',
        contentHtml: '<p class="diff-p">本章节描述 S5700 的初始化、VLAN、安全与链路聚合等常见配置场景，作为运维参考。</p>' },

      { id: 'c2-1h', type: 'heading', level: 2, status: 'keep', title: '2.1 初始配置',
        contentHtml: '<h2 class="diff-h">2.1 初始配置</h2>' },
      { id: 'c2-1p1', type: 'text', status: 'keep', title: '准备工作',
        contentHtml: '<p class="diff-p">开箱后请先通过 Console 口登录设备，完成主机名、管理 IP、SSH 用户开通等基础配置。</p>' },
      { id: 'c2-1l1', type: 'list', status: 'keep', title: '初始配置步骤',
        contentHtml: '<ul class="data-list"><li>Console 口连接与波特率配置 (9600 8N1)</li><li>设备命名: sysname S5700-Edge</li><li>管理 VLAN 与管理 IP 配置</li><li>SSH 用户与 AAA 远程认证</li></ul>' },

      { id: 'c2-2h', type: 'heading', level: 2, status: 'del', title: '2.2 VLAN 配置',
        oldHtml: '<h2 class="diff-h">2.2 <span class="del">VLAN 配置</span></h2>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c2-2p1', type: 'text', status: 'del', title: 'VLAN 创建',
        oldHtml: '<p class="diff-p"><span class="del">使用 vlan batch 10 20 30 命令可批量创建 VLAN，且支持 1~4094 范围。</span></p>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c2-2t1', type: 'table', status: 'del', title: 'VLAN 常用命令',
        oldHtml: '<table class="data-table"><caption>表 2-1 VLAN 常用命令 (V1.8)</caption><thead><tr><th>操作</th><th>命令</th></tr></thead><tbody><tr><td>创建 VLAN</td><td class="cell-del">vlan batch 10 20</td></tr><tr><td>命名 VLAN</td><td class="cell-del">vlan 10 description user-zone</td></tr><tr><td>查看 VLAN</td><td class="cell-del">display vlan</td></tr></tbody></table>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },

      { id: 'c2-3h', type: 'heading', level: 2, status: 'add', title: '2.3 安全配置',
        oldHtml: '<div class="diff-empty">(旧版本无此节)</div>',
        newHtml: '<h2 class="diff-h">2.3 安全配置</h2>' },
      { id: 'c2-3p1', type: 'text', status: 'add', title: 'ACL 配置',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<p class="diff-p">支持基于 ACL 3000-3999 的 IPv4 高级访问控制列表，可对五元组精确匹配，单板最大规则数 <span class="add">8192</span> 条。</p>' },
      { id: 'c2-3t1', type: 'table', status: 'add', title: '安全特性矩阵',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<table class="data-table"><caption>表 2-2 安全特性支持矩阵 (V1.9 新增)</caption><thead><tr><th>特性</th><th>支持版本</th><th>说明</th></tr></thead><tbody><tr><td>ACL</td><td class="cell-add">V1.9+</td><td class="cell-add">IPv4/IPv6 双栈</td></tr><tr><td>ARP 防护</td><td class="cell-add">V1.9+</td><td class="cell-add">动态 ARP 检测 + IP-MAC 绑定</td></tr><tr><td>端口安全</td><td class="cell-add">V1.9+</td><td class="cell-add">MAC 限制 + Sticky MAC</td></tr></tbody></table>' },
      { id: 'c2-3l1', type: 'list', status: 'add', title: '新增命令',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<ul class="data-list"><li><span class="add">display acl all</span>: 查看所有 ACL</li><li><span class="add">traffic-filter inbound acl 3001</span>: 端口入方向应用 ACL</li><li><span class="add">arp detection</span>: 启用动态 ARP 检测</li></ul>' },

      { id: 'c2-4h', type: 'heading', level: 2, status: 'chg', title: '2.4 接口聚合',
        oldHtml: '<h2 class="diff-h">2.4 <span class="del">接口聚合</span></h2>',
        newHtml: '<h2 class="diff-h">2.4 <span class="add">链路聚合 (Eth-Trunk)</span></h2>' },
      { id: 'c2-4intro', type: 'text', status: 'keep', title: '概述',
        contentHtml: '<p class="diff-p">Eth-Trunk (链路聚合) 将多条物理链路捆绑为一条逻辑链路，提升带宽并提供链路冗余。</p>' },
      { id: 'c2-4p1', type: 'text', status: 'chg', title: '聚合模式',
        oldHtml: '<p class="diff-p">S5700 支持<span class="del">手工负载分担</span>模式聚合，最大<span class="del">8</span>条成员链路。</p>',
        newHtml: '<p class="diff-p">S5700 支持<span class="add">手工负载分担 + LACP 动态聚合</span>模式，最大<span class="add">16</span>条成员链路，单 Eth-Trunk 转发带宽提升至 <span class="add">160 Gbps</span>。</p>' },
      { id: 'c2-4t1', type: 'table', status: 'chg', title: '聚合模式对照',
        oldHtml: '<table class="data-table"><caption>表 2-3 Eth-Trunk 模式 (V1.8)</caption><thead><tr><th>模式</th><th>成员数上限</th><th>负载分担</th></tr></thead><tbody><tr><td>手工</td><td>8</td><td>源/目的 MAC</td></tr><tr><td class="cell-empty">LACP</td><td class="cell-empty">—</td><td class="cell-empty">未支持</td></tr></tbody></table>',
        newHtml: '<table class="data-table"><caption>表 2-3 Eth-Trunk 模式 (V1.9)</caption><thead><tr><th>模式</th><th>成员数上限</th><th>负载分担</th></tr></thead><tbody><tr><td>手工</td><td class="cell-chg">16</td><td>源/目的 MAC + IP</td></tr><tr><td class="cell-add">LACP 动态</td><td class="cell-add">16</td><td class="cell-add">源/目的 MAC + IP + 端口</td></tr></tbody></table>' },
      { id: 'c2-4l1', type: 'list', status: 'keep', title: '配置建议',
        contentHtml: '<ul class="data-list"><li>同一 Eth-Trunk 内成员链路速率、双工需一致</li><li>跨设备堆叠场景支持跨框聚合 (CSS)</li><li>负载分担建议源+目的 IP+端口五元组</li></ul>' }
    ],

    // ============ 2.1 初始配置 (单节, 整节无变更) ============
    'ch2-1': [
      { id: 'c21-h', type: 'heading', level: 2, status: 'keep', title: '2.1 初始配置',
        contentHtml: '<h2 class="diff-h">2.1 初始配置</h2>' },
      { id: 'c21-p1', type: 'text', status: 'keep', title: '准备工作',
        contentHtml: '<p class="diff-p">开箱后请先通过 Console 口登录设备，完成主机名、管理 IP、SSH 用户开通等基础配置。</p>' },
      { id: 'c21-l1', type: 'list', status: 'keep', title: '初始配置步骤',
        contentHtml: '<ul class="data-list"><li>Console 口连接与波特率配置 (9600 8N1)</li><li>设备命名: sysname S5700-Edge</li><li>管理 VLAN 与管理 IP 配置</li><li>SSH 用户与 AAA 远程认证</li></ul>' }
    ],

    // ============ 2.2 VLAN 配置 (单节, 整节删除) ============
    'ch2-2': [
      { id: 'c22-h', type: 'heading', level: 2, status: 'del', title: '2.2 VLAN 配置',
        oldHtml: '<h2 class="diff-h">2.2 <span class="del">VLAN 配置</span></h2>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c22-p1', type: 'text', status: 'del', title: 'VLAN 创建',
        oldHtml: '<p class="diff-p"><span class="del">使用 vlan batch 10 20 30 命令可批量创建 VLAN，且支持 1~4094 范围。</span></p>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' },
      { id: 'c22-t1', type: 'table', status: 'del', title: 'VLAN 常用命令',
        oldHtml: '<table class="data-table"><caption>表 2-1 VLAN 常用命令 (V1.8)</caption><thead><tr><th>操作</th><th>命令</th></tr></thead><tbody><tr><td>创建 VLAN</td><td class="cell-del">vlan batch 10 20</td></tr><tr><td>命名 VLAN</td><td class="cell-del">vlan 10 description user-zone</td></tr><tr><td>查看 VLAN</td><td class="cell-del">display vlan</td></tr></tbody></table>',
        newHtml: '<div class="diff-empty">(新版本中已删除)</div>' }
    ],

    // ============ 2.3 安全配置 (单节, 整节新增) ============
    'ch2-3': [
      { id: 'c23-h', type: 'heading', level: 2, status: 'add', title: '2.3 安全配置',
        oldHtml: '<div class="diff-empty">(旧版本无此节)</div>',
        newHtml: '<h2 class="diff-h">2.3 安全配置</h2>' },
      { id: 'c23-p1', type: 'text', status: 'add', title: 'ACL 配置',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<p class="diff-p">支持基于 ACL 3000-3999 的 IPv4 高级访问控制列表，可对五元组精确匹配，单板最大规则数 <span class="add">8192</span> 条。</p>' },
      { id: 'c23-t1', type: 'table', status: 'add', title: '安全特性矩阵',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<table class="data-table"><caption>表 2-2 安全特性支持矩阵 (V1.9 新增)</caption><thead><tr><th>特性</th><th>支持版本</th><th>说明</th></tr></thead><tbody><tr><td>ACL</td><td class="cell-add">V1.9+</td><td class="cell-add">IPv4/IPv6 双栈</td></tr><tr><td>ARP 防护</td><td class="cell-add">V1.9+</td><td class="cell-add">动态 ARP 检测 + IP-MAC 绑定</td></tr><tr><td>端口安全</td><td class="cell-add">V1.9+</td><td class="cell-add">MAC 限制 + Sticky MAC</td></tr></tbody></table>' },
      { id: 'c23-l1', type: 'list', status: 'add', title: '新增命令',
        oldHtml: '<div class="diff-empty">(旧版本无此内容)</div>',
        newHtml: '<ul class="data-list"><li><span class="add">display acl all</span>: 查看所有 ACL</li><li><span class="add">traffic-filter inbound acl 3001</span>: 端口入方向应用 ACL</li><li><span class="add">arp detection</span>: 启用动态 ARP 检测</li></ul>' }
    ],

    // ============ 2.4 接口聚合 (单节) ============
    'ch2-4': [
      { id: 'c24-h', type: 'heading', level: 2, status: 'chg', title: '2.4 接口聚合',
        oldHtml: '<h2 class="diff-h">2.4 <span class="del">接口聚合</span></h2>',
        newHtml: '<h2 class="diff-h">2.4 <span class="add">链路聚合 (Eth-Trunk)</span></h2>' },
      { id: 'c24-intro', type: 'text', status: 'keep', title: '概述',
        contentHtml: '<p class="diff-p">Eth-Trunk (链路聚合) 将多条物理链路捆绑为一条逻辑链路，提升带宽并提供链路冗余。</p>' },
      { id: 'c24-p1', type: 'text', status: 'chg', title: '聚合模式',
        oldHtml: '<p class="diff-p">S5700 支持<span class="del">手工负载分担</span>模式聚合，最大<span class="del">8</span>条成员链路。</p>',
        newHtml: '<p class="diff-p">S5700 支持<span class="add">手工负载分担 + LACP 动态聚合</span>模式，最大<span class="add">16</span>条成员链路，单 Eth-Trunk 转发带宽提升至 <span class="add">160 Gbps</span>。</p>' },
      { id: 'c24-t1', type: 'table', status: 'chg', title: '聚合模式对照',
        oldHtml: '<table class="data-table"><caption>表 2-3 Eth-Trunk 模式 (V1.8)</caption><thead><tr><th>模式</th><th>成员数上限</th><th>负载分担</th></tr></thead><tbody><tr><td>手工</td><td>8</td><td>源/目的 MAC</td></tr><tr><td class="cell-empty">LACP</td><td class="cell-empty">—</td><td class="cell-empty">未支持</td></tr></tbody></table>',
        newHtml: '<table class="data-table"><caption>表 2-3 Eth-Trunk 模式 (V1.9)</caption><thead><tr><th>模式</th><th>成员数上限</th><th>负载分担</th></tr></thead><tbody><tr><td>手工</td><td class="cell-chg">16</td><td>源/目的 MAC + IP</td></tr><tr><td class="cell-add">LACP 动态</td><td class="cell-add">16</td><td class="cell-add">源/目的 MAC + IP + 端口</td></tr></tbody></table>' },
      { id: 'c24-l1', type: 'list', status: 'keep', title: '配置建议',
        contentHtml: '<ul class="data-list"><li>同一 Eth-Trunk 内成员链路速率、双工需一致</li><li>跨设备堆叠场景支持跨框聚合 (CSS)</li><li>负载分担建议源+目的 IP+端口五元组</li></ul>' }
    ]
  }
};
