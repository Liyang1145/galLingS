/* 安卓试玩包外壳桥（只在 APK 里注入；浏览器 / 桌面版没有 window.AndroidHost，本文件什么都不做）
 * - 游戏设置里加一行“屏幕方向：横屏 / 竖屏 / 自动”，选了立刻生效并记住；
 * - 竖屏或自动时直接用游戏自带的竖屏排版（不再弹“把手机横过来玩”）；
 * - 返回键：有弹出层先关弹出层（等同 Esc），没有就交给外壳“再按一次退出”。 */
(() => {
  'use strict';
  const H = window.AndroidHost;
  if (!H) return;
  const get = () => { try { return H.getOrientation() || 'landscape'; } catch (e) { return 'landscape'; } };
  const apply = o => {
    document.body.classList.toggle('portraitOk', o !== 'landscape');
    setTimeout(() => { try { typeof fit === 'function' && fit(); } catch (e) {} }, 300);
  };
  const OPTS = [['landscape', '横屏'], ['portrait', '竖屏'], ['auto', '跟随旋转']];
  function addRow(box) {
    const rows = box.querySelector('.rows');
    if (!rows || rows.querySelector('[data-host-orient]')) return;
    const cur = get();
    const row = document.createElement('div');
    row.className = 'row'; row.dataset.hostOrient = '1';
    row.innerHTML = '<span>屏幕方向</span><div class="seg">' +
      OPTS.map(([v, t]) => `<button type="button" class="tg${cur === v ? ' on' : ''}" data-ori="${v}">${t}</button>`).join('') + '</div>';
    row.addEventListener('click', e => {
      const b = e.target.closest('[data-ori]'); if (!b) return;
      e.stopPropagation();
      const v = b.dataset.ori;
      try { H.setOrientation(v); } catch (err) {}
      row.querySelectorAll('[data-ori]').forEach(x => x.classList.toggle('on', x === b));
      apply(v);
    });
    rows.prepend(row);
  }
  const init = () => {
    apply(get());
    const box = document.getElementById('psettings');
    if (box) {
      addRow(box);
      new MutationObserver(() => addRow(box)).observe(box, { childList: true, subtree: true });
    }
    // 竖屏提示里的“就这样竖着玩”= 切到竖屏并记住
    document.getElementById('bPortrait')?.addEventListener('click', () => { try { H.setOrientation('portrait'); } catch (e) {} });
  };
  window.__hostBack = () => {
    if (!document.querySelector('.ovl.show')) return false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    return true;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
