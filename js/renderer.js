// ============================================================
// renderer.js — отрисовка карты + астронавта
// Спрайты: если файл загружен — рисуем его, иначе заглушка
// ============================================================

const Renderer = (() => {

  let canvas, ctx, W, H;

  // ---------- Описание анимаций ----------
  // type: 'loop'     — зацикленный (1→2→3→1→...)
  // type: 'pingpong' — туда-обратно (1→2→3→2→1→2→...)
  // type: 'once'     — однократно, стоп на последнем кадре
  // type: 'seq_loop' — последовательность с возвратом (mining: 1→2→3→4→1→...)

  const ANIMS = {
    idle:  { frames: [], fps: 1.5, type: 'pingpong' },
    move:  { frames: [], fps: 8,   type: 'pingpong' },
    mine:  { frames: [], fps: 6,   type: 'seq_loop' },
    death: { frames: [], fps: 6,   type: 'once'     },
    spawn: { frames: [], fps: 5,   type: 'once'     }, // once → переход в IDLE
    // spawn — спрайт астронавта = idle_01, анимация на шаттле отдельно
  };

  const SPRITE_FILES = {
    idle:  ['astronaut_idle_01.png',  'astronaut_idle_02.png'],
    move:  ['astronaut_move_01.png',  'astronaut_move_02.png',  'astronaut_move_03.png'],
    mine:  ['astronaut_mine_01.png',  'astronaut_mine_02.png',
            'astronaut_mine_03.png',  'astronaut_mine_04.png'],
    death: ['astronaut_dead_01.png',  'astronaut_dead_02.png',  'astronaut_dead_03.png'],
    spawn: ['astronaut_idle_01.png'], // TODO: заменить на spawn_01-03
  };

  // Статичный спрайт шаттла
  let shuttleImg = null;
  let bgImg      = null;  // фон кратера

  // Состояние текущей анимации
  const anim = {
    key:     'idle',
    frame:   0,
    elapsed: 0,
    dir:     1,      // для pingpong: +1 вперёд, -1 назад
    done:    false,  // для 'once'
    mirror:  false,  // MOVE зеркалим по X при развороте
  };

  // ---------- Загрузка спрайтов ----------

  function _loadSprites() {
    for (const [key, files] of Object.entries(SPRITE_FILES)) {
      ANIMS[key].frames = files.map(f => {
        const img = new Image();
        img.src = `assets/sprites/${f}`;
        return img;
      });
    }
    // Загружаем статичный шаттл
    shuttleImg = new Image();
    shuttleImg.src = 'assets/sprites/shuttle.png';
    // Фон кратера
    bgImg = new Image();
    bgImg.src = 'assets/bg_crater.png';
  }

  // ---------- Обновление кадра анимации ----------

  function _updateAnim(dt) {
    const st  = Astronaut.getState();
    const key = _stateToKey(st);

    // Смена состояния — сброс
    if (key !== anim.key) {
      anim.key     = key;
      anim.frame   = 0;
      anim.elapsed = 0;
      anim.dir     = 1;
      anim.done    = false;
    }

    // Зеркало для разворота — moveTo левее moveFrom
    // Зеркалим при движении влево — для ВСЕХ состояний
    if (st === Astronaut.STATE.MOVING) {
      // Спрайт смотрит влево по умолчанию → зеркалим при движении ВПРАВО
      anim.mirror = !_isMovingLeft();
      anim._lastMirror = anim.mirror;
    } else {
      if (anim._lastMirror === undefined) anim._lastMirror = false;
      anim.mirror = anim._lastMirror;
    }

    const def = ANIMS[anim.key];
    if (!def || def.frames.length === 0 || anim.done) return;

    anim.elapsed += dt;
    const frameDur = 1 / def.fps;
    if (anim.elapsed < frameDur) return;
    anim.elapsed -= frameDur;

    const len = def.frames.length;

    switch (def.type) {

      case 'loop':
        anim.frame = (anim.frame + 1) % len;
        break;

      case 'pingpong':
        // idle: [0,1,0,1,...] (2 кадра — просто туда-обратно)
        // move: [0,1,2,1,0,1,2,...] (3 кадра — пинг-понг)
        anim.frame += anim.dir;
        if (anim.frame >= len - 1) { anim.frame = len - 1; anim.dir = -1; }
        if (anim.frame <= 0)       { anim.frame = 0;       anim.dir =  1; }
        break;

      case 'seq_loop':
        // mining: 1→2→3→4→1→... (простой цикл без отката)
        anim.frame = (anim.frame + 1) % len;
        break;

      case 'once':
        if (anim.frame < len - 1) {
          anim.frame++;
        } else {
          anim.done = true; // фриз на последнем кадре
        }
        break;
    }
  }

  function _stateToKey(st) {
    switch (st) {
      case Astronaut.STATE.IDLE:     return 'idle';
      case Astronaut.STATE.MOVING:   return 'move';
      case Astronaut.STATE.MINING:   return 'mine';
      case Astronaut.STATE.DEAD:     return 'death';
      case Astronaut.STATE.SPAWNING: return 'idle'; // спрайт = idle_01
      default:                       return 'idle';
    }
  }

  function _isMovingLeft() {
    const from = PLATFORMS[Astronaut.getMoveFrom()];
    const to   = PLATFORMS[Astronaut.getMoveTo()];
    if (!from || !to) return false;
    return to.x < from.x;
  }

  // ---------- Инициализация ----------

  function init() {
    canvas = document.getElementById('game-canvas');
    console.log('[Renderer] init, canvas:', canvas);
    if (!canvas) { console.error('[Renderer] canvas NOT FOUND!'); return; }
    ctx    = canvas.getContext('2d');
    W      = CONFIG.CANVAS_W;
    H      = CONFIG.CANVAS_H;
    canvas.width  = W;
    canvas.height = H;
    _loadSprites();
  }

  // ---------- Главный draw ----------

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    // Фон кратера
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0d0d14';
      ctx.fillRect(0, 0, W, H);
    }

    _drawConnections();
    _drawPlatforms();
    _drawTentacles();
    _drawCrystalDeposit();
    _updateAnim(dt || 0);
    _drawAstronaut();
    if (typeof HUD !== 'undefined') HUD.draw(ctx, dt);
    if (CONFIG.DEBUG) _drawDebug();
  }

  // ---------- Рёбра графа ----------

  function _drawConnections() {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = '#2af4ff';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.7;

    const drawn = new Set();

    for (const [fromKey, dirs] of Object.entries(NAV)) {
      const from = PLATFORMS[fromKey];
      if (!from) continue;
      for (const target of Object.values(dirs)) {
        if (!target || target === 'diagonal') continue;
        const edgeKey = [String(fromKey), String(target)].sort().join('-');
        if (drawn.has(edgeKey)) continue;
        drawn.add(edgeKey);
        const to = PLATFORMS[target];
        if (!to) continue;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    for (const [key, targets] of Object.entries(DIAGONAL_TARGETS)) {
      const [fromKey] = key.split('_');
      const from = PLATFORMS[fromKey];
      if (!from) continue;
      for (const target of Object.values(targets)) {
        const edgeKey = [String(fromKey), String(target)].sort().join('-');
        if (drawn.has(edgeKey)) continue;
        drawn.add(edgeKey);
        const to = PLATFORMS[target];
        if (!to) continue;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ---------- Платформы ----------

  function _drawPlatforms() {
    for (const [key, pos] of Object.entries(PLATFORMS)) {
      if (key === 'shuttle') { _drawShuttle(pos); continue; }

      const r        = (key === '13') ? PLATFORM_13_RADIUS : PLATFORM_RADIUS;
      const isActive = Astronaut.isOnNode(key) || Astronaut.isOnNode(Number(key));
      const isDanger = typeof Tentacles !== 'undefined' &&
                       Tentacles.getDangerNodes().has(key) ||
                       (typeof Tentacles !== 'undefined' &&
                        Tentacles.getDangerNodes().has(Number(key)));

      if (isDanger) {
        ctx.save();
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur  = 22;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#3a0a0a';
        ctx.fill();
        ctx.restore();
      }

      if (isActive) {
        ctx.save();
        ctx.shadowColor = '#2af4ff';
        ctx.shadowBlur  = 18;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1a3a3a';
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle   = key === '13' ? '#2a1a3a' : '#1a2030';
      ctx.strokeStyle = key === '13' ? '#c084fc' : '#2af4ff';
      ctx.lineWidth   = key === '13' ? 2.5 : 1.5;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle    = '#ffffff';
      ctx.font         = `bold ${key === '13' ? 22 : 16}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, pos.x, pos.y);
    }
  }

  function _drawShuttle(pos) {
    const SW = 134, SH = 107; // размер шаттла на канвасе
    if (shuttleImg && shuttleImg.complete && shuttleImg.naturalWidth > 0) {
      ctx.drawImage(shuttleImg, pos.x - SW/2, pos.y - SH/2, SW, SH);
    } else {
      // Заглушка
      ctx.fillStyle   = '#555';
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.roundRect(pos.x - 40, pos.y - 22, 80, 44, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle    = '#fff';
      ctx.font         = 'bold 13px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ШАТТЛ', pos.x, pos.y);
    }
  }

  // ---------- Щупальца ----------

  function _drawTentacles() {
    if (typeof Tentacles !== 'undefined') {
      Tentacles.draw(ctx);
    }
  }

  // ---------- Месторождение кристаллов ----------

  function _drawCrystalDeposit() {
    const pos = PLATFORMS[13];
    if (!pos) return;

    const t = Date.now() / 1000;
    const pulse = 0.8 + 0.2 * Math.sin(t * 2);

    ctx.save();
    ctx.translate(pos.x, pos.y + PLATFORM_13_RADIUS - 5);

    // Свечение
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur  = 20 * pulse;

    // Кристалл — простая форма из треугольников
    const h = 32 * pulse;
    const w = 14;

    ctx.fillStyle = `rgba(0, 212, 255, ${0.7 * pulse})`;
    // Центральный кристалл
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w * 0.6, -h * 0.3);
    ctx.lineTo(w * 0.4, h * 0.3);
    ctx.lineTo(-w * 0.4, h * 0.3);
    ctx.lineTo(-w * 0.6, -h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Блик
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(w * 0.6, -h * 0.3);
    ctx.lineTo(0, -h * 0.1);
    ctx.closePath();
    ctx.fill();

    // Боковые кристаллы
    ctx.fillStyle = `rgba(0, 180, 220, ${0.5 * pulse})`;
    [-18, 18].forEach(ox => {
      ctx.beginPath();
      ctx.moveTo(ox, -h * 0.7);
      ctx.lineTo(ox + 8, -h * 0.2);
      ctx.lineTo(ox + 6, h * 0.2);
      ctx.lineTo(ox - 6, h * 0.2);
      ctx.lineTo(ox - 8, -h * 0.2);
      ctx.closePath();
      ctx.fill();
    });

    ctx.restore();
  }

  // ---------- Астронавт ----------

  function _drawAstronaut() {
    const x  = Astronaut.getRenderX();
    const y  = Astronaut.getRenderY();
    const st = Astronaut.getState();

    // Мигание во время неуязвимости
    const invinc = typeof Game !== 'undefined' && Game.invincTimer > 0;
    if (invinc && Math.floor(Date.now() / 150) % 2 === 0) return;

    const def      = ANIMS[anim.key];
    const hasSprite = def &&
                      def.frames.length > 0 &&
                      def.frames[anim.frame] &&
                      def.frames[anim.frame].complete &&
                      def.frames[anim.frame].naturalWidth > 0;

    if (hasSprite) {
      _drawSprite(x, y);
    } else {
      _drawPlaceholder(x, y, st);
    }

    if (Astronaut.getIsDiagonal() && !Astronaut.getDiagChosen()) {
      _drawDiagHint(x, y);
    }
  }

  function _drawSprite(x, y) {
    const def = ANIMS[anim.key];
    const img = def.frames[anim.frame];
    if (!img || !img.complete || !img.naturalWidth) return;

    const SW = 128, SH = 128;   // размер холста спрайта
    ctx.save();
    if (anim.mirror) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -SW / 2, -SH / 2, SW, SH);
    } else {
      ctx.translate(x, y);
      ctx.drawImage(img, -SW / 2, -SH / 2, SW, SH);
    }
    ctx.restore();
  }

  function _drawPlaceholder(x, y, st) {
    // Бур: опущен в IDLE/SPAWN, поднят в MOVE, активен в MINE
    const burY = (st === Astronaut.STATE.IDLE || st === Astronaut.STATE.SPAWNING)
      ? y - 10 : y - 22;

    ctx.save();
    ctx.shadowColor = '#2af4ff';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(x, y - 16, 16, 0, Math.PI * 2);
    ctx.fillStyle = (st === Astronaut.STATE.MINING)  ? '#ffcc00'
                  : (st === Astronaut.STATE.DEAD)     ? '#ff4444'
                  : '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#aaa';
    ctx.fillRect(x - 10, y - 14, 8, 16);
    ctx.fillRect(x + 2,  y - 14, 8, 16);

    ctx.beginPath();
    ctx.arc(x, y - 30, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8c00';
    ctx.fill();

    // Бур
    ctx.fillStyle = (st === Astronaut.STATE.MINING) ? '#ffcc00' : '#888';
    ctx.fillRect(x + 14, burY, 5, 18);

    // Эффект двигателей в MOVE
    if (st === Astronaut.STATE.MOVING) {
      const frameBoost = [0, 0.5, 1][anim.frame] || 0; // move: 3 кадра
      ctx.globalAlpha = 0.4 + 0.5 * frameBoost;
      ctx.fillStyle   = '#2af4ff';
      ctx.beginPath();
      ctx.ellipse(x - 6, y - 8, 5, 3 + 4 * frameBoost, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 6, y - 8, 5, 3 + 4 * frameBoost, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function _drawDiagHint(x, y) {
    ctx.save();
    ctx.globalAlpha  = 0.7 + 0.3 * Math.sin(Date.now() / 150);
    ctx.fillStyle    = '#ffcc00';
    ctx.font         = 'bold 18px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← →', x, y - 65);
    ctx.restore();
  }

  // ---------- Debug ----------

  function _drawDebug() {
    const st  = Astronaut.getState();
    const nd  = Astronaut.getNode();
    const t   = Astronaut.getMoveT().toFixed(2);
    const to  = Astronaut.getMoveTo();
    const spd = typeof Game !== 'undefined'
      ? Game.speedMultiplier.toFixed(2) : '1.00';
    const rx  = Math.round(Astronaut.getRenderX());
    const ry  = Math.round(Astronaut.getRenderY());

    // Щупальца
    const tentInfo = [];
    if (typeof Tentacles !== 'undefined') {
      for (const [id, s] of Object.entries(Tentacles.getRenderData ? [] : [])) {}
      const rd = Tentacles.getRenderData();
      for (const t of rd) {
        tentInfo.push(`${t.lairId}:ph${t.phase}`);
      }
    }

    const dy = (typeof HUD !== 'undefined') ? HUD.TOP_H + 4 : 4;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(4, dy, 240, 130);
    ctx.fillStyle    = '#0f0';
    ctx.font         = '11px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`state:  ${st}`,              10, dy+4);
    ctx.fillText(`node:   ${nd} → ${to}`,      10, dy+18);
    ctx.fillText(`pos:    ${rx},${ry}`,         10, dy+32);
    ctx.fillText(`t:      ${t}`,               10, dy+46);
    ctx.fillText(`speed:  ${spd}x`,            10, dy+60);
    ctx.fillText(`mirror: ${anim.mirror}`,     10, dy+74);
    ctx.fillStyle = '#ff6';
    ctx.fillText(`tents:  ${tentInfo.join(' ') || 'none'}`, 10, dy+88);
    // Крест на позиции астронавта для отладки
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx-8, ry); ctx.lineTo(rx+8, ry);
    ctx.moveTo(rx, ry-8); ctx.lineTo(rx, ry+8);
    ctx.stroke();
  }

  return { init, draw };
})();
