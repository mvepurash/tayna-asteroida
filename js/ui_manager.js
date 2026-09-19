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
  const soundIcons = {}; // 'sound_on'/'sound_off' -> Image
  let ready = false;    // загружены ли UI-картинки

  // ---------- Кнопки (хит-зоны) ----------
  // Координаты сняты с макетов художника (480×854)
  const BUTTONS = {
    // Титул (title_screen.png): "НАЧАТЬ МИССИЮ" — крупная оранжевая
    menu: [  // ТОЧНЫЙ скан границ 16.09.2026
      { id: 'start',    x: 102, y: 473, w: 276, h: 62 },  // НАЧАТЬ МИССИЮ (реальные границы 473..534, было 468..530 — выше и короче снизу)
      { id: 'howto',    x: 160, y: 549, w: 160, h: 36 },  // КАК ИГРАТЬ — РАНЬШЕ ВООБЩЕ НЕ БЫЛА ПОДКЛЮЧЕНА
      { id: 'records',  x: 358, y: 18,  w: 110, h: 38 },  // РЕКОРДЫ (верх справа) — РАНЬШЕ ВООБЩЕ НЕ БЫЛА ПОДКЛЮЧЕНА
      { id: 'settings', x: 358, y: 64,  w: 110, h: 39 },  // НАСТРОЙКИ (верх справа, под РЕКОРДЫ)
      { id: 'mute',     x: 8,   y: 10,  w: 54,  h: 54 },  // иконка звука (верх слева)
    ],
    // Пауза (pause_screen.png): 5 кнопок в панели
    paused: [  // ТОЧНЫЙ скан границ 16.09.2026: все кнопки одинаковы по X (134..346),
               // раньше ошибочно брались края РАМКИ МОДАЛКИ (115..365) — отсюда «шире на 5мм с боков»
      { id: 'resume',   x: 134, y: 320, w: 212, h: 64 },  // ПРОДОЛЖИТЬ (оранжевая)
      { id: 'settings', x: 134, y: 401, w: 212, h: 60 },  // НАСТРОЙКИ
      { id: 'howto',    x: 134, y: 479, w: 212, h: 59 },  // КАК ИГРАТЬ -> заставка ИНСТРУКТАЖ
      { id: 'records',  x: 134, y: 556, w: 212, h: 59 },  // РЕКОРДЫ -> заставка
      { id: 'to_menu',  x: 134, y: 633, w: 212, h: 58 },  // ВЫЙТИ В ГЛАВНОЕ МЕНЮ
      { id: 'resume',   x: 331, y: 230, w: 26,  h: 38, pad: 8 },  // X (закрыть) — вертикальный прямоугольник, не квадрат; pad = запас для пальца
    ],
    // Настройки (settings_screen.png): пока только "назад"
    settings: [  // ТОЧНЫЙ скан границ 17.09.2026
      { id: 'music', x: 85,  y: 214, w: 380, h: 50 },  // строка МУЗЫКА
      { id: 'sfx',   x: 85,  y: 281, w: 380, h: 50 },  // строка ЗВУКОВЫЕ ЭФФЕКТЫ
      { id: 'vibro', x: 85,  y: 351, w: 380, h: 50 },  // строка ВИБРАЦИЯ
      { id: 'reset', x: 75,  y: 505, w: 405, h: 62 },  // СБРОС ПРОГРЕССА (двойной клик)
      { id: 'back',  x: 75,  y: 574, w: 146, h: 40 },  // НАЗАД (было 90/588/165x44 — ниже и шире реальной кнопки)
      { id: 'back',  x: 235, y: 574, w: 170, h: 40 },  // ПРИМЕНИТЬ (настройки мгновенные; было 262/588/175x44)
      { id: 'back',  x: 383, y: 160, w: 32,  h: 32 },  // X (было 388/138/46x46 — выше и крупнее реальной)
    ],
    howto: [  // ТОЧНЫЙ скан границ 17.09.2026 — раньше была ОДНА зона на весь экран без эффекта нажатия
      { id: 'back', x: 162, y: 667, w: 157, h: 38 },  // ПОНЯТНО
      { id: 'back', x: 367, y: 161, w: 28,  h: 31, pad: 8 },  // X (закрыть)
      { id: 'back', x: 0,   y: 0,   w: 480, h: 854 },  // запасная зона: клик мимо кнопок тоже закрывает (без вспышки)
    ],
    records: [  // ТОЧНЫЙ скан границ 17.09.2026 — раньше была ОДНА зона на весь экран без эффекта нажатия
      { id: 'back', x: 111, y: 704, w: 251, h: 53 },  // НАЗАД
      { id: 'back', x: 365, y: 122, w: 33,  h: 36, pad: 8 },  // X (закрыть)
      { id: 'back', x: 0,   y: 0,   w: 480, h: 854 },  // запасная зона: клик мимо кнопок тоже закрывает (без вспышки)
    ],
    // Game Over (game_over_screen.webp): 3 кнопки — ТОЧНЫЙ скан границ 17.09.2026
    game_over: [
      { id: 'watch_ad', x: 38, y: 588, w: 403, h: 45 },  // ВОСКРЕСНУТЬ ЗА РЕКЛАМУ +50
      { id: 'retry',    x: 38, y: 639, w: 403, h: 42 },  // ПОПРОБОВАТЬ СНОВА
      { id: 'to_menu',  x: 38, y: 686, w: 403, h: 42 },  // ВЕРНУТЬСЯ В ГЛАВНОЕ МЕНЮ
    ],
  };

  // ---------- Загрузка ----------
  // Версия для cache-bust картинок (синхронизировать с ?v= в index.html при каждом деплое,
  // затрагивающем assets/ui_designs) — исключает залипание старой/битой копии в кэше браузера.
  const UI_ASSET_V = '20260918a';

  function init(onAssetsReady) {
    const names = ['title_screen', 'pause_screen', 'settings_screen', 'game_over_screen', 'briefing_screen', 'records_screen', 'pause_button'];
    let loaded = 0;
    names.forEach(n => _loadScreen(n, () => {
      loaded++;
      if (loaded === names.length) {
        ready = true;
        // Музыку начинаем тянуть ТОЛЬКО теперь, когда все UI-картинки точно
        // договорились — иначе тяжёлый mp3 конкурирует за сеть с мелкими
        // экранами (пауза/настройки) и те могут зависать в "ЗАГРУЗКА…".
        if (typeof AudioFX !== 'undefined' && AudioFX.preloadMusic) AudioFX.preloadMusic();
        if (typeof onAssetsReady === 'function') onAssetsReady();
      }
    }));

    // Иконка звука на титульном экране (не критична для геймплея)
    ['sound_on', 'sound_off'].forEach(n => {
      const img = new Image();
      img.src = 'assets/ui_designs/' + n + '.png?v=' + UI_ASSET_V;
      soundIcons[n] = img;
    });
  }

  // Загружает один экран интерфейса. Без агрессивных повторов — параллельный
  // повторный запрос того же файла только добавляет конкуренции за сеть и
  // может УХУДШИТЬ зависание вместо того чтобы его вылечить. Один разумный
  // таймаут + диагностика в консоль для отладки на реальном устройстве.
  const STALL_MS = 8000;
  function _loadScreen(n, onSettled) {
    const img = new Image();
    let settled = false;
    const t0 = performance.now();
    const stallTimer = setTimeout(() => {
      if (settled) return;
      console.warn(`[UI] "${n}" всё ещё не загрузился спустя ${STALL_MS}мс — жду дальше, не переотправляю запрос`);
    }, STALL_MS);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(stallTimer);
      console.log(`[UI] "${n}" загружен за ${Math.round(performance.now() - t0)}мс`);
      onSettled();
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(stallTimer);
      console.warn(`[UI] ошибка загрузки "${n}"`);
      onSettled();
    };
    img.src = 'assets/ui_designs/' + n + '.webp?v=' + UI_ASSET_V;
    screens[n] = img;
  }

  // ---------- Состояния ----------
  function setState(s) {
    if (s === state) return;
    console.log('[UI]', state, '→', s);
    state = s;
    if (s !== STATE.GAME_OVER) _adCooldownMsg = 0; // подсказка про кулдаун живёт только на Game Over
  }
  function getState() { return state; }
  function isPlaying() { return state === STATE.PLAYING; }

  let _adTimer = 0; // отсчёт заглушки рекламы
  let _lastAdTime = 0;      // время последнего показа rewarded-видео (для кулдауна)
  let _adCooldownMsg = 0;   // сек до следующей доступной рекламы (для подсказки на экране)
  let _flash = null; // эффект нажатия кнопки: {x,y,w,h,t}
  let _resetArm = 0; // таймер подтверждения сброса прогресса
  let _toggleAnim = null; // эффект нажатия тумблера: {id, t}

  // ---------- Отрисовка ----------
  function draw(ctx, dt) {
    switch (state) {
      case STATE.MENU:
        _full(ctx, 'title_screen'); _drawMuteIcon(ctx); break;
      case STATE.PAUSED:
        _overlay(ctx); _full(ctx, 'pause_screen'); break;
      case STATE.SETTINGS:
        _overlay(ctx); _full(ctx, 'settings_screen'); _drawSettingsExtras(ctx, dt); break;
      case STATE.HOWTO:
        _overlay(ctx); _full(ctx, 'briefing_screen'); break;
      case STATE.RECORDS:
        _overlay(ctx); _full(ctx, 'records_screen'); _drawRecordsValues(ctx); break;
      case STATE.GAME_OVER:
        _overlay(ctx); _full(ctx, 'game_over_screen'); _drawGameOverValues(ctx); break;
      case STATE.REWARD_AD:
        _drawAdStub(ctx, dt || 0); break;
      case STATE.PLAYING:
        _pauseBtn(ctx); break;
    }
    _drawFlash(ctx, dt || 0);
  }

  // Эффект нажатия: кнопка на ~160мс слегка "вжимается" в свою же рамку
  // (те же пиксели перерисовываются чуть меньше и по центру исходной
  // зоны — рамка/бевел кнопки в артах уже даёт иллюзию вдавливания)
  // + короткая яркая вспышка по контуру. Работает без отдельных спрайтов:
  // берём кроп из уже отрисованной картинки экрана.
  // Длительность эффекта нажатия и задержки перехода между экранами.
  // (На период калибровки кнопок временно поднимались до 2с/2000мс, чтобы
  // успевать делать скриншоты — 17.09.2026 возвращены боевые значения.)
  const FLASH_DURATION = 0.16;
  const PRESS_DELAY_MS = 120;  // даём вспышке проиграться на ТОМ ЖЕ экране до перехода
  function _drawFlash(ctx, dt) {
    if (!_flash) return;
    _flash.t -= dt;
    if (_flash.t <= 0) { _flash = null; return; }
    const t = _flash.t / FLASH_DURATION;      // 1 -> 0
    const p = 1 - t;                           // 0 -> 1 (прогресс анимации)
    const squeeze = p < 0.4 ? 1 - 0.08 * (p / 0.4) : 0.92 + 0.08 * ((p - 0.4) / 0.6);
    const { x, y, w, h, img, sx, sy, sw, sh } = _flash;
    const cx = x + w / 2, cy = y + h / 2;
    const dw = w * squeeze, dh = h * squeeze;

    ctx.save();
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
    }
    const a = t;
    // Заливка светом поверх кнопки (composite 'lighter' — добавляет яркость,
    // а не просто закрашивает) — без неё эффект почти не виден на тёмных
    // кнопках (мало своего цвета внутри, в отличие от золотой ПРОДОЛЖИТЬ)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - dw / 2, cy - dh / 2, dw, dh, Math.min(14, dh / 3, dw / 3));
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(150,220,255,${0.45 * a})`;
    ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();

    ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(120,220,255,0.95)';
    ctx.shadowBlur = 16 * a;
    // Скруглённые углы вместо прямых — большинство кнопок в артах имеют
    // скошенные/скруглённые углы, прямая strokeRect торчала за их пределы
    ctx.beginPath();
    ctx.roundRect(cx - dw / 2 + 1, cy - dh / 2 + 1, dw - 2, dh - 2, Math.min(14, dh / 3, dw / 3));
    ctx.stroke();
    ctx.restore();
  }

  // Готовит объект _flash с корректными исходными координатами кропа:
  // для больших экранов (screens[name], залиты 1:1 на весь канвас 480×854)
  // src-координаты совпадают с координатами кнопки на канвасе; для мелких
  // отдельных иконок (pause_button и т.п.) исходное изображение имеет
  // свой натуральный размер — кропаем его целиком.
  function _makeFlash(x, y, w, h, img, opts) {
    if (opts && opts.srcRect) {
      const s = opts.srcRect;
      return { x, y, w, h, img, sx: s.sx, sy: s.sy, sw: s.sw, sh: s.sh, t: FLASH_DURATION };
    }
    if (opts && opts.fullImage) {
      return { x, y, w, h, img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, t: FLASH_DURATION };
    }
    return { x, y, w, h, img, sx: x, sy: y, sw: w, sh: h, t: FLASH_DURATION };
  }

  // Запасной экран, когда SDK площадки недоступен (локальный запуск, сбой
  // загрузки рекламы). Награду выдаём честно — игрок не должен страдать из-за
  // того, что ролик не подгрузился. Текстов вида "заглушка"/"тест" здесь быть
  // не должно: модерация Яндекса считает такое признаком незавершённой игры.
  function _drawAdStub(ctx, dt) {
    _adTimer -= dt;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(I18n.t('reviveTitle'), CONFIG.CANVAS_W / 2, 360);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '16px sans-serif';
    ctx.fillText(I18n.t('reviveSubtitle'), CONFIG.CANVAS_W / 2, 398);
    ctx.fillStyle = '#FFB800';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(Math.max(1, Math.ceil(_adTimer)), CONFIG.CANVAS_W / 2, 470);
    if (_adTimer <= 0) {
      AudioFX.play('reward');
      Crew.addLife();
      setState(STATE.PLAYING);
      Game.resumeAfterReward();
    }
  }

  function _full(ctx, name) {
    const img = screens[name];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
    } else {
      // экран ещё грузится — показываем индикатор, а не чёрную дыру
      ctx.fillStyle = '#9fd8ff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const dots = '.'.repeat(1 + Math.floor(performance.now() / 400) % 3);
      ctx.fillText(I18n.t('loading') + dots, CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2);
    }
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
    const rows = [  // центры слотов перемерены точным сканом границ 17.09.2026
      [264, String(rec)],
      [372, st.bestTime > 0 ? fmt(st.bestTime) : '—'],
      [478, String(st.flights)],
      [584, String(st.totalMined)],
    ];
    ctx.save();
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#eaf6ff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const [y, v] of rows) ctx.fillText(v, 372, y); // right=372: внутри слота (правая граница слота ~380)
    ctx.restore();
  }

  // Живые ползунки поверх трека нового макета (seting.png, 08.09.2026).
  // Трек и подписи ON/OFF запечены в фон — JS двигает только сам кружок-ползунок.
  // Координаты перевымерены точным пиксельным сканом по факту (08.09.2026):
  // рамка трека сверху/снизу = y 235/260 (music), 304/329 (sfx), 372/397 (vibro) →
  // истинный центр 247.5 / 316.5 / 384.5 (было смещено на 3-4px выше — задевало рамку).
  const TOGGLE_TRACK = { xLeft: 302, xRight: 372, onX: 320, offX: 354, r: 7 };
  const TOGGLE_ANIM_DURATION = 0.18;

  function _toggleKnobX(id, on) {
    const targetX = on ? TOGGLE_TRACK.onX : TOGGLE_TRACK.offX;
    if (_toggleAnim && _toggleAnim.id === id && _toggleAnim.t > 0) {
      const fromX = _toggleAnim.fromOn ? TOGGLE_TRACK.onX : TOGGLE_TRACK.offX;
      const p = 1 - (_toggleAnim.t / TOGGLE_ANIM_DURATION); // 0..1, ease пока линейный
      return fromX + (targetX - fromX) * p;
    }
    return targetX;
  }

  function _isMuted() {
    return !AudioFX.getMusic() && !AudioFX.getSfx();
  }

  function _drawMuteIcon(ctx) {
    try {
      const img = soundIcons[_isMuted() ? 'sound_off' : 'sound_on'];
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, 8, 10, 54, 54);
      }
    } catch (e) { console.warn('[UI] _drawMuteIcon:', e); }
  }

  // Реальные значения поверх экрана Game Over (в макете они запечены как
  // заглушки 124 / 05:37 / 176 кристаллов / 08:42 — закрываем их фоном и
  // рисуем фактические). Координаты сняты точным сканом границ 17.09.2026.
  function _drawGameOverValues(ctx) {
    try {
      const st      = Save.getStats();
      const rec     = Crystals.getRecord();
      const mined   = Crystals.getSessionTotal();      // доставлено за эту миссию
      const runTime = Game.sessionTime;                // длительность миссии, сек
      const fmt = s => {
        s = Math.max(0, Math.round(s));
        const m = Math.floor(s / 60), ss = s % 60;
        return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
      };

      ctx.save();
      // перекрываем запечённые заглушки фоном слотов (фон однородный, ~#00050a)
      ctx.fillStyle = '#00060b';
      ctx.fillRect(126, 494, 70, 34);   // "124"
      ctx.fillRect(324, 494, 84, 34);   // "05:37"
      ctx.fillRect(230, 555, 102, 21);  // "176 кристаллов"
      ctx.fillRect(356, 555, 42, 21);   // "08:42"

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#5fd8ff';
      ctx.fillText(String(mined), 159, 511);           // ДОБЫТО КРИСТАЛЛОВ

      ctx.fillStyle = '#ffffff';
      ctx.fillText(fmt(runTime), 365, 511);            // ВРЕМЯ МИССИИ

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#dceeff';
      ctx.fillText(String(rec) + ' ' + I18n.t('crystals'), 276, 565);
      ctx.fillText(st.bestTime > 0 ? fmt(st.bestTime) : I18n.t('noTime'), 377, 565);

      // Требование площадки: если reward-видео сейчас недоступно (кулдаун),
      // сообщить об этом игроку явно, а не молча игнорировать нажатие.
      if (_adCooldownMsg > 0) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffd36e';
        ctx.fillText(I18n.t('adCooldown') + ' ' + _adCooldownMsg + ' ' + I18n.t('seconds'), 240, 581);
      }

      ctx.restore();
    } catch (e) { console.warn('[UI] _drawGameOverValues:', e); }
  }

  function _drawSettingsExtras(ctx, dt) {
    if (_resetArm > 0) _resetArm = Math.max(0, _resetArm - (dt || 0));
    if (_toggleAnim) {
      _toggleAnim.t -= (dt || 0);
      if (_toggleAnim.t <= 0) _toggleAnim = null;
    }
    const rows = [
      [247, 'music', AudioFX.getMusic()],
      [316, 'sfx',   AudioFX.getSfx()],
      [384, 'vibro', AudioFX.getVibro()],
    ];
    ctx.save();
    for (const [cy, id, on] of rows) {
      // Закрасить ТОЛЬКО внутреннюю часть трека (между рамками) фоновым тёмным
      // цветом — стирает запечённый в макете дефолтный кружок, саму рамку
      // трека и подписи ON/OFF не трогаем, они остаются частью картинки.
      // Высота залито чуть меньше внутреннего зазора рамки (25px), чтобы
      // не задевать саму рамку, но с запасом перекрыть исходный кружок макета.
      ctx.fillStyle = '#000c14';
      ctx.beginPath();
      ctx.roundRect(TOGGLE_TRACK.xLeft + 3, cy - 10, (TOGGLE_TRACK.xRight - TOGGLE_TRACK.xLeft) - 6, 20, 9);
      ctx.fill();

      const kx = _toggleKnobX(id, on);
      ctx.save();
      ctx.shadowColor = 'rgba(80,220,255,0.95)';
      ctx.shadowBlur = 7;
      ctx.fillStyle = '#eafcff';
      ctx.beginPath(); ctx.arc(kx, cy, TOGGLE_TRACK.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // индикатор подтверждения сброса
    if (_resetArm > 0) {
      ctx.fillStyle = 'rgba(120,0,0,0.85)';
      ctx.beginPath(); ctx.roundRect(75, 505, 405, 62, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(I18n.t('resetConfirm') + ' (' + Math.ceil(_resetArm) + ')', 277, 536);
    }
    ctx.restore();
  }

  function _pauseBtn(ctx) {
    const img = screens.pause_button;
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 8, 12, 40, 40); // слева от панели O₂, поднята на 14px (~5мм)
  }

  // Соответствие состояния UI и файла его фоновой картинки (для проверки готовности перед приёмом кликов)
  const STATE_IMAGE = {
    [STATE.MENU]:      'title_screen',
    [STATE.PAUSED]:    'pause_screen',
    [STATE.SETTINGS]:  'settings_screen',
    [STATE.HOWTO]:     'briefing_screen',
    [STATE.RECORDS]:   'records_screen',
    [STATE.GAME_OVER]: 'game_over_screen',
  };
  function _stateImageReady() {
    const name = STATE_IMAGE[state];
    if (!name) return true; // PLAYING/REWARD_AD не завязаны на статичную картинку
    const img = screens[name];
    return !!(img && img.complete && img.naturalWidth);
  }

  let _actionPending = false; // блокирует повторный клик, пока предыдущее действие ждёт конца анимации нажатия

  function _scheduleAction(fn) {
    _actionPending = true;
    setTimeout(() => { _actionPending = false; fn(); }, PRESS_DELAY_MS);
  }

  // ---------- Клики ----------
  // Возвращает true, если клик обработан UI (игре его не передавать)
  function handleClick(x, y) {
    if (_actionPending) return true; // предыдущее нажатие ещё доигрывает анимацию

    if (state === STATE.PLAYING) {
      // кнопка паузы 15..55
      if (x >= 4 && x <= 56 && y >= 8 && y <= 56) {
        _flash = _makeFlash(8, 12, 40, 40, screens.pause_button, { fullImage: true });
        AudioFX.play('tap');
        _scheduleAction(() => { setState(STATE.PAUSED); Game.pause(); });
        return true;
      }
      return false; // остальные клики — игре
    }

    // Картинка текущего экрана ещё грузится ("ЗАГРУЗКА…") — кнопки на ней
    // визуально не видны, поэтому клики по их координатам не засчитываем,
    // чтобы не срабатывали "невидимые" кнопки до появления самой заставки.
    if (!_stateImageReady()) return true;

    const list = BUTTONS[state] || [];
    for (const b of list) {
      // pad (необязательный) расширяет ТОЛЬКО зону попадания, не подсветку —
      // мелкие кнопки (крестик) удобно нажимать, но вспышка строго по контуру
      const p = b.pad || 0;
      if (x >= b.x - p && x <= b.x + b.w + p && y >= b.y - p && y <= b.y + b.h + p) {
        const isToggle = (b.id === 'music' || b.id === 'sfx' || b.id === 'vibro');
        if (isToggle) {
          // Тумблеры получают собственную анимацию скольжения ползунка
          // (см. _drawSettingsExtras) — запоминаем состояние ДО переключения,
          // чтобы кружок плавно проехал из старой позиции в новую.
          const fromOn = b.id === 'music' ? AudioFX.getMusic()
                       : b.id === 'sfx'   ? AudioFX.getSfx()
                       : AudioFX.getVibro();
          _toggleAnim = { id: b.id, fromOn, t: TOGGLE_ANIM_DURATION };
          AudioFX.play('tap');
          _onButton(b.id); // остаёмся на том же экране — можно сразу
        } else if (b.id === 'mute') {
          // Иконка звука — отдельная картинка (sound_on/off), не часть
          // общего фона экрана, кропаем её саму целиком. Экран не меняется,
          // можно применять сразу же.
          const muteImg = soundIcons[_isMuted() ? 'sound_off' : 'sound_on'];
          _flash = _makeFlash(b.x, b.y, b.w, b.h, muteImg, { fullImage: true });
          AudioFX.play('tap');
          _onButton(b.id);
        } else if (b.w < 480) {
          _flash = _makeFlash(b.x, b.y, b.w, b.h, screens[STATE_IMAGE[state]]);
          AudioFX.play('tap');
          // ВАЖНО: действие (обычно смена экрана) откладываем на длительность
          // анимации нажатия — иначе экран меняется МГНОВЕННО и вспышка
          // рендерится уже поверх нового (другого) экрана, где её никто не
          // видит. Так пользователь сначала видит нажатие, потом переход.
          _scheduleAction(() => _onButton(b.id));
        } else {
          // полноэкранные back-зоны — без анимации, действие сразу
          _onButton(b.id);
        }
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
      case 'mute': {
        const willMute = !_isMuted();
        AudioFX.setMusic(!willMute);
        AudioFX.setSfx(!willMute);
        break;
      }
      case 'records':
        _prevState = state;
        setState(STATE.RECORDS);
        break;
      case 'music':
        AudioFX.setMusic(!AudioFX.getMusic());
        break;
      case 'sfx':
        AudioFX.setSfx(!AudioFX.getSfx());
        if (AudioFX.getSfx()) AudioFX.play('tap');
        break;
      case 'vibro':
        AudioFX.setVibro(!AudioFX.getVibro());
        AudioFX.vibrate(30); // тактильное подтверждение при включении
        break;
      case 'reset':
        if (_resetArm > 0) {
          Save.clear();
          Crystals.init();
          _resetArm = 0;
        } else {
          _resetArm = 3.0; // ждём подтверждающий клик 3 секунды
        }
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
      case 'watch_ad': {
        // Кулдаун между показами rewarded-видео (требование площадки: не чаще
        // чем раз в REWARDED_AD_COOLDOWN мс). Раньше константа в config.js
        // была объявлена, но нигде не проверялась.
        const now = Date.now();
        if (now - _lastAdTime < CONFIG.REWARDED_AD_COOLDOWN) {
          const left = Math.ceil((CONFIG.REWARDED_AD_COOLDOWN - (now - _lastAdTime)) / 1000);
          _adCooldownMsg = left;   // покажем на экране, что кнопка пока недоступна
          console.log(`[UI] Реклама недоступна ещё ${left}с`);
          break;
        }
        _lastAdTime = now;

        // Реальный показ через SDK, если площадка доступна; иначе — локальная
        // заглушка с экраном "РЕКЛАМА" и отсчётом (для отладки вне Яндекса).
        if (window.ysdk && ysdk.adv && ysdk.adv.showRewardedVideo) {
          Game.pause();  // геймплей и кислород замирают на время ролика
          let rewarded = false;
          ysdk.adv.showRewardedVideo({
            callbacks: {
              onRewarded: () => { rewarded = true; },
              onClose: () => {
                if (rewarded) { setState(STATE.PLAYING); Game.resumeAfterReward(); }
                else          { Game.resume(); }
              },
              onError: () => { Game.resume(); },
            },
          });
        } else {
          _adTimer = 3.0;
          setState(STATE.REWARD_AD);
        }
        break;
      }
    }
  }

  return { STATE, init, setState, getState, isPlaying, draw, handleClick };

})();
