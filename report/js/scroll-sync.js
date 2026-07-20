// 左右 diff 栏滚动同步：互相跟随对方 scrollTop，防止抖动用 syncing flag
(function() {
  function bind() {
    const left = document.getElementById('diff-old');
    const right = document.getElementById('diff-new');
    if (!left || !right) return;
    let syncing = false;
    function sync(source, target) {
      if (syncing) return;
      syncing = true;
      target.scrollTop = source.scrollTop;
      syncing = false;
    }
    left.addEventListener('scroll', () => sync(left, right));
    right.addEventListener('scroll', () => sync(right, left));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
