// 渲染主控：根据 window.DIFF_DATA 渲染章节树 / 段落栏 / 双边 diff
//
// 设计要点：
//  - 段落数据按章节拆分存储, 首次点击章节时异步加载 (避免巨型 JS 文件撑爆浏览器)
//  - 段落栏按文档标题层级缩进：heading 段记录 level (1=章, 2=节, 3=子节)
//  - 双边 diff 栏按章节段落顺序铺开, 颜色表达差异
//  - 选中段若跨章节自动切换章节
(function() {
  const D = window.DIFF_DATA || {};
  const treeEl = document.getElementById('chapter-tree');
  const listEl = document.getElementById('paragraph-list');
  const oldEl = document.getElementById('diff-old');
  const newEl = document.getElementById('diff-new');

  const STATUS_BADGE = { add: '新增', del: '删除', chg: '修改', skip: '跳过' };
  const HEADING_INDENT = 14;
  const BASE_INDENT = 8;

  let currentChapterId = null;
  let currentPid = null;
  // 已加载的段落缓存: { chapterId: [paragraphs] }
  const paragraphsCache = {};

  function getChapterParagraphs(chapterId) {
    return paragraphsCache[chapterId] || [];
  }

  function init() {
    renderHeader();
    if (treeEl) {
      // 默认全部收缩, 点击展开
      treeEl.appendChild(renderTree(D.chapters || [], false));
      const first = findFirstDiffChapter(D.chapters || []);
      if (first) selectChapter(first);
    }
  }

  function renderHeader() {
    if (!D.meta) return;
    const m = D.meta;
    document.getElementById('report-name').textContent = m.name || '产品手册 版本对比';
    document.getElementById('ver-old').textContent = 'OLD ' + (m.oldVersion || 'V1.8');
    document.getElementById('ver-new').textContent = 'NEW ' + (m.newVersion || 'V1.9');
    document.getElementById('meta-time').textContent = '生成时间: ' + (m.generatedAt || '—');
    document.getElementById('meta-doc').textContent = '源文档: ' + (m.sourceDoc || '—');
    if (m.stats) {
      const s = m.stats;
      const html = [
        `<span class="badge badge-add">新增 +${s.add||0}</span>`,
        `<span class="badge badge-del">删除 -${s.del||0}</span>`,
        `<span class="badge badge-chg">修改 *${s.chg||0}</span>`
      ];
      if (s.img) html.push(`<span class="badge badge-img">图片差异 ${s.img||0}</span>`);
      document.getElementById('stat-badges').innerHTML = html.join('');
    }
  }

  function hasTreeDiff(node) {
    const s = node.status || 'keep';
    if (s !== 'keep') return true;
    if (node.children && node.children.length) return node.children.some(hasTreeDiff);
    return false;
  }

  function renderTree(nodes, expandDiffByDefault) {
    const ul = document.createElement('ul');
    nodes.forEach((node) => {
      const li = document.createElement('li');
      li.className = 'tree-node';
      const hasChildren = node.children && node.children.length;
      const childHasDiff = hasChildren && node.children.some(hasTreeDiff);
      const initiallyExpanded = expandDiffByDefault && childHasDiff;

      const label = document.createElement('span');
      label.className = 'tree-label';
      if (node.bridge) label.classList.add('tree-bridge');
      if (hasChildren) {
        label.classList.add('has-children');
        label.classList.add(initiallyExpanded ? 'expanded' : 'collapsed');
      }
      const status = node.status || 'keep';
      if (status && status !== 'keep' && !node.bridge) {
        label.classList.add('has-diff', 'status-' + status);
        label.dataset.badge = STATUS_BADGE[status] || '';
      }
      label.dataset.id = node.id;
      label.textContent = node.title;

      let subUl = null;
      if (hasChildren) {
        subUl = renderTree(node.children, false);
        if (!initiallyExpanded) subUl.style.display = 'none';
      }

      // 整个 label 可点击: 有子节点=展开/折叠, 叶子节点=选中章节
      label.addEventListener('click', () => {
        if (hasChildren) {
          const collapsed = label.classList.contains('collapsed');
          label.classList.toggle('collapsed', !collapsed);
          label.classList.toggle('expanded', collapsed);
          if (subUl) subUl.style.display = collapsed ? '' : 'none';
        } else if (!node.bridge && node.id) {
          selectChapter(node.id);
        }
      });
      // 先挂 label (父标题), 再挂 subUl (子节点), 保证展开方向向下
      li.appendChild(label);
      if (subUl) li.appendChild(subUl);
      ul.appendChild(li);
    });
    return ul;
  }

  function findFirstDiffChapter(chapters) {
    let firstNonBridge = null;
    for (const c of chapters) {
      if (!firstNonBridge && !c.bridge && c.id) firstNonBridge = c.id;
      if (!c.bridge && c.status && c.status !== 'keep') return c.id;
      if (c.children && c.children.length) {
        const r = findFirstDiffChapter(c.children);
        if (r) return r;
      }
    }
    return firstNonBridge;
  }

  async function selectChapter(id) {
    currentChapterId = id;
    currentPid = null;
    treeEl.querySelectorAll('.tree-label').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id)
    );
    // 段落在初次选中时异步加载
    await ensureParagraphsLoaded(id);
    renderParagraphList(id);
    // 有标题层级: 不直接展示整章, 等用户点击标题再展示对应内容
    // 无标题层级: 直接展示完整整章内容
    const paras = getChapterParagraphs(id);
    const hasHeadings = paras.some(p => p.type === 'heading');
    if (hasHeadings) {
      const oldTitle = `OLD ${D.meta ? D.meta.oldVersion : ''}`;
      const newTitle = `NEW ${D.meta ? D.meta.newVersion : ''}`;
      oldEl.innerHTML = `<div class="diff-pane-title">${oldTitle}</div><div class="diff-empty">请点击中间栏标题查看对应内容</div>`;
      newEl.innerHTML = `<div class="diff-pane-title">${newTitle}</div><div class="diff-empty">请点击中间栏标题查看对应内容</div>`;
    } else {
      renderChapterDiff(id, null);
    }
  }

  async function ensureParagraphsLoaded(chapterId) {
    if (paragraphsCache[chapterId]) return;
    // 检查是否已通过全局变量预加载
    const globalCache = window.DIFF_PARAGRAPHS || {};
    if (globalCache[chapterId]) {
      paragraphsCache[chapterId] = globalCache[chapterId];
      return;
    }
    const paths = D.paragraphPaths || {};
    const path = paths[chapterId];
    if (!path) {
      paragraphsCache[chapterId] = [];
      return;
    }
    // 显示加载中
    listEl.innerHTML = '<li class="list-empty">加载中...</li>';
    oldEl.innerHTML = '<div class="diff-empty">加载中...</div>';
    newEl.innerHTML = '<div class="diff-empty">加载中...</div>';
    // 用 <script> 标签注入加载 JS 文件 (兼容 file:// 协议, 绕过 CORS)
    try {
      await loadScript(path);
      if (globalCache[chapterId]) {
        paragraphsCache[chapterId] = globalCache[chapterId];
      } else {
        paragraphsCache[chapterId] = [];
      }
    } catch (e) {
      console.error('Failed to load paragraphs for', chapterId, e);
      paragraphsCache[chapterId] = [];
    }
  }

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function() { reject(new Error('script load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  // 段落栏: 仅展示顶层标题 (最小 level), 含 keep/skip 状态
  function renderParagraphList(chapterId) {
    listEl.innerHTML = '';
    const paras = getChapterParagraphs(chapterId);
    if (!paras || paras.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = '该章节为目录节点, 无独立内容';
      listEl.appendChild(li);
      return;
    }
    const headings = paras.filter((p) => p.type === 'heading');
    if (headings.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = '此章无标题层级, 内容已直接展示在右侧';
      listEl.appendChild(li);
      return;
    }
    // 只展示顶层标题 (最小 level)
    const minLevel = Math.min(...headings.map((p) => p.level || 99));
    const topHeadings = headings.filter((p) => (p.level || 99) === minLevel);
    const frag = document.createDocumentFragment();
    topHeadings.forEach((p) => {
      const status = p.status || 'keep';
      const li = document.createElement('li');
      li.className = 'paragraph-item s-' + status + ' is-heading';
      li.dataset.id = p.id;

      const title = document.createElement('span');
      title.className = 'paragraph-title heading-title';
      title.textContent = p.title;
      li.appendChild(title);

      if (status !== 'keep') {
        const s = document.createElement('span');
        s.className = 'paragraph-status s-' + status;
        s.textContent = STATUS_BADGE[status] || '';
        li.appendChild(s);
      }
      li.addEventListener('click', () => selectParagraph(p.id));
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
  }

  function findChapterIdOfParagraph(pid) {
    // pid 形如 ch1-2-1-p3, 提取章节 id 前缀
    const m = pid.match(/^(.*)-p\d+$/);
    return m ? m[1] : null;
  }

  async function selectParagraph(pid) {
    const chId = findChapterIdOfParagraph(pid);
    if (chId && chId !== currentChapterId) {
      currentChapterId = chId;
      treeEl.querySelectorAll('.tree-label').forEach(el =>
        el.classList.toggle('active', el.dataset.id === chId)
      );
      await ensureParagraphsLoaded(chId);
      renderParagraphList(chId);
    }
    currentPid = pid;
    listEl.querySelectorAll('.paragraph-item').forEach(el =>
      el.classList.toggle('active', el.dataset.id === pid)
    );
    renderChapterDiff(currentChapterId, pid);
  }

  // 双边 diff 栏:
//   - 未聚焦 (focusPid = null): 铺开整章段落, keep 段加 .context 弱化
//   - 聚焦某个 heading (focusPid != null): 只显示该 heading 的子树段
//     (即该 heading 自身 + 其后直到同级或更高层级 heading 之前的全部段落), 不做 .context 弱化
//   - 章节无 heading 时中栏无可见项, 走默认 focusPid = null -> 整章完整展示
  function getScopedParas(chapterId, focusPid) {
    const paras = getChapterParagraphs(chapterId);
    if (!paras.length || !focusPid) return paras;
    let focusIdx = -1;
    for (let i = 0; i < paras.length; i++) {
      if (paras[i].id === focusPid) { focusIdx = i; break; }
    }
    if (focusIdx === -1) return paras;
    const focus = paras[focusIdx];
    if (focus.type !== 'heading') return [focus];
    const out = [focus];
    const focusLevel = focus.level || 2;
    for (let i = focusIdx + 1; i < paras.length; i++) {
      const p = paras[i];
      if (p.type === 'heading' && (p.level || 99) <= focusLevel) break;
      out.push(p);
    }
    return out;
  }

  function renderChapterDiff(chapterId, focusPid) {
    const oldTitle = `OLD ${D.meta ? D.meta.oldVersion : ''}`;
    const newTitle = `NEW ${D.meta ? D.meta.newVersion : ''}`;
    const allParas = getChapterParagraphs(chapterId);
    if (!allParas || allParas.length === 0) {
      oldEl.innerHTML = `<div class="diff-pane-title">${oldTitle}</div><div class="diff-empty">该章节无内容</div>`;
      newEl.innerHTML = `<div class="diff-pane-title">${newTitle}</div><div class="diff-empty">该章节无内容</div>`;
      return;
    }
    const paras = getScopedParas(chapterId, focusPid);
    const oldHtml = [`<div class="diff-pane-title">${oldTitle}</div>`];
    const newHtml = [`<div class="diff-pane-title">${newTitle}</div>`];
    paras.forEach((p) => {
      const status = p.status || 'keep';
      const isFocus = focusPid && p.id === focusPid;
      const isKeep = status === 'keep';
      const isSkip = status === 'skip';
      const klass = ['diff-block', 'type-' + p.type, 'status-' + status];
      if (p.type === 'heading') klass.push('h-level-' + (p.level || 2));
      // 整章视图 (无聚焦) 把 keep 段视为上下文弱化; skip 段也弱化但保留样式
      if ((isKeep || isSkip) && !focusPid) klass.push('context');
      if (isFocus) klass.push('focused');
      oldHtml.push(`<div class="${klass.join(' ')}" data-pid="${p.id}">${renderOld(p)}</div>`);
      newHtml.push(`<div class="${klass.join(' ')}" data-pid="${p.id}">${renderNew(p)}</div>`);
    });
    oldEl.innerHTML = oldHtml.join('');
    newEl.innerHTML = newHtml.join('');
    if (focusPid) {
      const fOld = oldEl.querySelector(`.diff-block[data-pid="${focusPid}"]`);
      if (fOld) fOld.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function renderOld(p) {
    if (p.status === 'add') return '<div class="diff-empty">(旧版本无此内容)</div>';
    if (p.status === 'keep' || p.status === 'skip') {
      if (p.type === 'image') return renderImage(p, p.oldImage || p.newImage, p.oldCaption || p.newCaption, p.status, p.oldHash);
      return p.contentHtml || p.oldHtml || '<div class="diff-empty">(无)</div>';
    }
    if (p.type === 'image') return renderImage(p, p.oldImage, p.oldCaption, p.status, p.oldHash);
    return p.oldHtml || '<div class="diff-empty">(无)</div>';
  }

  function renderNew(p) {
    if (p.status === 'del') return '<div class="diff-empty">(新版本中已删除)</div>';
    if (p.status === 'keep' || p.status === 'skip') {
      if (p.type === 'image') return renderImage(p, p.newImage || p.oldImage, p.newCaption || p.oldCaption, p.status, p.newHash);
      return p.contentHtml || p.newHtml || '<div class="diff-empty">(无)</div>';
    }
    if (p.type === 'image') return renderImage(p, p.newImage, p.newCaption, p.status, p.newHash);
    return p.newHtml || '<div class="diff-empty">(无)</div>';
  }

  function renderImage(p, src, caption, status, hash) {
    const tag = imageStatusLabel(status);
    return `<div class="image-block"><img src="${src || ''}" alt="${caption || ''}" /><div class="image-caption">${caption || ''}</div><div class="image-tag-row"><span class="image-status s-${status}">${tag}</span>${hash ? `<span class="image-hash">sha1: ${hash}</span>` : ''}</div></div>`;
  }
  function imageStatusLabel(s) {
    return { add: '新增', del: '删除', chg: '已变更', keep: '未变更', skip: '已跳过' }[s] || '未变更';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
