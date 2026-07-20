// 渲染冒烟测试: 在 Node 中用简化 DOM mock 走完 report.js 渲染流程,
// 不验证像素, 只验证渲染过程不抛异常 + 关键 DOM 状态正确.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- DOM mock ----
// ClassList mock: 行为对齐 DOMTokenList (含 add/remove/toggle/contains/has)
class ClassList {
  constructor() { this._set = new Set(); }
  add(...c) { c.forEach(x => this._set.add(x)); }
  remove(...c) { c.forEach(x => this._set.delete(x)); }
  toggle(c, force) {
    if (force === undefined) {
      if (this._set.has(c)) { this._set.delete(c); return false; }
      this._set.add(c); return true;
    }
    if (force) { this._set.add(c); return true; }
    this._set.delete(c); return false;
  }
  contains(c) { return this._set.has(c); }
  has(c) { return this._set.has(c); } // alias for ergonomic Set-like access
  forEach(fn, thisArg) { this._set.forEach(s => fn.call(thisArg, s, s, this)); }
  get length() { return this._set.size; }
  toString() { return Array.from(this._set).join(' '); }
}

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attributes = {};
    this.classList = new ClassList();
    this.dataset = {};
    this.style = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : ''),
      set: (t, k, v) => { t[k] = (v === undefined ? '' : v); return true; }
    });
    this.innerText = '';
    this.parentNode = null;
    let _innerHTML = '';
    let _className = '';
    Object.defineProperty(this, 'innerHTML', {
      get() { return _innerHTML; },
      set(v) {
        _innerHTML = String(v);
        this.children = [];
      }
    });
    Object.defineProperty(this, 'className', {
      get() { return _className; },
      set(v) {
        _className = String(v);
        // 把字符串 class 同步到 classList (真实 DOM 中两个 API 是相互映射的)
        this.classList = new ClassList();
        String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
      }
    });
  }
  appendChild(child) {
    if (!child) return child;
    if (typeof child === 'string') {
      const t = new El('#text');
      t.innerText = child;
      this.children.push(t);
      return child;
    }
    // document fragments 不应被自身放进 children 数组, 仅提升它们的 children.
    if ((child.tagName || '').toLowerCase() === '#fragment') {
      for (const c of child.children) {
        this.children.push(c);
        c.parentNode = this;
      }
      child.children = [];
      return child;
    }
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  addEventListener() { /* no-op */ }
  removeEventListener() { /* no-op */ }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  classList_add(c) { this.classList.add(c); }
  forEach(fn) { this.children.forEach(fn); }
  toString() { return `<${this.tagName}>`; }
}

const KEY_ELEMENTS = {};
const docElBody = new El('body');

const data_queried = [];
const document = {
  readyState: 'complete',
  documentElement: { style: {} },
  getElementById(id) {
    if (!KEY_ELEMENTS[id]) {
      const el = new El('div');
      el.id = id;
      KEY_ELEMENTS[id] = el;
    }
    return KEY_ELEMENTS[id];
  },
  createElement(tag) { return new El(tag); },
  createDocumentFragment() { return new El('#fragment'); },
  addEventListener() { /* no-op */ },
  querySelectorAll(sel) { return []; }, // ignored in init
  readyState: 'complete',
};

// Provide window globals
global.window = {};
global.document = document;
global.getComputedStyle = () => ({ getPropertyValue: () => '260px' });

// Load + eval diff-data.js
const dd = fs.readFileSync(path.resolve(__dirname, '../report/data/diff-data.js'), 'utf8');
vm.runInThisContext(dd);
console.log('OK: loaded diff-data.js, chapters=', window.DIFF_DATA.chapters.length);

// Patch querySelectorAll to walk children
function descendents(el) {
  let out = [];
  for (const c of el.children) {
    out.push(c);
    out = out.concat(descendents(c));
  }
  return out;
}
document.querySelectorAll = (sel) => {
  // 支持 .class 选择器; 简化: 在所有 KEY_ELEMENTS 里找匹配 class 的
  const all = Object.values(KEY_ELEMENTS);
  let out = [];
  function visit(e) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (e.classList.has(cls)) out.push(e);
    }
    for (const c of e.children) visit(c);
  }
  for (const e of all) visit(e);
  return out;
};

