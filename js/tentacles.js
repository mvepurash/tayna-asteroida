// ============================================================
// tentacles.js — логика и отрисовка щупалец
// Модель: сегменты накладываются по платформам маршрута
// 1 платформа маршрута = 1 BODY_SEGMENT в центре платформы
// HEAD рисуется на конечной платформе поверх последнего BODY
// ============================================================

const Tentacles = (() => {

  // ---------- Данные маршрутов (из Приложения Б + map.js) ----------
  // Формат: { lair: 'T1', routes: [[p1,p2,...], ...] }
  // Платформы маршрута = все узлы от логова до цели включительно

  const LAIRS = {
    T1: { side: 'left',  platforms: [2],  routes: [[2,5],[4,8],[4,5]] },
    T2: { side: 'right', platforms: [3],  routes: [[3,5],[6,8],[6,5]] },
    T3: { side: 'left',  platforms: [4,7,10], routes: [[4,5],[7,8],[7,11],[10,13],[10,11],[4,8]] },
    T4: { side: 'right', platforms: [6,9,12], routes: [[6,5],[9,8],[9,11],[12,13],[12,11],[6,8]] },
    T5: { side: 'left',  platforms: [10], routes: [[10,11],[10,13],[10,7]] },
    T6: { side: 'right', platforms: [12], routes: [[12,11],[12,9],[12,13]] },
  };

  // Группы А и Б (шахматный принцип, п. Б.6)
  const GROUP_A = ['T1', 'T4', 'T5'];
  const GROUP_B = ['T2', 'T3', 'T6'];

  // ---------- Состояние ----------

  // Для каждого лога — текущий активный маршрут и фаза
  const state = {};
  for (const id of Object.keys(LAIRS)) {
    state[id] = {
      routeIdx:    0,        // индекс текущего маршрута
      phase:       0,        // 0=скрыто, 1..N=длина выдвинутой части
      maxPhase:    0,        // максимальная фаза = длина маршрута
      extending:   false,    // выдвигается
      retracting:  false,    // втягивается
      holding:     false,    // пауза на максимуме
      elapsed:     0,        // время в текущей фазе (сек)
      danger:      false,    // сейчас опасно (phase > 0)
    };
  }

  // Какая группа сейчас активна
  let activeGroup = 'A';
  let _graceActive  = false;  // ждём grace period перед первой атакой
  let _graceElapsed = 0;       // секунд прошло
  let groupElapsed = 0;       // время с начала активации группы

  // Текущий активный лог внутри группы (индекс)
  let activeSlotIdx = 0;

  // Флаг паузы между группами
  let groupPausing = false;
  let groupPauseElapsed = 0;

  // Спрайты
  let headImg = null;
  let bodyImg = null;
  let spritesLoaded = false;

  // ---------- Загрузка спрайтов ----------

  function _loadSprites() {
    headImg = new Image();
    headImg.src = 'assets/sprites/tentacle_head.png';
    bodyImg = new Image();
    bodyImg.src = 'assets/sprites/tentacle_body.png';
    headImg.onload = bodyImg.onload = () => {
      if (headImg.complete && bodyImg.complete) spritesLoaded = true;
    };
  }

  // ---------- Инициализация ----------

  function init() {
    _loadSprites();
    _resetAllState();
  }

  function _resetAllState() {
    for (const id of Object.keys(LAIRS)) {
      const s = state[id];
      s.phase      = 0;
      s.extending  = false;
      s.retracting = false;
      s.holding    = false;
      s.elapsed    = 0;
      s.danger     = false;
      s.routeIdx   = 0;
      s.maxPhase   = LAIRS[id].routes[0].length;
    }
    activeGroup       = 'A';
    activeSlotIdx     = 0;
    groupElapsed      = 0;
    groupPausing      = false;
    groupPauseElapsed = 0;
  }

  // ---------- Получить текущие скорости с учётом speedMultiplier ----------

  function _speeds() {
    const mult = (typeof Game !== 'undefined' && Game.speedMultiplier)
      ? Game.speedMultiplier : 1;
    return {
      extend:  CONFIG.TENTACLE_EXTEND_DURATION  / 1000 / mult,
      retract: CONFIG.TENTACLE_RETRACT_DURATION / 1000 / mult,
      hold:    CONFIG.TENTACLE_HOLD_DURATION    / 1000 / mult,
      pause:   CONFIG.TENTACLE_SLOT_PAUSE       / 1000 / mult,
      warn:    CONFIG.TENTACLE_WARNING_TIME     / 1000 / mult,
    };
  }

  // ---------- Текущий активный слот лога ----------

  function _currentGroup() {
    return activeGroup === 'A' ? GROUP_A : GROUP_B;
  }

  function _currentLairId() {
    return _currentGroup()[activeSlotIdx % _currentGroup().length];
  }

  // ---------- Главный update ----------

  function update(dt) {
    const sp = _speeds();

    // Grace period — 3 секунды перед первой атакой
    if (_graceActive) {
      _graceElapsed += dt;
      if (_graceElapsed >= 5.0) {
        _graceActive = false;
        _startNextSlot();
      }
      return;
    }

    // Пауза между группами
    if (groupPausing) {
      groupPauseElapsed += dt;
      if (groupPauseElapsed >= sp.pause) {
        groupPausing      = false;
        groupPauseElapsed = 0;
        // Переключаем группу
        activeGroup    = activeGroup === 'A' ? 'B' : 'A';
        activeSlotIdx  = 0;
        _startNextSlot();
      }
      return;
    }

    const lairId = _currentLairId();
    const s      = state[lairId];
    const lair   = LAIRS[lairId];

    s.elapsed += dt;

    // --- Выдвижение ---
    if (s.extending) {
      if (s.elapsed >= sp.extend) {
        s.elapsed -= sp.extend;
        s.phase++;
        s.danger = true;

        if (s.phase >= s.maxPhase) {
          // Достигли максимума — переходим к паузе
          s.phase     = s.maxPhase;
          s.extending = false;
          s.holding   = true;
          s.elapsed   = 0;
        }
      }
      return;
    }

    // --- Пауза на максимуме ---
    if (s.holding) {
      if (s.elapsed >= sp.hold) {
        s.holding   = false;
        s.retracting = true;
        s.elapsed   = 0;
      }
      return;
    }

    // --- Втягивание ---
    if (s.retracting) {
      if (s.elapsed >= sp.retract) {
        s.elapsed -= sp.retract;
        s.phase--;

        if (s.phase <= 0) {
          // Полностью втянулось
          s.phase      = 0;
          s.retracting = false;
          s.danger     = false;
          s.elapsed    = 0;

          // Переходим к следующему маршруту этого лога
          s.routeIdx = (s.routeIdx + 1) % lair.routes.length;
          s.maxPhase = lair.routes[s.routeIdx].length;

          // Переходим к следующему слоту
          _nextSlot();
        }
      }
    }
  }

  function _startNextSlot() {
    const lairId = _currentLairId();
    console.log(`[Tentacle] Старт атаки: ${lairId}, маршрут[${state[lairId].routeIdx}]:`, LAIRS[lairId].routes[state[lairId].routeIdx]);
    const s      = state[lairId];
    const lair   = LAIRS[lairId];

    s.phase      = 0;
    s.extending  = true;
    s.retracting = false;
    s.holding    = false;
    s.elapsed    = 0;
    s.maxPhase   = lair.routes[s.routeIdx].length;
    s.danger     = false;
  }

  function _nextSlot() {
    activeSlotIdx++;
    if (activeSlotIdx >= _currentGroup().length) {
      // Все логова группы отработали — пауза перед сменой группы
      groupPausing      = true;
      groupPauseElapsed = 0;
      activeSlotIdx     = 0;
    } else {
      _startNextSlot();
    }
  }

  // ---------- Проверка захвата астронавта ----------

  function checkCapture() {
    for (const [lairId, s] of Object.entries(state)) {
      if (!s.danger || s.phase <= 0) continue;

      const lair  = LAIRS[lairId];
      const route = lair.routes[s.routeIdx];

      // Платформы занятые щупальцем = первые s.phase узлов маршрута
      for (let i = 0; i < s.phase; i++) {
        const node = route[i];
        if (Astronaut.isOnNode(node) || Astronaut.isOnNode(String(node))) {
          console.log(`[Tentacle] ЗАХВАТ! ${lairId} на узле ${node}`);
          return lairId; // захват!
        }
      }
    }
    return null;
  }

  // ---------- Геттеры для renderer ----------

  // Возвращает список платформ занятых щупальцами прямо сейчас
  function getDangerNodes() {
    const nodes = new Set();
    for (const [lairId, s] of Object.entries(state)) {
      if (!s.danger || s.phase <= 0) continue;
      const route = LAIRS[lairId].routes[s.routeIdx];
      for (let i = 0; i < s.phase; i++) {
        nodes.add(route[i]);
        nodes.add(String(route[i]));
      }
    }
    return nodes;
  }

  // Данные для рендера всех активных щупалец
  function getRenderData() {
    const result = [];
    for (const [lairId, s] of Object.entries(state)) {
      if (s.phase <= 0) continue;
      const lair  = LAIRS[lairId];
      const route = lair.routes[s.routeIdx];
      const side  = lair.side;

      // Платформы которые сейчас заняты (первые s.phase)
      const activePlatforms = route.slice(0, s.phase);

      result.push({
        lairId,
        side,
        activePlatforms,
        isHead: (idx) => idx === activePlatforms.length - 1,
        phase:  s.phase,
        maxPhase: s.maxPhase,
      });
    }
    return result;
  }

  // ---------- Отрисовка ----------

  function draw(ctx) {
    const renderData = getRenderData();

    // Рисуем логовища всегда (даже если щупальце не активно)
    _drawLairs(ctx);

    if (renderData.length === 0) return;

    const SEG_W  = 72;
    const SEG_H  = 34;
    const HEAD_W = 58;
    const HEAD_H = 46;

    for (const t of renderData) {
      // Точки пути: логово → платформы маршрута
      const lairPos  = LAIRS_POS[t.lairId];
      if (!lairPos) continue;

      // Строим список точек: логово + активные платформы
      const points = [lairPos];
      for (const nodeKey of t.activePlatforms) {
        const pos = PLATFORMS[nodeKey] || PLATFORMS[String(nodeKey)];
        if (pos) points.push(pos);
      }

      // Рисуем сегменты тела (кроме последней точки = голова)
      for (let i = 1; i < points.length - 1; i++) {
        const pos    = points[i];
        const mirror = (t.side === 'right');

        ctx.save();
        ctx.translate(pos.x, pos.y);
        if (mirror) ctx.scale(-1, 1);

        if (spritesLoaded && bodyImg.complete && bodyImg.naturalWidth > 0) {
          ctx.drawImage(bodyImg, -SEG_W/2, -SEG_H/2, SEG_W, SEG_H);
        } else {
          _drawPlaceholder(ctx, SEG_W/2, SEG_H/2, false);
        }
        ctx.restore();
      }

      // Рисуем голову на последней точке
      if (points.length >= 2) {
        const headPos = points[points.length - 1];
        const mirror  = (t.side === 'right');

        ctx.save();
        ctx.translate(headPos.x, headPos.y);
        if (mirror) ctx.scale(-1, 1);

        if (spritesLoaded && headImg.complete && headImg.naturalWidth > 0) {
          ctx.drawImage(headImg, -HEAD_W/2, -HEAD_H/2, HEAD_W, HEAD_H);
        } else {
          _drawPlaceholder(ctx, HEAD_W/2, HEAD_H/2, true);
        }
        ctx.restore();
      }
    }
  }

  function _drawLairs(ctx) {
    // Рисуем логовища по бокам — красные круги с метками
    for (const [id, pos] of Object.entries(LAIRS_POS)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fillStyle   = '#3a0000';
      ctx.strokeStyle = '#cc2200';
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle    = '#ff4400';
      ctx.font         = 'bold 11px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(id, pos.x, pos.y);
      ctx.restore();
    }
  }

  function _drawPlaceholder(ctx, rw, rh, isHead) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.fillStyle   = isHead ? '#cc2200' : '#881100';
    ctx.strokeStyle = '#ff4400';
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
    if (isHead) {
      ctx.fillStyle    = '#ff6600';
      ctx.font         = 'bold 14px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👁', 0, 0);
    }
  }

  // ---------- Публичный интерфейс ----------

  function _startFirstSlot() {
    // Grace period — управляется через update() по sessionTime
    // Просто ставим флаг, _startNextSlot вызовется из update
    _graceActive = true;
  }

  return {
    init,
    update,
    draw,
    checkCapture,
    getDangerNodes,
    getRenderData,
    LAIRS,
    _startFirstSlot,
  };

})();
