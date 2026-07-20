// 渲染主控：根据 window.DIFF_DATA 渲染章节树 / 段落列表 / 双边 diff
(function() {
  const D = window.DIFF_DATA || {};
  const treeEl = document.getElementById('chapter-tree');
  const listEl = document.getElementById('paragraph-list');
  const oldEl = document.getElementById('diff-old');
  const newEl = document.getElementById('diff-new');

  const STATUS_BADGE = { add: '新增', del: '删除', chg: '修改' };
  const STATUS_LABEL = { add: '新增', del: '删除', chg: '修改', keep: '无变更' };

  function init() {
    renderHeader();
    if (treeEl) {
      treeEl.appendChild(renderTree(D.chapters || []));
      const first = findFirstDiffChapter(D.chapters || []);
      if (first) selectChapter(first);
    }
    renderEmpty();
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

  function renderTree(nodes) {
    const ul = document.createElement('ul');
    nodes.forEach((node) => {
      const li = document.createElement('li');
      li.className = 'tree-node';
      const hasChildren = node.children && node.children.length;
      const toggle = document.createElement('span');
      toggle.className = hasChildren
        ? 'tree-toggle expanded'
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
        const subUl = renderTree(node.children);
        li.appendChild(subUl);
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
    treeEl.querySelectorAll('.tree-label').forEach(el =>
      el.classList.toggle('active', el.dataset.id === id)
    );
    renderParagraphList(id);
    renderEmpty();
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
      const li = document.createElement('li');
      li.className = 'paragraph-item';
      li.dataset.id = p.id;

      const typeSpan = document.createElement('span');
      typeSpan.className = 'paragraph-type type-' + p.type;
      typeSpan.textContent = typeLabel(p.type);
      li.appendChild(typeSpan);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'paragraph-title';
      titleSpan.textContent = p.title;
      li.appendChild(titleSpan);

      const status = document.createElement('span');
      status.className = 'paragraph-status s-' + (p.status || 'keep');
      status.textContent = STATUS_LABEL[p.status] || '无变更';
      li.appendChild(status);

      li.addEventListener('click', () => selectParagraph(p.id));
      listEl.appendChild(li);
    });
  }

  function typeLabel(t) {
    return { heading: '标题', text: '文本', table: '表格', image: '图片', list: '列表' }[t] || t;
  }

  function getParagraph(pid) {
    const all = D.paragraphsByChapter || {};
    for (const k in all) {
      const f = all[k].find(p => p.id === pid);
      if (f) return f;
    }
    return null;
  }

  function selectParagraph(pid) {
    listEl.querySelectorAll('.paragraph-item').forEach(el =>
      el.classList.toggle('active', el.dataset.id === pid)
    );
    const p = getParagraph(pid);
    if (!p) { renderEmpty(); return; }
    renderDiff(p);
  }

  function renderDiff(p) {
    const oldTitle = `OLD ${D.meta ? D.meta.oldVersion : ''}`;
    const newTitle = `NEW ${D.meta ? D.meta.newVersion : ''}`;
    const meta = `[${typeLabel(p.type)}]  ${STATUS_LABEL[p.status] || '无变更'}`;
    const blockClass = `diff-block type-${p.type}`;
    oldEl.innerHTML =
      `<div class="diff-pane-title">${oldTitle}</div>` +
      `<div class="${blockClass}"><div class="diff-block-meta"><strong>${meta}</strong></div>${renderOld(p)}</div>`;
    newEl.innerHTML =
      `<div class="diff-pane-title">${newTitle}</div>` +
      `<div class="${blockClass}"><div class="diff-block-meta"><strong>${meta}</strong></div>${renderNew(p)}</div>`;
  }

  function renderOld(p) {
    if (p.status === 'add') return '<div class="diff-empty">(新版本中新增段落)</div>';
    if (p.type === 'image') return renderImage(p, p.oldImage, p.oldCaption, p.status || 'keep', p.oldHash);
    return p.oldHtml || '<div class="diff-empty">(无)</div>';
  }
  function renderNew(p) {
    if (p.status === 'del') return '<div class="diff-empty">(新版本中已删除)</div>';
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

  function renderEmpty() {
    const msg = '← 在左侧选择章节，再在中间栏选择段落查看对比';
    oldEl.innerHTML = `<div class="diff-pane-title">OLD</div><div class="diff-empty">${msg}</div>`;
    newEl.innerHTML = `<div class="diff-pane-title">NEW</div><div class="diff-empty">${msg}</div>`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