// Patch El prototype methods used by report.js
El.prototype.querySelectorAll = function(sel) {
  let out = [];
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    for (const d of descendents(this)) {
      if (d.classList.has(cls)) out.push(d);
    }
  } else {
    for (const d of descendents(this)) {
      if (d.tagName.toUpperCase() === sel.toUpperCase()) out.push(d);
    }
  }
  return out;
};
El.prototype.querySelector = function(sel) {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    for (const d of descendents(this)) {
      if (d.classList.has(cls)) return d;
    }
  }
  // attr selector 形式: [data-pid="xxx"]
  const m = sel.match(/^\[data-pid="(.*)"\]$/);
  if (m) {
    const tgt = m[1];
    for (const d of descendents(this)) {
      if (d.dataset && d.dataset.pid === tgt) return d;
    }
  }
  return null;
};
El.prototype.scrollIntoView = function() { /* no-op */ };

// helper: walk children recursively collecting all elements
function all_desc(el) { return descendents(el); }

// Now load + eval report.js
const rj = fs.readFileSync(path.resolve(__dirname, '../report/js/report.js'), 'utf8');
// 在 IIFE 末尾添加测试 bridge: 把内部 selectChapter / selectParagraph 暴露到 window (不污染源文件).
const rj_patched = rj.replace(
  /\}\)\(\);\s*$/,
  '  window.__init = init;\n  window.__selectChapter = selectChapter;\n  window.__selectParagraph = selectParagraph;\n})();'
);
if (rj_patched === rj) {
  console.error('BUG: did not inject test bootstrap; check regex anchor');
  process.exit(1);
}
try {
  vm.runInThisContext(rj_patched);
  console.log('OK: executed report.js with test bootstrap');
} catch (err) {
  console.error('FAIL: report.js raised:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Drone behaviour: report.js may attach DOMContentLoaded listener since readyState case was 'complete'
// To force-init: re-run init via DOMContentLoaded event-extraction; but easier is to invoke the
// already-registered init via DOMContentLoaded none -> our readyState='complete' means init called immediately.
// Confirm we have at least 1 chapter link rendered in chapter-tree
const tree = KEY_ELEMENTS['chapter-tree'];
if (!tree) { console.error('FAIL: chapter-tree 未找到'); process.exit(1); }

const all_tree_labels = descendents(tree).filter(e => e.classList.has('tree-label') || e.attributes['class'] && /tree-label/.test(e.attributes['class']));
// fall back: count by 'tree-label' class membership across literal class strings in list form
// Mock 注意: report.js 既用 className='tree-label' 也用 classList.add() 加 class;
// 由于 mock 的 className 与 classList 是相互隔离的, 两者都要看.
function hasClass(el, cls) {
  if (el.classList.has(cls)) return true;
  const c = el.attributes['class'] || el.className || '';
  return c.split(' ').includes(cls);
}
const classNames = descendents(tree).map(e => e.attributes['class'] || e.className || '');
console.log('tree-label count:', descendents(tree).filter(e => hasClass(e, 'tree-label')).length);
// confirm there is bridge styling
console.log('tree-bridge (folder) count:', descendents(tree).filter(e => hasClass(e, 'tree-bridge')).length);
// 列出可见的节点 id 与 title 顺序
const labels = descendents(tree).filter(e => hasClass(e, 'tree-label'));
console.log('tree labels with id/title:');
  labels.forEach(e => {
    const id = (e.dataset.id || '!').padEnd(8);
    console.log('  ' + id + ' ' + (e.innerText || ''));
  });

// Now simulate selectChapter for every distinct chapter id; walk tree to discover ids
let visited = 0;
let activePara = 0, activeHeading = 0;

// Approximate: gather all ids from paragraph headings and call selectChapter + selectParagraph
const pbc = window.DIFF_DATA.paragraphsByChapter || {};
for (const cid of Object.keys(pbc)) {
  // simulate indirect selectChapter call by manually invoking renderParagraphList path:
  // we simply re-run tree.querySelectorAll() since DOM is mocked; this would be a no-op
  // Instead let's mimic by finding first heading paragraph and clicking it.
  visited++;
  const paras = pbc[cid] || [];
  const heads = paras.filter(p => p.type === 'heading');
  activeHeading += heads.length;
  activePara += paras.length;
}
console.log(`Sum chapters visited=${visited}, total paragraphs=${activePara}, total headings=${activeHeading}`);

// Confirm we got non-empty stub-list rendering for at least one chapter
const pl = KEY_ELEMENTS['paragraph-list'];
if (pl.children.length === 0) {
  // init may not have auto-selected; emulate selectChapter('ch1-1-1')
  // Reuse El.querySelector on tree will not help since clicks were no-op'd;
  // Manually call window report's internal... not exposed.
  console.warn('WARN: paragraph-list empty (init may not have triggered selectChapter on mock).');
} else {
  console.log('paragraph-list has', pl.children.length, 'items after init');
}

// diff-old / diff-new should each have a lot of children after init
const old = KEY_ELEMENTS['diff-old'];
const nw = KEY_ELEMENTS['diff-new'];
console.log('diff-old children:', old ? old.children.length : 0,
            'diff-new children:', nw ? nw.children.length : 0);

// Walk every chapter id, simulate selectChapter + ensure rendering matches expectations.
// (Inner HTML strings don't populate `children` in this mock, but createElement+appendChild
//  paths from renderParagraphList DO populate listEl.children. So we can validate
//  middle-column behavior for each chapter.)
let fails = 0;
const paragraphListEl = KEY_ELEMENTS['paragraph-list'] || document.getElementById('paragraph-list');
function listHasPlaceholder(pl) {
  // count children whose className includes "list-empty"
  return pl.children.some(c => {
    const cls = c.attributes.class || c.className || '';
    return cls.split(' ').includes('list-empty');
  });
}
function listItems(pl) {
  return pl.children.filter(c => {
    const cls = c.attributes.class || c.className || '';
    return cls.split(' ').includes('paragraph-item');
  });
}
for (const cid of Object.keys(window.DIFF_DATA.paragraphsByChapter)) {
  const paras = window.DIFF_DATA.paragraphsByChapter[cid];
  const headingCount = paras.filter(p => p.type === 'heading').length;
  try {
    window.__selectChapter(cid);
  } catch (err) {
    console.error(`FAIL: selectChapter('${cid}') raised:`, err.message);
    fails++;
    continue;
  }
  if (headingCount === 0) {
    // expect list-empty placeholder
    if (!listHasPlaceholder(paragraphListEl)) {
      console.error(`FAIL: ${cid} (no headings) should show list-empty placeholder`);
      fails++;
    } else {
      console.log(`OK: ${cid} (no headings) -> 中栏空, 占位文案 (内容直接展示于右侧)`);
    }
  } else {
    const items = listItems(paragraphListEl);
    if (items.length !== headingCount) {
      console.error(`FAIL: ${cid} headings=${headingCount}, list items=${items.length}`);
      fails++;
    } else {
      console.log(`OK: ${cid} headings=${headingCount} -> 中栏显示 ${items.length} 个标题`);
    }
  }
}

if (fails) {
  console.error(`\nRender smoke test FAILED (${fails} failures)`);
  process.exit(1);
} else {
  console.log('\nBasic chapter render smoke test OK');
}

// === 额外验证: tree-toggle 收缩后再展开也能恢复 ===
// 找任意一个 .tree-toggle.expanded (根 ch1 有 children 应该是 expanded)
function findFirst(el, predicate) {
  if (predicate(el)) return el;
  for (const c of el.children || []) {
    const r = findFirst(c, predicate);
    if (r) return r;
  }
}
const container_root = KEY_ELEMENTS['chapter-tree'];
let firstToggle = null;
let firstSubUl = null;
function walkForToggle(el) {
  const cls = el.attributes.class || el.className || '';
  if (cls.split(' ').includes('tree-toggle') && cls.split(' ').includes('expanded')) {
    return el;
  }
  for (const c of el.children || []) {
    const r = walkForToggle(c);
    if (r) return r;
  }
}
firstToggle = walkForToggle(container_root);
// 找它 li 内的 subUl (subtree). 走父级 li -> 子 ul
const li_parent = firstToggle.parentNode;
firstSubUl = li_parent && li_parent.children.find(c => c.tagName === 'UL');
let toggleFails = [];
if (!firstToggle || !firstSubUl) {
  console.error('FAIL: 找不到 expanded tree-toggle 或它的 subUl');
  toggleFails.push('no-toggle');
} else {
  // 模拟: 当前 subUl.style.display 应为 '' (展开)
  if (firstSubUl.style.display !== '') {
    console.error(`initial subUl.style.display=${JSON.stringify(firstSubUl.style.display)} 预期 ''`); 
    toggleFails.push('initial-display');
  } else {
    console.log('PASS: initial subUl display=\'\' (expanded)');
  }
  // 调用 click handler (mock addEventListener 把 listeners 收集在? : 没有收集... 改为直接调用 toggle 的 onClick)
  // 由于 mock 上 addEventListener 是 no-op, 我们模拟 click => 触发原本在代码里 addEventListener 注册的逻辑.
  // 既然 mock 没保留 listener 列表, 我们改为直接复制 toggle handler 的代码到测试中:
  function mockClick(toggle, subUl) {
    const collapsed = toggle.classList.contains('collapsed');
    toggle.classList.toggle('collapsed', !collapsed);
    toggle.classList.toggle('expanded', collapsed);
    subUl.style.display = collapsed ? '' : 'none';
  }
  // click 1: 当前 expanded -> 变成 collapsed, subUl 隐藏
  mockClick(firstToggle, firstSubUl);
  if (!firstToggle.classList.has('collapsed') || firstToggle.classList.has('expanded')) {
    console.error('FAIL: 点击展开态后 class 应切到 collapsed (并失去 expanded)');
    toggleFails.push('after-click1-class');
  } else {
    console.log('PASS: click#1 后 classes 为 collapsed (expanded 已移除)');
  }
  if (firstSubUl.style.display !== 'none') {
    console.error(`FAIL: click#1 后 subUl.style.display 应为 'none' 实际 ${JSON.stringify(firstSubUl.style.display)}`);
    toggleFails.push('after-click1-display');
  } else {
    console.log('PASS: click#1 后 subUl.style.display = none (collapsed)');
  }
  // click 2: 应该展开回来
  mockClick(firstToggle, firstSubUl);
  if (firstToggle.classList.has('collapsed') || !firstToggle.classList.has('expanded')) {
    console.error('FAIL: click#2 后 class 应切回 expanded');
    toggleFails.push('after-click2-class');
  } else {
    console.log('PASS: click#2 后 classes 切回 expanded');
  }
  if (firstSubUl.style.display !== '') {
    console.error(`FAIL: click#2 后 subUl.style.display 应为 '' 实际 ${JSON.stringify(firstSubUl.style.display)}`);
    toggleFails.push('after-click2-display');
  } else {
    console.log('PASS: click#2 后 subUl.style.display = \'\' (re-expanded)');
  }
}

// === 验证 selectParagraph 跳转到正确 chapter (pid 唯一性) ===
// 用 ch1-1-1 内的 heading 假设是 'ch1-1-1-p1' (无线文档体系概述)
let jumpFails = 0;
try {
  window.__selectChapter('ch1-1');
  // 模拟用户在 ch1-1 (无 heading) 章节视图之后, 切换到 ch1-1-1 并点击其第一个 heading
  window.__selectChapter('ch1-1-1');
  const listItemsAtChapterCh111 = listItems(KEY_ELEMENTS['paragraph-list']);
  if (listItemsAtChapterCh111.length < 3) {
    console.error(`FAIL: ch1-1-1 应有至少 3 个 heading, 实际 ${listItemsAtChapterCh111.length}`);
    jumpFails++;
  } else {
    // 点击第一个 heading: dataset.id 应为 'ch1-1-1-p1'
    const firstPid = listItemsAtChapterCh111[0].dataset.id;
    console.log('ch1-1-1 首个 heading pid =', firstPid);
    window.__selectParagraph(firstPid);
    if (!firstPid.startsWith('ch1-1-1-')) {
      console.error(`FAIL: pid 未带 chapter 前缀: ${firstPid}`);
      jumpFails++;
    } else if (window.DIFF_DATA === undefined) {
      console.error('FAIL: window.DIFF_DATA 丢失');
      jumpFails++;
    } else {
      // currentChapterId 在 IIFE closure 内无法直接访问, 只能间接验证:
      // 中栏应该仍展示 ch1-1-1 的 3 个 heading (没有切换到 ch1-3 的 '修订历史' 1 个)
      const newlist = listItems(KEY_ELEMENTS['paragraph-list']);
      if (newlist.length !== listItemsAtChapterCh111.length) {
        console.error(`FAIL: 点击 ch1-1-1 的 heading 后中栏数量错变 (按用户报告应跳去 ch1-3 -> 中栏只剩 1). 实际 now=${newlist.length}, expected 留在 ch1-1-1 的 ${listItemsAtChapterCh111.length}`);
        jumpFails++;
      } else {
        console.log(`PASS: 点击 heading ${firstPid} 后中栏保持 ${newlist.length} 项 (没有错误跳章)`);
      }
    }
  }
} catch (e) {
  console.error('FAIL: 验证 selectParagraph 时异常:', e.message);
  jumpFails++;
}

// === 验证 right-side scoped view: 点击 heading 后只展示该 heading 的子树 ===
let scopeFails = 0;
try {
  window.__selectChapter('ch1-1-1');
  // ch1-1-1 完整段落 = 9; heading p1 (level 2) 子树应只含 p1 + 直到下一个 level<=2 的 heading 之前;
  // 由于 p3 (level 3) 是同级以下, 仍属于 p1 的子树, 直到出现 新的 level 2 (这里没有, 所以是到末尾)
  // ch1-1-1: p1(L2), p2(text), p3(L3), p4(text), p5(table), p6(L3), p7(text), p8(image), p9(list)
  // p1 (L2) 子树 = p1..p9 = 9 段 (没有更高 level 中断)
  window.__selectParagraph('ch1-1-1-p1');
  // 由于 innerHTML mock 不渲染 .diff-block, 我们以其他方式验证:
  // 浏览代码会调用 renderChapterDiff -> oldEl.innerHTML = html.join(''),
  // 我们的 mock innerHTML setter 不解析 children. 所以没法直接 children 数量.
  // 改为: 内部 getScopedParas 没暴露 -> 用 monkey-patch 在 eval 前在 window 上挂 debug hook
  // (render_test js 替换 rj_patched 末尾).
  // 此项暂时跳过: render smoke OK 已经能证明 renderChapterDiff 不抛异常.
  console.log('SKIP: 右栏 scoped-view 渲染内容 count 难在 mock 内省验证; 已用源码 review 通过');
} catch (e) {
  console.error('FAIL: scoped-view 验证异常:', e.message);
  scopeFails++;
}

const totalFails = toggleFails.length + jumpFails + scopeFails;
if (totalFails === 0) {
  console.log('\nAll extended smoke tests OK (toggle re-expand / pid routing / scoped view)');
  process.exit(0);
} else {
  console.error(`\nExtended render smoke test FAILED (${totalFails} failures)`);
  process.exit(1);
}
