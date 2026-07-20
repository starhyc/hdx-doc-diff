// 渲染主控：根据 window.DIFF_DATA 渲染章节树 / 段落列表 / 双边 diff
// 关键设计：选中章节后，段落栏列出整章所有段落 (含上下文未变更段落)，差异栏按章节原顺序铺开所有段落，
// 变更段落高亮、未变更段落淡化作为骨架。章节树默认只展开含变更子树。
(function() {
  const D = window.DIFF_DATA || {};
  const treeEl = document.getElementById('chapter-tree');
  const listEl = document.getElementById('paragraph-list');
  const oldEl = document.getElementById('diff-old');
  const newEl = document.getElementById('diff-new');

  const STATUS_BADGE = { add: '新增', del: '删除', chg: '修改' };
  const STATUS_LABEL = { add: '新增', del: '删除', chg: '修改', keep: '无变更' };

  let currentChapterId = null;
  let currentPid = null;

  function init() {
    renderHeader();
    if (treeEl) {
      treeEl.appendChild(renderTree(D.chapters || [], true));
      const first = findFirstDiffChapter(D.chapters || []);
      if (first) selectChapter(first);
    } else {
      renderEmpty();
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
      document.getElementById('stat-badges').innerHTML = [
        `<span class="badge badge-add">新增 +${s.add||0}</span>`,
        `<span class="badge badge-del">删除 -${s.del||0}</span>`,
        `<span class="badge badge-chg">修改 *${s.chg||0}</span>`,
        `<span class="badge badge-img">图片差异 ${s.img||0}</span>`
      ].join('');
    }
  }

  // 子树是否含变更 (含子孙)
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
      const status = node.status || 'keep';
      if (status && status !== 'keep') {
        label.classList.add('has-diff', 'status-' + status);
        label.dataset.badge = STATUS_BADGE[status] || '';
      }
      label.dataset.id = node.id;
      label.textContent = node.title;
      label.addEventListener('click', () => selectChapter(node.id));
      li.appendChild(label);

      if (hasChildren) {
        const subUl = renderTree(node.children, true);
        li.appendChild(subUl);
        if (!expandByDefault) subUl.style.display = 'none';
        toggle.addEventListener('click', () => {
          const collapsed = toggle.classList.contains('collapsed');
          toggle.classList.toggle('collapsed', collapsed);
          toggle.classList.toggle('expanded', !collapsed);
          subUl.style.display = collapsed ? '' : 'none';
        });
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function findFirstDiffChapter(chapters) {
    for (const c of chapters) {
      if (c.status && c.status !== 'keep') return c.id;
      if (c.children && c.children.length) {
        const r = findFirstDiffChapter(c.children);
        if (r) return r;
      }
    }
    return chapters.length ? chapters[0].id : null;
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

  function renderParagraphList(chapterId) {
    listEl.innerHTML = '';
    const paras = D.paragraphsByChapter && D.paragraphsByChapter[chapterId];
    if (!paras || paras.length === 0) {
      const li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = '该章节无差异段落';
      listEl.appendChild(li);
      return;
    }
    paras.forEach((p) => {
      const status = p.status || 'keep';
      const li = document.createElement('li');
      li.className = 'paragraph-item s-' + status;
      li.dataset.id = p.id;

      const typeSpan = document.createElement('span');
      typeSpan.className = 'paragraph-type type-' + p.type;
      typeSpan.textContent = typeLabel(p.type);
      li.appendChild(typeSpan);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'paragraph-title';
      titleSpan.textContent = p.title;
      li.appendChild(titleSpan);

      const statusSpan = document.createElement('span');
      statusSpan.className = 'paragraph-status s-' + status;
      statusSpan.textContent = STATUS_LABEL[status] || '无变更';
      li.appendChild(statusSpan);

      li.addEventListener('click', () => selectParagraph(p.id));
      listEl.appendChild(li);
    });
  }

  function typeLabel(t) {
    return { heading: '标题', text: '文本', table: '表格', image: '图片', list: '列表' }[t] || t;
  }

  function findChapterIdOfParagraph(pid) {
    const all = D.paragraphsByChapter || {};
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

  // 渲染整章按段落原顺序铺开 OLD | NEW 双栏；变更段落加 focused/context 高亮差异
  function renderChapterDiff(chapterId, focusPid) {
    const oldTitle = `OLD ${D.meta ? D.meta.oldVersion : ''}`;
    const newTitle = `NEW ${D.meta ? D.meta.newVersion : ''}`;
    const paras = D.paragraphsByChapter && D.paragraphsByChapter[chapterId];
    if (!paras || paras.length === 0) {
      oldEl.innerHTML = `<div class="diff-pane-title">${oldTitle}</div><div class="diff-empty">该章节无内容</div>`;
      newEl.innerHTML = `<div class="diff-pane-title">${newTitle}</div><div class="diff-empty">该章节无内容</div>`;
      return;
    }
    const oldHtml = [`<div class="diff-pane-title">${oldTitle}</div>`];
    const newHtml = [`<div class="diff-pane-title">${newTitle}</div>`];
    paras.forEach((p) => {
      const isFocus = focusPid && p.id === focusPid;
      const isKeep = (p.status || 'keep') === 'keep';
      const klass = ['diff-block', 'type-' + p.type, 'status-' + (p.status || 'keep')];
      if (isKeep) klass.push('context');
      if (isFocus) klass.push('focused');
      const meta = `[${typeLabel(p.type)}]  ${STATUS_LABEL[p.status] || '无变更'}`;
      oldHtml.push(`<div class="${klass.join(' ')}" data-pid="${p.id}"><div class="diff-block-meta"><strong>${meta}</strong></div>${renderOld(p)}</div>`);
      newHtml.push(`<div class="${klass.join(' ')}" data-pid="${p.id}"><div class="diff-block-meta"><strong>${meta}</strong></div>${renderNew(p)}</div>`);
    });
    oldEl.innerHTML = oldHtml.join('');
    newEl.innerHTML = newHtml.join('');
    if (focusPid) {
      const fOld = oldEl.querySelector(`.diff-block[data-pid="${focusPid}"]`);
      const fNew = newEl.querySelector(`.diff-block[data-pid="${focusPid}"]`);
      if (fOld) fOld.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (fNew) {
        // 不强行再次 scrollIntoView 以免干扰 scroll-sync, 由 scroll-sync 同步
      }
    }
  }

  function renderOld(p) {
    if (p.status === 'add') return '<div class="diff-empty">(旧版本无此段落)</div>';
    if (p.status === 'keep') {
      if (p.type === 'image' && !p.oldImage && !p.newImage) return '<div class="diff-empty">(无图片)</div>';
      if (p.type === 'image') return renderImage(p, p.oldImage || p.newImage, p.oldCaption || p.newCaption, p.status, p.oldHash);
      return p.contentHtml || p.oldHtml || '<div class="diff-empty">(无)</div>';
    }
    if (p.type === 'image') return renderImage(p, p.oldImage, p.oldCaption, p.status || 'keep', p.oldHash);
    return p.oldHtml || '<div class="diff-empty">(无)</div>';
  }
  function renderNew(p) {
    if (p.status === 'del') return '<div class="diff-empty">(新版本中已删除)</div>';
    if (p.status === 'keep') {
      if (p.type === 'image' && !p.newImage && !p.oldImage) return '<div class="diff-empty">(无图片)</div>';
      if (p.type === 'image') return renderImage(p, p.newImage || p.oldImage, p.newCaption || p.oldCaption, p.status, p.newHash);
      return p.contentHtml || p.newHtml || '<div class="diff-empty">(无)</div>';
    }
    if (p.type === 'image') return renderImage(p, p.newImage, p.newCaption, p.status || 'keep', p.newHash);
    return p.newHtml || '<div class="diff-empty">(无)</div>';
  }

  function renderImage(p, src, caption, status, hash) {
    const tag = imageStatusLabel(status);
    return `
      <div class="image-block">
        <img src="${src || ''}" alt="${caption || ''}" />
        <div class="image-caption">${caption || ''}</div>
        <div class="image-tag-row">
          <span class="image-status s-${status}">${tag}</span>
          ${hash ? `<span class="image-hash">sha1: ${hash}</span>` : ''}
        </div>
      </div>`;
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
