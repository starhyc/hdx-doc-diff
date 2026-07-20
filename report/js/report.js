// 渲染主控：根据 window.DIFF_DATA 渲染章节树 / 段落栏 / 双边 diff
//
// 设计要点：
//  - 段落栏按文档标题层级缩进：heading 段记录 level (1=章, 2=节, 3=子节)
//    同节中的非 heading 段落缩进至该 heading 下一级；保持文档原顺序
//  - 段落项不显示类型徽标(标题/表格/图片/列表)，仅靠层级+样式表达；
//    状态徽标(新增/删除/修改)当 status != keep 时显示，keep 仅淡化
//  - 双边 diff 栏亦按章节段落顺序铺开，去掉 [类型] 状态 meta 头
//    仅用左边框颜色 (绿/红/黄) 与淡化 (context) 表达差异
//  - 选中段若跨章节自动切换章节
(function() {
  const D = window.DIFF_DATA || {};
  const treeEl = document.getElementById('chapter-tree');
  const listEl = document.getElementById('paragraph-list');
  const oldEl = document.getElementById('diff-old');
  const newEl = document.getElementById('diff-new');

  const STATUS_BADGE = { add: '新增', del: '删除', chg: '修改' };
  const HEADING_INDENT = 14; // 像素/层级
  const BASE_INDENT = 8;     // 基础内边距

  let currentChapterId = null;
  let currentPid = null;

  function init() {
    renderHeader();
    if (treeEl) {
      treeEl.appendChild(renderTree(D.chapters || [], true));
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
      const expandByDefault = expandDiffByDefault && childHasDiff;

      const toggle = document.createElement('span');
      toggle.className = hasChildren
        ? (expandByDefault ? 'tree-toggle expanded' : 'tree-toggle collapsed')
        : 'tree-toggle empty';
      li.appendChild(toggle);

      const label = document.createElement('span');
      label.className = 'tree-label';
      if (node.bridge) label.classList.add('tree-bridge');
      const status = node.status || 'keep';
      if (status && status !== 'keep' && !node.bridge) {
        label.classList.add('has-diff', 'status-' + status);
        label.dataset.badge = STATUS_BADGE[status] || '';
      }
      label.dataset.id = node.id;
      label.textContent = node.title;
      if (!node.bridge) {
        label.addEventListener('click', () => selectChapter(node.id));
      }
      li.appendChild(label);

      if (hasChildren) {
        const subUl = renderTree(node.children, true);
        li.appendChild(subUl);
        if (!expandByDefault) subUl.style.display = 'none';
        toggle.addEventListener('click', () => {
          // 当前是否处于 collapsed 态; 点击应翻转 -> 展开/收起互换
          const collapsed = toggle.classList.contains('collapsed');
          toggle.classList.toggle('collapsed', !collapsed);
          toggle.classList.toggle('expanded', collapsed);
          subUl.style.display = collapsed ? '' : 'none';
        });
      }
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

  function selectChapter(id) {
    currentChapterId = id;
    currentPid = null;
    treeEl.querySelectorAll('.tree-label').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id)
    );
    renderParagraphList(id);
    renderChapterDiff(id, null);
  }

  // 段落栏: 按文档标题层级缩进, 仅显示 heading 段; 无 heading 则空 (右侧仍展示整章内容)
  function renderParagraphList(chapterId) {
    listEl.innerHTML = '';
    const paras = D.paragraphsByChapter && D.paragraphsByChapter[chapterId];
    if (!paras || paras.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = '该章节为目录节点, 无独立内容';
      listEl.appendChild(li);
      return;
    }
    // 仅展示 heading 段 (按其在原文档出现顺序 + level 缩进)
    const headings = paras.filter((p) => p.type === 'heading');
    if (headings.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = '此章无标题层级, 内容已直接展示在右侧';
      listEl.appendChild(li);
      return;
    }
    let curHeadingLevel = 1;
    const frag = document.createDocumentFragment();
    headings.forEach((p) => {
      const status = p.status || 'keep';
      curHeadingLevel = p.level || (curHeadingLevel + 1);
      const indentLevel = Math.max(0, curHeadingLevel - 1);
      const li = document.createElement('li');
      li.className = 'paragraph-item s-' + status + ' is-heading';
      li.dataset.id = p.id;
      li.style.paddingLeft = (indentLevel * HEADING_INDENT + BASE_INDENT) + 'px';

      const title = document.createElement('span');
      title.className = 'paragraph-title heading-title';
      title.textContent = p.title;
      li.appendChild(title);

      if (status !== 'keep') {
        const s = document.createElement('span');
        s.className = 'paragraph-status s-' + status;
        s.textContent = STATUS_BADGE[status];
        li.appendChild(s);
      }
      li.addEventListener('click', () => selectParagraph(p.id));
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
  }

  function findChapterIdOfParagraph(pid) {
    const all = D.paragraphsByChapter || {};
    // 优先在当前选中章节内匹配 (避免跨章节 pid 重复时误中并列章节)
    if (currentChapterId && all[currentChapterId] &&
        all[currentChapterId].some(p => p.id === pid)) {
      return currentChapterId;
    }
    for (const k in all) {
      if (all[k].some(p => p.id === pid)) return k;
    }
    return null;
  }

  function selectParagraph(pid) {
    const chId = findChapterIdOfParagraph(pid);
    if (chId && chId !== currentChapterId) {
      currentChapterId = chId;
      treeEl.querySelectorAll('.tree-label').forEach(el =>
        el.classList.toggle('active', el.dataset.id === chId)
      );
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
    const paras = D.paragraphsByChapter && (D.paragraphsByChapter[chapterId] || []);
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
    const allParas = D.paragraphsByChapter && D.paragraphsByChapter[chapterId];
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
      const klass = ['diff-block', 'type-' + p.type, 'status-' + status];
      if (p.type === 'heading') klass.push('h-level-' + (p.level || 2));
      // 整章视图 (无聚焦) 把 keep 段视为上下文弱化; 聚焦子树视图则全部按主内容渲染
      if (isKeep && !focusPid) klass.push('context');
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
    if (p.status === 'keep') {
      if (p.type === 'image') return renderImage(p, p.oldImage || p.newImage, p.oldCaption || p.newCaption, p.status, p.oldHash);
      return p.contentHtml || p.oldHtml || '<div class="diff-empty">(无)</div>';
    }
    if (p.type === 'image') return renderImage(p, p.oldImage, p.oldCaption, p.status, p.oldHash);
    return p.oldHtml || '<div class="diff-empty">(无)</div>';
  }

  function renderNew(p) {
    if (p.status === 'del') return '<div class="diff-empty">(新版本中已删除)</div>';
    if (p.status === 'keep') {
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
    return { add: '新增', del: '删除', chg: '已变更', keep: '未变更' }[s] || '未变更';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
