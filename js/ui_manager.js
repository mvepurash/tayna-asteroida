// ============================================================
// ui_manager.js — состояния игры и UI-экраны (меню, пауза,
// game over, реклама-заглушка). Вариант А с заделом под Б.
// ============================================================

const UIManager = (() => {

  const STATE = {
    MENU:      'menu',
    LOADING:   'loading',    // задел под вариант Б (LoadingAPI)
    PLAYING:   'playing',
    PAUSED:    'paused',
    SETTINGS:  'settings',
    HOWTO:     'howto',      // заставка ИНСТРУКТАЖ (briefing_screen)
    RECORDS:   'records',    // заставка РЕКОРДЫ (records_screen)
    GAME_OVER: 'game_over',
    REWARD_AD: 'reward_ad',  // задел под вариант Б (реальная реклама)
  };

  let state = STATE.MENU;
  const screens = {};   // name -> Image
  let ready = false;    // загружены ли UI-картинки

  // ---------- Кнопки (хит-зоны) ----------
  // Координаты сняты с макетов художника (480×854)
  const BUTTONS = {
    // Титул (title_screen.png): "НАЧАТЬ МИССИЮ" — крупная оранжевая
    menu: [
      { id: 'start',    x: 100, y: 468, w: 280, h: 62 },  // НАЧАТЬ МИССИЮ
      { id: 'settings', x: 355, y: 68,  w: 110, h: 34 },  // НАСТРОЙКИ (верх справа)
    ],
    // Пауза (pause_screen.png): 5 кнопок в панели
    paused: [  // макет PAUSE_SCREEN v2 от 13.07.2026 (детект по краям кнопок)
      { id: 'resume',   x: 120, y: 318, w: 240, h: 70 },  // ПРОДОЛЖИТЬ (оранжевая)
      { id: 'settings', x: 105, y: 430, w: 270, h: 52 },  // НАСТРОЙКИ
      { id: 'howto',    x: 105, y: 507, w: 270, h: 52 },  // КАК ИГРАТЬ -> заставка ИНСТРУКТАЖ
      { id: 'records',  x: 105, y: 584, w: 270, h: 52 },  // РЕКОРДЫ -> заставка
      { id: 'to_menu',  x: 105, y: 655, w: 270, h: 65 },  // ВЫЙТИ В ГЛАВНОЕ МЕНЮ
      { id: 'resume',   x: 405, y: 88,  w: 60,  h: 42 },  // X (закрыть, верх-право панели)
    ],
    // Настройки (settings_screen.png): пока только "назад"
    settings: [
      { id: 'back', x: 0, y: 0, w: 480, h: 854 },  // клик в любом месте = назад
    ],
    howto: [
      { id: 'back', x: 0, y: 0, w: 480, h: 854 },  // X/ПОНЯТНО/любой клик = назад в паузу
    ],
    records: [
      { id: 'back', x: 0, y: 0, w: 480, h: 854 },  // X/НАЗАД/любой клик = назад в паузу
    ],
    // Game Over (game_over_screen.png): 3 кнопки
    game_over: [
      { id: 'retry',    x: 90, y: 560, w: 300, h: 46 },  // ПОПРОБОВАТЬ СНОВА
      { id: 'to_menu',  x: 90, y: 618, w: 300, h: 46 },  // ВЕРНУТЬСЯ В ГЛАВНОЕ МЕНЮ
      { id: 'watch_ad', x: 90, y: 676, w: 300, h: 52 },  // СМОТРЕТЬ ВИДЕО +1 жизнь
    ],
  };

  // ---------- Загрузка ----------
  function init() {
    const names = ['title_screen', 'pause_screen', 'settings_screen', 'game_over_screen', 'briefing_screen', 'records_screen', 'pause_button'];
    let loaded = 0;
    names.forEach(n => {
      const img = new Image();
      img.onload = () => { loaded++; if (loaded === names.length) ready = true; };
      img.onerror = () => { loaded++; console.warn('[UI] не загружен:', n); };
      img.src = 'assets/ui_designs/' + n + '.png';
      screens[n] = img;
    });
  }

  // ---------- Состояния ----------
  function setState(s) {
    if (s === state) return;
    console.log('[UI]', state, '→', s);
    state = s;
  }
  function getState() { return state; }
  function isPlaying() { return state === STATE.PLAYING; }

  let _adTimer = 0; // отсчёт заглушки рекламы

  // ---------- Отрисовка ----------
  function draw(ctx, dt) {
    switch (state) {
      case STATE.MENU:
        _full(ctx, 'title_screen'); break;
      case STATE.PAUSED:
        _overlay(ctx); _full(ctx, 'pause_screen'); break;
      case STATE.SETTINGS:
        _overlay(ctx); _full(ctx, 'settings_screen'); break;
      case STATE.HOWTO:
        _overlay(ctx); _full(ctx, 'briefing_screen'); break;
      case STATE.RECORDS:
        _overlay(ctx); _full(ctx, 'records_screen'); _drawRecordsValues(ctx); break;
      case STATE.GAME_OVER:
        _overlay(ctx); _full(ctx, 'game_over_screen'); break;
      case STATE.REWARD_AD:
        _drawAdStub(ctx, dt || 0); break;
      case STATE.PLAYING:
        _pauseBtn(ctx); break;
    }
  }

  // Заглушка рекламы: чёрный экран, "РЕКЛАМА", отсчёт. По истечении — +1 жизнь.
  function _drawAdStub(ctx, dt) {
    _adTimer -= dt;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('РЕКЛАМА', CONFIG.CANVAS_W / 2, 360);
    ctx.fillStyle = '#888';
    ctx.font = '16px sans-serif';
    ctx.fillText('(заглушка — здесь будет видео)', CONFIG.CANVAS_W / 2, 400);
    ctx.fillStyle = '#FFB800';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(Math.max(1, Math.ceil(_adTimer)), CONFIG.CANVAS_W / 2, 470);
    if (_adTimer <= 0) {
      Crew.addLife();
      setState(STATE.PLAYING);
      Game.resumeAfterReward();
    }
  }

  function _full(ctx, name) {
    const img = screens[name];
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }
  function _overlay(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }
  // Цифры на экране РЕКОРДЫ — в пустые поля макета (центры плашек замерены по подписям)
  function _drawRecordsValues(ctx) {
    const st = Save.getStats();
    const rec = Crystals.getRecord();
    const fmt = s => { s = Math.round(s); const m = Math.floor(s/60), ss = s%60; return m + ':' + String(ss).padStart(2,'0'); };
    const rows = [
      [262, String(rec)],
      [362, st.bestTime > 0 ? fmt(st.bestTime) : '—'],
      [477, String(st.flights)],
      [585, String(st.totalMined)],
    ];
    ctx.save();
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#eaf6ff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const [y, v] of rows) ctx.fillText(v, 398, y);
    ctx.restore();
  }

  function _pauseBtn(ctx) {
    const img = screens.pause_button;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 8, 12, 40, 40); // слева от панели O₂, поднята на 14px (~5мм)
  }

  // ---------- Клики ----------
  // Возвращает true, если клик обработан UI (игре его не передавать)
  function handleClick(x, y) {
    if (state === STATE.PLAYING) {
      // кнопка паузы 15..55
      if (x >= 4 && x <= 56 && y >= 8 && y <= 56) {
        setState(STATE.PAUSED);
        Game.pause();
        return true;
      }
      return false; // остальные клики — игре
    }

    const list = BUTTONS[state] || [];
    for (const b of list) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        _onButton(b.id);
        return true;
      }
    }
    return true; // на не-игровых экранах клики никуда не проходят
  }

  let _prevState = STATE.MENU; // для возврата из настроек

  function _onButton(id) {
    console.log('[UI] кнопка:', id);
    switch (id) {
      case 'start':
        Game.startNewGame();
        setState(STATE.PLAYING);
        break;
      case 'resume': case 'resume2': case 'resume3':
        setState(STATE.PLAYING);
        Game.resume();
        break;
      case 'settings':
        _prevState = state;
        setState(STATE.SETTINGS);
        break;
      case 'howto':
        _prevState = state;
        setState(STATE.HOWTO);
        break;
      case 'records':
        _prevState = state;
        setState(STATE.RECORDS);
        break;
      case 'back':
        setState(_prevState === STATE.PAUSED ? STATE.PAUSED : STATE.MENU);
        break;  // из settings/howto — туда, откуда пришли
      case 'to_menu':
        setState(STATE.MENU);
        Game.stopToMenu();
        break;
      case 'retry':
        Game.startNewGame();
        setState(STATE.PLAYING);
        break;
      case 'watch_ad':
        // ВАРИАНТ А (заглушка): видимый экран "РЕКЛАМА" с отсчётом 3с, затем +1 жизнь.
        // ВАРИАНТ Б: заменить на ysdk.adv.showRewardedVideo({callbacks:{onRewarded:...}})
        _adTimer = 3.0;
        setState(STATE.REWARD_AD);
        break;
    }
  }

  return { STATE, init, setState, getState, isPlaying, draw, handleClick };

})();
