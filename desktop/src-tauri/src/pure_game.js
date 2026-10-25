// 宿主初始化脚本：即使 WebView 使用了旧 vn.js，也以正式游戏铺满窗口。
(() => {
  if (window.top !== window || location.pathname !== '/vn.html') return;
  const css = `
    html:not(.gl-debug) body .topbar,html:not(.gl-debug) #journal,
    html:not(.gl-debug) #engineTl{display:none!important}
    html:not(.gl-debug),html:not(.gl-debug) body,html:not(.gl-debug) .stage{background:#000!important}
    html:not(.gl-debug) .layout{padding:0!important;margin:0!important;gap:0!important}
    html:not(.gl-debug) #screen{width:100%!important;max-width:none!important}
  `;
  const resize = () => window.dispatchEvent(new Event('resize'));
  const key = event => {
    // 全屏仍归现有 steam-host.js 和 /__host/window；不建立第二套桥。
    if (event.key !== 'F10' || event.repeat) return;
    event.preventDefault(); event.stopImmediatePropagation();
    document.documentElement.classList.toggle('gl-debug'); resize();
  };
  window.addEventListener('keydown', key, true);
  const setup = () => {
    const style = document.createElement('style'); style.id = 'desktop-pure-game';
    style.textContent = css; document.head.append(style);
    const frame = document.getElementById('game');
    if (frame) {
      const connect = () => {
        try { frame.contentWindow.addEventListener('keydown', key, true); } catch (_) { /* 同源作品加载后重试 */ }
        resize();
      };
      frame.addEventListener('load', connect); connect();
    }
    resize();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
  else setup();
})();
