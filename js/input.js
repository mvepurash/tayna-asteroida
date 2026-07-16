// ===== input.js =====
// ============================================================
// input.js — клавиатура + тач D-pad
// ============================================================

const Input = (() => {

  const KEY_MAP = {
    'ArrowUp':    'up',
    'ArrowDown':  'down',
    'ArrowLeft':  'left',
    'ArrowRight': 'right',
    'w': 'up',   'ц': 'up',
    's': 'down', 'ы': 'down',
    'a': 'left', 'ф': 'left',
    'd': 'right','в': 'right',
  };

  function init() {
    // Делаем canvas фокусируемым и захватываем фокус
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
      // Перехватываем клавиши через canvas
      canvas.addEventListener('keydown', (e) => {
        const dir = KEY_MAP[e.key];
        if (dir) { e.preventDefault(); Astronaut.handleInput(dir); }
        if (e.key === ' ') { e.preventDefault(); Astronaut.handleMine(); if (typeof Crystals !== 'undefined') Crystals.mine(); }
      });
      canvas.addEventListener('keyup', (e) => {
        if (e.key === ' ') Astronaut.stopMine();
      });
      // Возвращаем фокус при клике
      canvas.addEventListener('click', () => canvas.focus());
    }
    document.addEventListener('keydown', (e) => {
      const dir = KEY_MAP[e.key];
      console.log('[Input] keydown:', e.key, '→ dir:', dir);
      if (dir) { e.preventDefault(); Astronaut.handleInput(dir); }
      if (e.key === ' ') { e.preventDefault(); Astronaut.handleMine(); if (typeof Crystals !== 'undefined') Crystals.mine(); }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ') Astronaut.stopMine();
    });
    _bindDpadButtons();
  }

  function _bindDpadButtons() {
    // Старые HTML-кнопки (если есть)
    const btns = { 'btn-up':'up','btn-down':'down','btn-left':'left','btn-right':'right' };
    for (const [id, dir] of Object.entries(btns)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); Astronaut.handleInput(dir); HUD && HUD.setDpadPressed(dir,true); }, { passive: false });
      el.addEventListener('touchend',   () => { HUD && HUD.setDpadPressed(btns[id]||dir, false); });
      el.addEventListener('mousedown',  (e) => { e.preventDefault(); Astronaut.handleInput(dir); HUD && HUD.setDpadPressed(dir,true); });
      el.addEventListener('mouseup',    () => { HUD && HUD.setDpadPressed(dir, false); });
    }

    // Тач прямо по канвасу — через HUD.hitDpad/hitMine
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    function canvasPoint(e) {
      const rect  = canvas.getBoundingClientRect();
      const scaleX = CONFIG.CANVAS_W / rect.width;
      const scaleY = CONFIG.CANVAS_H / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top)  * scaleY,
      };
    }

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const { x, y } = canvasPoint(e);
      if (typeof UIManager !== 'undefined' && UIManager.handleClick(x, y)) return;
      if (typeof HUD === 'undefined') return;
      const dir = HUD.hitDpad(x, y);
      if (dir) { Astronaut.handleInput(dir); HUD.setDpadPressed(dir, true); AudioFX.play('tap'); AudioFX.vibrate(12); }
      if (HUD.hitMine(x, y)) {
        Astronaut.handleMine();
        if (typeof Crystals !== 'undefined') Crystals.mine();
        AudioFX.play('mine'); AudioFX.vibrate(18);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      if (typeof HUD === 'undefined') return;
      ['up','down','left','right'].forEach(d => HUD.setDpadPressed(d, false));
      Astronaut.stopMine();
    });

    canvas.addEventListener('mousedown', (e) => {
      const { x, y } = canvasPoint(e);
      console.log('[Input] canvas click:', Math.round(x), Math.round(y));
      if (typeof UIManager !== 'undefined' && UIManager.handleClick(x, y)) return;
      if (typeof HUD === 'undefined') return;
      const dir = HUD.hitDpad(x, y);
      console.log('[Input] dpad hit:', dir);
      if (dir) { Astronaut.handleInput(dir); HUD.setDpadPressed(dir, true); AudioFX.play('tap'); AudioFX.vibrate(12); }
      if (HUD.hitMine(x, y)) {
        Astronaut.handleMine();
        if (typeof Crystals !== 'undefined') Crystals.mine();
        AudioFX.play('mine'); AudioFX.vibrate(18);
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (typeof HUD === 'undefined') return;
      ['up','down','left','right'].forEach(d => HUD.setDpadPressed(d, false));
      Astronaut.stopMine();
    });
  }

  return { init };
})();


