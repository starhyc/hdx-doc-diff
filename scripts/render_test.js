// 渲染冒烟测试: 在 Node 中用简化 DOM mock 走完 report.js 渲染流程,
// 不验证像素, 只验证渲染过程不抛异常 + 关键 DOM 状态正确.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- DOM mock ----
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attributes = {};
    this.classList = new Set();
    this.dataset = {};
    this.style = {};
    this.innerText = '';
    this.parentNode = null;
    let _innerHTML = '';
    Object.defineProperty(this, 'innerHTML', {
      get() { return _innerHTML; },
      set(v) {
        // innerHTML 覆盖整个内容 -> 清空 children (与真实 DOM 一致)
        _innerHTML = String(v);
        this.children = [];
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
  console.log('\nRender smoke test OK (no exceptions)');
}
