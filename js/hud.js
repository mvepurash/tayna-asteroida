// ===== hud.js =====
// ============================================================
// hud.js — интерфейс поверх канваса
// Верхняя панель: O2, кристаллы, экипаж
// Нижняя: D-pad, кнопка добычи, статистика
// ============================================================

const HUD = (() => {
  // ===== Спрайты кнопок D-pad =====
  const _BTN_DATA = {
    up:    'assets/sprites/hud/dpad_up.png',
    down:  'assets/sprites/hud/dpad_down.png',
    left:  'assets/sprites/hud/dpad_left.png',
    right: 'assets/sprites/hud/dpad_right.png',
  };
  const _btnImgs = {};
  (() => {
    for (const [k,v] of Object.entries(_BTN_DATA)) {
      const img = new Image();
      img.onload = () => { img._ready = true; };
      img.src = v;
      // base64 может загрузиться синхронно
      if (img.complete && img.naturalWidth > 0) img._ready = true;
      _btnImgs[k] = img;
    }
  })();
  // ================================


  // ---------- Размеры (внутренние единицы канваса 540×960) ----------
  const W = CONFIG.CANVAS_W;   // 480
  const H = CONFIG.CANVAS_H;   // 854

  // Верхняя панель
  const TOP_H    = 110;
  const TOP_PAD  = 8;

  // Нижняя панель
  const BOT_H    = 179;          // высота панели — НЕ МЕНЯТЬ
  const BOT_Y      = H - BOT_H;   // верхняя граница зоны управления

  // D-pad
  const DPAD_X   = 44;   // cx_cross=79   // центр крестовины X = 55
  const DPAD_Y   = BOT_Y + 34;   // cy крестовины от верха спрайта   // cy_cross=63   // центр крестовины Y = BOT_Y+91
  const DPAD_BTN = 28;
  const DPAD_GAP = 7;

  // Кнопка добычи
  const MINE_X   = 396;            // измерено по спрайту (circle-fit): центр кольца x=395.7
  const MINE_Y   = BOT_Y + 16;   // центр = MINE_Y + MINE_R = BOT_Y + 64 (измерено circle-fit: y=64.0)
  const MINE_R   = 48;            // измерено по спрайту (circle-fit): золотое кольцо r≈48.5px

  // Иконка кристалла (заглушка — потом заменим спрайтом)
  const CRYSTAL_COLOR = '#00d4ff';

  // === HUD_SPRITES: base64 панели от художника ===
  const HUD_SPRITES = {
    panelLeft: 'assets/sprites/hud/panel_left.png',
    panelCrew: 'assets/sprites/hud/panel_crew.png',
    helmet: 'assets/sprites/hud/helmet.png',
    botPanel: 'assets/sprites/hud/bot_panel.png',
  };

  const _hudImgPanelLeft = new Image(); _hudImgPanelLeft.src = HUD_SPRITES.panelLeft;
  const _hudImgPanelCrew = new Image(); _hudImgPanelCrew.src = HUD_SPRITES.panelCrew;
  const _hudImgHelmet    = new Image(); _hudImgHelmet.src    = HUD_SPRITES.helmet;
  const _hudImgBotPanel  = new Image(); _hudImgBotPanel.src  = HUD_SPRITES.botPanel;
  // ---------- Состояние D-pad (подсветка при нажатии) ----------
  const dpadPressed = { up: false, down: false, left: false, right: false };

  function setDpadPressed(dir, val) {
    if (dir in dpadPressed) dpadPressed[dir] = val;
  }

  // ---------- Анимация мигания O2 при критическом уровне ----------
  let blinkTimer = 0;
  let blinkOn    = true;


  // ---------- Отрисовка ----------

  function draw(ctx, dt) {
    blinkTimer += dt || 0;
    if (blinkTimer > 0.4) { blinkTimer = 0; blinkOn = !blinkOn; }

    _drawTopPanel(ctx);
    _drawBottomPanel(ctx);
  }

  // ── Верхняя панель ──────────────────────────────────────────

  function _drawTopPanel(ctx) {
    // Панели художника рисуем вместо плоской чёрной плашки
    const panelH = 98;
    const panelW = panelH * 1.5;
    const panelWLeft = panelW * (123 / 132); // компенсация: рамка спрайта panelLeft шире рамки panelCrew на исходном арте — выравнено по запросу пользователя 12.07.2026
    const leftX  = 4;
    const rightX = W - panelW - 4;
    const panelY = (TOP_H - panelH) / 2 - 5; // ЗАФИКСИРОВАНО 21.06.2026 — НЕ МЕНЯТЬ без явного запроса

    if (_hudImgPanelLeft.complete && _hudImgPanelLeft.naturalWidth) {
      ctx.drawImage(_hudImgPanelLeft, leftX, panelY, panelWLeft, panelH);
    }
    const crewImg = _crewPanelImg();
    if (crewImg && crewImg.complete && crewImg.naturalWidth) {
      ctx.drawImage(crewImg, rightX, panelY, panelW, panelH);
    }

    _drawOxygen(ctx, leftX, panelY, panelWLeft, panelH);
    _drawCrystals(ctx, leftX, panelY, panelWLeft, panelH);
    _drawCrew(ctx, rightX, panelY, panelW, panelH);
  }

  // Сейчас используем единственную панель ЭКИПАЖ (силуэты) + накладываем шлемы кодом
  function _crewPanelImg() {
    return _hudImgPanelCrew;
  }

  // O2 блок — рисуется поверх панели художника
  function _drawOxygen(ctx, px, py, pw, ph) {
    const alert  = Oxygen.getAlertLevel();
    const ratio  = Oxygen.getRatio();
    const secs   = Oxygen.getSeconds();

    // ЗАФИКСИРОВАНО 21.06.2026 — НЕ МЕНЯТЬ без явного запроса
    // Координаты перезамерены на актуальной версии панели (320x213)
    const sx = px + pw * 0.2250;
    const sy = py + ph * 0.3521;
    const sw = pw * 0.4094;
    const sh = ph * 0.0751;

    const barColor = alert === 2 ? (blinkOn ? '#ff3333' : '#881100')
                   : alert === 1 ? '#ffaa00' : '#2af4ff';
    ctx.fillStyle = barColor;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(sx, sy, Math.max(2, sw * ratio), sh);
    ctx.globalAlpha = 1;

    // ЗАФИКСИРОВАНО 21.06.2026 — НЕ МЕНЯТЬ без явного запроса
    const timerCx = px + pw * 0.7859;
    const timerCy = py + ph * 0.3897;
    ctx.fillStyle    = alert === 2 ? (blinkOn ? '#ff3333' : '#ffffff') : '#ffffff';
    ctx.font         = `bold ${Math.round(ph*0.13)}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${secs}с`, timerCx, timerCy);
  }

  // Кристаллы — иконка уже в картинке панели (левый низ), число рисуем в новой рамке справа от иконки
  function _drawCrystals(ctx, px, py, pw, ph) {
    const total = Crystals.getSessionTotal();
    const carried = Crystals.getCarried();

    // ЗАФИКСИРОВАНО 21.06.2026 — НЕ МЕНЯТЬ без явного запроса
    const tx = px + pw * 0.3234;
    const ty = py + ph * 0.5540;

    ctx.fillStyle    = '#ffffff';
    ctx.font         = `bold ${Math.round(ph*0.13)}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, tx, ty);

    if (carried > 0) {
      ctx.fillStyle = CRYSTAL_COLOR;
      ctx.font      = `${Math.round(ph*0.10)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`+${carried}`, tx, ty + ph * 0.12);
    }
  }

  function _drawCrystalIcon(ctx, size) {
    // Простой кристалл из треугольников
    ctx.fillStyle = CRYSTAL_COLOR;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.6, -size * 0.2);
    ctx.lineTo(size * 0.4, size);
    ctx.lineTo(-size * 0.4, size);
    ctx.lineTo(-size * 0.6, -size * 0.2);
    ctx.closePath();
    ctx.fill();
    // Блик
    ctx.fillStyle   = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.6, -size * 0.2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Экипаж — панель художника + шлемы накладываются кодом поверх гнёзд
  // Координаты гнёзд измерены на исходнике панели 1536x1024:
  // центры (355,500), (770,500), (1180,500), доля от ширины/высоты файла:
  // ЗАФИКСИРОВАНО пользователем 21.06.2026 — НЕ МЕНЯТЬ без явного запроса
  const CREW_SOCKETS = [
    // Координаты измерены точно по жёлтым меткам художника на исходнике 1536x1024
    { xRatio: 379.6 / 1536, yRatio: 525.8 / 1024 },
    { xRatio: 759.6 / 1536, yRatio: 525.9 / 1024 },
    { xRatio: 1135.2 / 1536, yRatio: 525.8 / 1024 },
  ];

  function _drawCrew(ctx, px, py, pw, ph) {
    const total = typeof Crew !== 'undefined' ? Crew.getTotal() : CONFIG.CREW_SIZE;
    const alive = typeof Crew !== 'undefined' ? Crew.getAlive() : total;

    if (!_hudImgHelmet.complete || !_hudImgHelmet.naturalWidth) return;

    const helmetW = pw * 0.26; // ЗАФИКСИРОВАНО пользователем 21.06.2026 — НЕ МЕНЯТЬ без явного запроса
    const helmetH = helmetW * (_hudImgHelmet.naturalHeight / _hudImgHelmet.naturalWidth);

    for (let i = 0; i < total && i < CREW_SOCKETS.length; i++) {
      if (i >= alive) continue; // погибший — оставляем тёмный силуэт из панели, ничего не рисуем
      const s = CREW_SOCKETS[i];
      const cx = px + pw * s.xRatio;
      const cy = py + ph * s.yRatio;
      ctx.drawImage(_hudImgHelmet, cx - helmetW / 2, cy - helmetH / 2, helmetW, helmetH);
    }
  }

  // ── Нижняя панель ───────────────────────────────────────────

  function _drawBottomPanel(ctx) {
    // Solid fill — перекрывает cave-background полностью, убирает любую прозрачность
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, BOT_Y - 2, W, BOT_H + 2); // +2px перекрытие чтобы не было щели
    // Спрайт нижней панели
    if (_hudImgBotPanel.complete && _hudImgBotPanel.naturalWidth) {
      ctx.drawImage(_hudImgBotPanel, 0, BOT_Y, W, BOT_H);
    }

    _drawDpad(ctx);
    _drawStats(ctx);
    _drawMineButton(ctx);
  }

  // D-pad
  function _drawDpad(ctx) {
    const BTN = 40; // размер кнопки
    const H   = BTN / 2;

    // Центры кнопок — замерены по спрайту панели
    const buttons = [
      // ОРИГИНАЛ (пользователь, тюнер): up(78,31) left(43,63) right(114,65) down(78,87)
      // СИММЕТРИЧНЫЕ (применено): up(78,31) left(43,64) right(113,64) down(78,87)
      // Центр (78,64), LEFT↔RIGHT ±35px, UP↕DOWN ±28px
      { dir: 'up',    cx: 78,  cy: BOT_Y + 31 },
      { dir: 'left',  cx: 43,  cy: BOT_Y + 64 },
      { dir: 'right', cx: 113, cy: BOT_Y + 64 },
      { dir: 'down',  cx: 78,  cy: BOT_Y + 87 },
    ];

    for (const { dir, cx, cy } of buttons) {
      const pressed = !!dpadPressed[dir];
      const img = _btnImgs[dir];
      if (img && (img._ready || (img.complete && img.naturalWidth > 0))) {
        if (pressed) {
          ctx.save();
          // Вариант 1: физическое вдавливание
          // 1. Голубой ореол вокруг позиции кнопки
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur  = 18;
          // 2. Смещение вниз-вправо на 3px (имитация нажатия)
          const ox = 2, oy = 3;
          // 3. Уменьшение до 82%
          const scale = 0.82;
          const sb = BTN * scale;
          ctx.globalAlpha = 0.95;
          ctx.drawImage(img, cx - sb / 2 + ox, cy - sb / 2 + oy, sb, sb);
          // 4. Тёмная тень сверху-слева — усиливает ощущение глубины
          ctx.shadowBlur  = 0;
          ctx.globalAlpha = 0.18;
          ctx.fillStyle   = '#000000';
          ctx.beginPath();
          ctx.roundRect(cx - sb / 2 + ox - 1, cy - sb / 2 + oy - 1, sb, sb, 4);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.drawImage(img, cx - H, cy - H, BTN, BTN);
        }
      } else {
        // Fallback — яркая стрелка пока спрайт грузится
        ctx.save();
        ctx.fillStyle = 'rgba(0,30,50,0.7)';
        ctx.strokeStyle = '#2af4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx-H, cy-H, BTN, BTN, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2af4ff';
        ctx.font = `bold ${BTN*0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#2af4ff';
        ctx.shadowBlur = 8;
        const arrows = { up:'▲', down:'▼', left:'◀', right:'▶' };
        if (pressed) { ctx.fillStyle = '#ffffff'; }
        ctx.fillText(arrows[dir], cx, cy);
        ctx.restore();
      }
    }
  }

  function _drawStats(ctx) {
    const cx      = W / 2;
    const record  = Crystals.getRecord();
    const carried = Crystals.getCarried();

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(150,220,255,0.75)';
    ctx.font      = 'bold 10px sans-serif';
    ctx.fillText('РЕКОРД', cx, BOT_Y + 33);

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 20px sans-serif';
    ctx.fillText(record, cx, BOT_Y + 52);

    ctx.fillStyle = 'rgba(150,220,255,0.75)';
    ctx.font      = 'bold 10px sans-serif';
    ctx.fillText('ДОБЫТО ЗА РЕЙС', cx, BOT_Y + 68);

    ctx.fillStyle = CRYSTAL_COLOR;
    ctx.font      = 'bold 16px sans-serif';
    ctx.fillText(carried, cx, BOT_Y + 83);
  }
  function _drawMineButton(ctx) {
    const node   = Astronaut.getNode();
    const st     = Astronaut.getState();
    const onMine = (node == 13 || node === '13');
    const mining = (st === Astronaut.STATE.MINING);

    // Внешнее кольцо
    ctx.beginPath();
    ctx.arc(MINE_X, MINE_Y + MINE_R, MINE_R + 6, 0, Math.PI * 2);
    ctx.strokeStyle = mining ? '#ffaa00' : (onMine ? '#cc8800' : 'rgba(150,100,0,0.3)');
    ctx.lineWidth   = 3;
    ctx.stroke();

    // Кнопка
    ctx.beginPath();
    ctx.arc(MINE_X, MINE_Y + MINE_R, MINE_R, 0, Math.PI * 2);
    ctx.fillStyle = mining ? 'rgba(255,170,0,0.3)' : (onMine ? 'rgba(180,120,0,0.2)' : 'rgba(80,60,0,0.15)');
    ctx.fill();

    // Иконка кристалла — фиксированный размер, чтобы кнопка не "прыгала"
    ctx.save();
    ctx.translate(MINE_X, MINE_Y + MINE_R - 23);
    _drawCrystalIcon(ctx, 14);
    ctx.restore();

    // Текст — фиксированный размер шрифта, меняется только цвет/яркость
    ctx.fillStyle    = onMine ? '#ffcc00' : 'rgba(200,160,0,0.4)';
    ctx.font         = 'bold 13px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ДОБЫЧА', MINE_X, MINE_Y + MINE_R + 3);

    if (onMine) {
      ctx.fillStyle = 'rgba(255,200,0,0.55)';
      ctx.font      = '10px sans-serif';
      ctx.fillText('НАЖИМАЙТЕ', MINE_X, MINE_Y + MINE_R + 18);
    }
  }

  // ---------- Геттеры координат для input.js ----------
  // Возвращает true если точка (px,py) попадает в кнопку D-pad
  function hitDpad(px, py) {
    // ВАЖНО: координаты и размер кнопки должны быть 1-в-1 как в _drawDpad,
    // иначе зона клика расходится с нарисованными стрелками.
    const BTN = 40;
    const H   = BTN / 2;
    const buttons = [
      // ОРИГИНАЛ (пользователь, тюнер): up(78,31) left(43,63) right(114,65) down(78,87)
      // СИММЕТРИЧНЫЕ (применено): up(78,31) left(43,64) right(113,64) down(78,87)
      // Центр (78,64), LEFT↔RIGHT ±35px, UP↕DOWN ±28px
      { dir: 'up',    cx: 78,  cy: BOT_Y + 31 },
      { dir: 'left',  cx: 43,  cy: BOT_Y + 64 },
      { dir: 'right', cx: 113, cy: BOT_Y + 64 },
      { dir: 'down',  cx: 78,  cy: BOT_Y + 87 },
    ];
    for (const { dir, cx, cy } of buttons) {
      if (px >= cx - H && px <= cx + H && py >= cy - H && py <= cy + H) {
        return dir;
      }
    }
    return null;
  }

  function hitMine(px, py) {
    const dx = px - MINE_X;
    const dy = py - (MINE_Y + MINE_R);
    return Math.sqrt(dx*dx + dy*dy) <= MINE_R;
  }

  return {
    draw,
    setDpadPressed,
    hitDpad,
    hitMine,
    TOP_H,
    BOT_Y,
  };

})();


