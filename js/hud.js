// ============================================================
// hud.js — интерфейс поверх канваса
// Верхняя панель: O2, кристаллы, экипаж
// Нижняя: D-pad, кнопка добычи, статистика
// ============================================================

const HUD = (() => {

  // ---------- Размеры (внутренние единицы канваса 540×960) ----------
  const W = CONFIG.CANVAS_W;   // 480
  const H = CONFIG.CANVAS_H;   // 854

  // Верхняя панель
  const TOP_H    = 88;
  const TOP_PAD  = 12;

  // Нижняя панель
  const BOT_H    = 148;
  const BOT_Y    = H - BOT_H;

  // D-pad
  const DPAD_X   = 30;
  const DPAD_Y   = BOT_Y + 30;
  const DPAD_BTN = 42;   // размер кнопки
  const DPAD_GAP = 4;

  // Кнопка добычи
  const MINE_X   = W - 110;
  const MINE_Y   = BOT_Y + 40;
  const MINE_R   = 48;

  // Иконка кристалла (заглушка — потом заменим спрайтом)
  const CRYSTAL_COLOR = '#00d4ff';

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
    // Фон
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, TOP_H);
    ctx.strokeStyle = 'rgba(42,244,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, TOP_H);
    ctx.lineTo(W, TOP_H);
    ctx.stroke();

    _drawOxygen(ctx);
    _drawCrystals(ctx);
    _drawCrew(ctx);
  }

  // O2 блок (левая треть)
  function _drawOxygen(ctx) {
    const alert  = Oxygen.getAlertLevel();
    const ratio  = Oxygen.getRatio();
    const secs   = Oxygen.getSeconds();

    const bx = TOP_PAD;
    const by = 14;
    const bw = 150;
    const bh = 22;

    // Иконка O2
    ctx.fillStyle = alert === 2 ? (blinkOn ? '#ff3333' : '#880000')
                  : alert === 1 ? '#ffaa00' : '#2af4ff';
    ctx.font      = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('O₂', bx, by + bh / 2);

    // Метка "КИСЛОРОД"
    ctx.fillStyle = 'rgba(150,220,255,0.7)';
    ctx.font      = '11px sans-serif';
    ctx.fillText('КИСЛОРОД', bx, by - 4);

    // Шкала — фон
    const sx = bx + 26;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(sx, by, bw, bh, 4);
    ctx.fill();

    // Шкала — заполнение
    const barColor = alert === 2 ? (blinkOn ? '#ff3333' : '#881100')
                   : alert === 1 ? '#ffaa00' : '#2af4ff';
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(sx, by, Math.max(4, bw * ratio), bh, 4);
    ctx.fill();

    // Секунды
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 13px sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${secs} сек.`, sx + 4, by + bh / 2);
  }

  // Кристаллы (центр)
  function _drawCrystals(ctx) {
    const carried = Crystals.getCarried();
    const total   = Crystals.getSessionTotal();

    const cx = W / 2;
    const cy = TOP_H / 2;

    // Иконка кристалла (шестиугольник-заглушка)
    ctx.save();
    ctx.translate(cx - 50, cy);
    _drawCrystalIcon(ctx, 18);
    ctx.restore();

    // Метка
    ctx.fillStyle    = 'rgba(150,220,255,0.7)';
    ctx.font         = '11px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('КРИСТАЛЛЫ', cx, cy - 12);

    // Число (доставлено)
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 28px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy + 2);

    // Несёт сейчас (маленькое, снизу)
    if (carried > 0) {
      ctx.fillStyle    = CRYSTAL_COLOR;
      ctx.font         = '12px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(`+${carried}`, cx, cy + 18);
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

  // Экипаж (правая треть)
  function _drawCrew(ctx) {
    const total = typeof Crew !== 'undefined' ? Crew.getTotal() : CONFIG.CREW_SIZE;
    const alive = typeof Crew !== 'undefined' ? Crew.getAlive() : total;

    const rx = W - TOP_PAD;
    const ry = TOP_H / 2;
    const iconSize = 24;
    const gap      = 30;

    ctx.fillStyle    = 'rgba(150,220,255,0.7)';
    ctx.font         = '11px sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ЭКИПАЖ', rx, ry - 12);

    for (let i = 0; i < total; i++) {
      const ix = rx - (total - 1 - i) * gap - iconSize / 2;
      const iy = ry + 4;
      _drawCrewIcon(ctx, ix, iy, iconSize, i < alive);
    }
  }

  function _drawCrewIcon(ctx, x, y, size, alive) {
    // Шлем астронавта — простая иконка
    ctx.fillStyle   = alive ? '#ffffff' : 'rgba(255,255,255,0.2)';
    ctx.strokeStyle = alive ? '#2af4ff' : 'rgba(42,244,255,0.2)';
    ctx.lineWidth   = 1.5;
    // Голова
    ctx.beginPath();
    ctx.arc(x, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Тело
    ctx.beginPath();
    ctx.roundRect(x - size * 0.3, y + size * 0.3, size * 0.6, size * 0.5, 3);
    ctx.fill();
    ctx.stroke();
    // Визор
    if (alive) {
      ctx.fillStyle = '#00aaff';
      ctx.beginPath();
      ctx.arc(x, y - size * 0.1, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Нижняя панель ───────────────────────────────────────────

  function _drawBottomPanel(ctx) {
    // Полупрозрачный фон
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, BOT_Y, W, BOT_H);
    ctx.strokeStyle = 'rgba(42,244,255,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, BOT_Y);
    ctx.lineTo(W, BOT_Y);
    ctx.stroke();

    _drawDpad(ctx);
    _drawStats(ctx);
    _drawMineButton(ctx);
  }

  // D-pad
  function _drawDpad(ctx) {
    const dirs = [
      { dir: 'up',    dx: 0,  dy: -1 },
      { dir: 'down',  dx: 0,  dy:  1 },
      { dir: 'left',  dx: -1, dy:  0 },
      { dir: 'right', dx:  1, dy:  0 },
    ];

    const cx = DPAD_X + DPAD_BTN + DPAD_GAP;
    const cy = DPAD_Y + DPAD_BTN + DPAD_GAP;

    for (const { dir, dx, dy } of dirs) {
      const bx = cx + dx * (DPAD_BTN + DPAD_GAP) - DPAD_BTN / 2;
      const by = cy + dy * (DPAD_BTN + DPAD_GAP) - DPAD_BTN / 2;
      const pressed = dpadPressed[dir];

      // Кнопка
      ctx.fillStyle   = pressed ? 'rgba(42,244,255,0.35)' : 'rgba(42,244,255,0.12)';
      ctx.strokeStyle = pressed ? '#2af4ff' : 'rgba(42,244,255,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, DPAD_BTN, DPAD_BTN, 10);
      ctx.fill();
      ctx.stroke();

      // Стрелка
      const arrows = { up: '▲', down: '▼', left: '◀', right: '▶' };
      ctx.fillStyle    = pressed ? '#ffffff' : 'rgba(42,244,255,0.8)';
      ctx.font         = `${DPAD_BTN * 0.45}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arrows[dir], bx + DPAD_BTN / 2, by + DPAD_BTN / 2);
    }
  }

  // Статистика (центр нижней панели)
  function _drawStats(ctx) {
    const cx  = W / 2;
    const y0  = BOT_Y + 20;
    const record = Crystals.getRecord();
    const carried = Crystals.getCarried();

    // Рекорд
    ctx.fillStyle    = 'rgba(150,220,255,0.6)';
    ctx.font         = '11px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('РЕКОРД', cx, y0);

    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 22px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(record, cx, y0 + 14);

    // Добыто за рейс
    ctx.fillStyle    = 'rgba(150,220,255,0.6)';
    ctx.font         = '11px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('ДОБЫТО ЗА РЕЙС', cx, y0 + 60);

    ctx.save();
    ctx.translate(cx - 22, y0 + 74);
    _drawCrystalIcon(ctx, 10);
    ctx.restore();

    ctx.fillStyle    = CRYSTAL_COLOR;
    ctx.font         = 'bold 18px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(carried, cx + 8, y0 + 74);
  }

  // Кнопка ДОБЫЧА
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

    // Иконка кристалла
    ctx.save();
    ctx.translate(MINE_X, MINE_Y + MINE_R - 18);
    _drawCrystalIcon(ctx, onMine ? 16 : 12);
    ctx.restore();

    // Текст
    ctx.fillStyle    = onMine ? '#ffcc00' : 'rgba(200,160,0,0.4)';
    ctx.font         = `bold ${onMine ? 14 : 12}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ДОБЫЧА', MINE_X, MINE_Y + MINE_R + 8);

    if (onMine) {
      ctx.fillStyle = 'rgba(255,200,0,0.55)';
      ctx.font      = '10px sans-serif';
      ctx.fillText('НАЖИМАЙТЕ', MINE_X, MINE_Y + MINE_R + 24);
    }
  }

  // ---------- Геттеры координат для input.js ----------
  // Возвращает true если точка (px,py) попадает в кнопку D-pad
  function hitDpad(px, py) {
    const cx = DPAD_X + DPAD_BTN + DPAD_GAP;
    const cy = DPAD_Y + DPAD_BTN + DPAD_GAP;
    const dirs = [
      { dir: 'up',    dx: 0, dy: -1 },
      { dir: 'down',  dx: 0, dy:  1 },
      { dir: 'left',  dx:-1, dy:  0 },
      { dir: 'right', dx: 1, dy:  0 },
    ];
    for (const { dir, dx, dy } of dirs) {
      const bx = cx + dx * (DPAD_BTN + DPAD_GAP) - DPAD_BTN / 2;
      const by = cy + dy * (DPAD_BTN + DPAD_GAP) - DPAD_BTN / 2;
      if (px >= bx && px <= bx + DPAD_BTN && py >= by && py <= by + DPAD_BTN) {
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
