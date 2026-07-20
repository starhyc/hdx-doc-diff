// 三栏拖拽调宽：通过更新 CSS 自定义属性 --tree-width / --list-width 来重排 Grid
(function() {
  const CONSTRAINTS = {
    '--tree-width': { min: 200, max: 480 },
    '--list-width': { min: 240, max: 560 }
  };
  function currentVar(name) {
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  }
  document.querySelectorAll('.splitter').forEach((splitter) => {
    splitter.addEventListener('mousedown', (e) => {
      e.preventDefault();
      splitter.classList.add('dragging');
      const varName = splitter.dataset.target;
      const cfg = CONSTRAINTS[varName] || { min: 180, max: 600 };
      const startX = e.clientX;
      const startW = currentVar(varName);
      const onMove = (ev) => {
        const delta = ev.clientX - startX;
        const w = Math.min(cfg.max, Math.max(cfg.min, startW + delta));
        document.documentElement.style.setProperty(varName, w + 'px');
      };
      const onUp = () => {
        splitter.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
      };
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
})();
