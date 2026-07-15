// ===== astronaut.js =====
// ============================================================
// astronaut.js — state-машина астронавта
// Состояния: IDLE | MOVING | MINING | DEAD | SPAWNING
// ============================================================

const Astronaut = (() => {

  // ---------- Состояния ----------
  const STATE = {
    IDLE:     'idle',
    MOVING:   'moving',
    MINING:   'mining',
    DEAD:     'dead',
    SPAWNING: 'spawning',
  };

  // ---------- Внутренние данные ----------
  let state       = STATE.IDLE;
  let node        = 'shuttle';   // текущий узел (ключ из PLATFORMS)
  let prevNode    = null;        // откуда пришли (для разворота)

  // Движение
  let moveFrom    = null;        // узел-источник
  let moveTo      = null;        // узел-цель
  let moveT       = 0;           // прогресс 0..1
  let moveDir     = null;        // 'up'|'down'|'left'|'right' — кнопка запустила движение

  // Диагональ
  let isDiagonal  = false;       // текущий переход — диагональный?
  let diagKey     = null;        // ключ в DIAGONAL_TARGETS, напр. '1_down'
  let diagChosen  = false;       // цель уже зафиксирована игроком?
  let diagDefault = 'right';     // если не скорректировал — идём вправо (по умолчанию)

  // Разворот (противоход)
  let isTurning   = false;       // астронавт тормозит и разворачивается?
  let turnTarget  = null;        // новая цель после разворота

  // Буфер ввода: кнопка, нажатая во второй половине пути
  let inputBuffer = null;

  // Добыча
  let isMining    = false;

  // Spawn-анимация (5 кадров при появлении/респавне)
  let spawnTimer    = 0;     // секунд осталось до конца анимации появления
  const SPAWN_DURATION = 5.0; // секунд — 5 кадров × 1fps

  // Позиция для рендера (интерполируется)
  let renderX     = 0;
  let renderY     = 0;

  // ---------- Вспомогательные ----------

  function getPos(nodeKey) {
    return PLATFORMS[nodeKey];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Easing: плавный старт и торможение
  function easeInOut(t) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Получить диагональную цель по коррекции
  function getDiagTarget(side) {
    const targets = DIAGONAL_TARGETS[diagKey];
    if (!targets) return null;
    return targets[side] || null;
  }

  // Зафиксировать цель диагонального перехода
  function fixDiagTarget(side) {
    if (diagChosen) return;
    const target = getDiagTarget(side);
    if (target !== null) {
      moveTo     = target;
      diagChosen = true;
    }
  }

  // ---------- Публичное API ----------

  function init() {
    state     = STATE.IDLE;
    node      = 1;  // стартуем на платформе 1 (шаттл выше)
    prevNode  = null;
    // renderX/Y = позиция платформы 1
    const startPos = PLATFORMS[1];
    renderX   = startPos ? startPos.x : 240;
    renderY   = startPos ? startPos.y : 182;
    isMining  = false;
  }

  // Запускает анимацию появления (5 кадров) на платформе 1.
  // Вызывается из game.js вместо/после init() при старте и при respawn.
  function startSpawning() {
    state      = STATE.SPAWNING;
    node       = 1;
    prevNode   = null;
    isMining   = false;
    spawnTimer = SPAWN_DURATION;
    // Стартуем из ворот шаттла (нижняя часть здания, откуда выходит астронавт)
    const shuttle = PLATFORMS['shuttle'] || { x: 240, y: 84 };
    renderX = shuttle.x;
    renderY = shuttle.y + 81; // ворота шаттла ≈ на 81px ниже верхушки
  }

  function getSpawnProgress() { return state === STATE.SPAWNING ? 1 - (spawnTimer / SPAWN_DURATION) : 1; }

  function isSpawning() {
    return state === STATE.SPAWNING;
  }

  // Вызывается из input.js при нажатии D-pad
  function handleInput(dir) {
    if (state === STATE.DEAD) return;

    // --- Астронавт стоит ---
    if (state === STATE.IDLE) {
      _startMove(dir);
      return;
    }

    // --- Астронавт движется ---
    if (state === STATE.MOVING) {
      const pastTurnPoint = moveT >= CONFIG.ASTRONAUT_TURN_POINT;

      // Коррекция диагонали (←→ во время диагонального перехода)
      if (isDiagonal && !diagChosen && (dir === 'left' || dir === 'right')) {
        fixDiagTarget(dir);
        return;
      }

      // Противоход (кнопка в противоположном направлении)
      if (_isOpposite(dir, moveDir)) {
        if (!pastTurnPoint) {
          // До точки невозврата — разворот
          _startTurn();
        }
        // После точки невозврата — летим до цели, игнорируем
        return;
      }

      // Буферизуем следующий ввод (после точки невозврата)
      if (pastTurnPoint) {
        inputBuffer = dir;
      }
    }

    // Добыча: любая кнопка движения прерывает
    if (state === STATE.MINING) {
      isMining = false;
      state = STATE.IDLE;
      _startMove(dir);
    }
  }

  // Нажатие кнопки ДОБЫЧА
  function handleMine() {
    if (state !== STATE.IDLE) return false;
    if (node !== 13 && node !== '13') return false; // только на платформе 13
    state    = STATE.MINING;
    isMining = true;
    return true;
  }

  // Остановить добычу
  function stopMine() {
    if (state !== STATE.MINING) return;
    isMining = false;
    state    = STATE.IDLE;
  }

  // Вызывается при захвате — замораживаем астронавта до анимации смерти
  function freeze() {
    if (state === STATE.DEAD) return;
    // Останавливаем движение — фиксируем текущую визуальную позицию
    // renderX/Y уже содержат интерполированное положение — НЕ меняем их
    state       = STATE.IDLE;
    moveT       = 0;
    moveTo      = null;
    moveFrom    = null;
    isMining    = false;
    inputBuffer = null;
    // node остаётся прежним — астронавт "завис" там где был визуально
  }

  // Вызов из game.js при захвате щупальцем
  function kill() {
    if (state === STATE.DEAD) return;
    state    = STATE.DEAD;
    isMining = false;
    moveT    = 0;
    moveTo   = null;
    moveFrom = null;
    // Фиксируем точно на центре платформы где произошёл захват
    const deathPos = getPos(node) || getPos(String(node));
    if (deathPos) {
      renderX = deathPos.x;
      renderY = deathPos.y;
    }
    if (typeof onDeath === 'function') onDeath();
  }

  // Главный update — вызывается каждый кадр из game.js
  function update(dt) {
    // Spawn-анимация: блокирует движение, но не блокирует рендер.
    // По истечении SPAWN_DURATION — автоматический переход в IDLE.
    if (state === STATE.SPAWNING) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 0;
        state = STATE.IDLE;
      }
      // Позиция астронавта интерполируется от шаттла до платформы 1 по кадрам
      // 5 кадров с ease-out: быстро вылетает, медленно приземляется
      const shuttleRaw = getPos('shuttle') || { x: 240, y: 84 };
      const shuttle  = { x: shuttleRaw.x, y: shuttleRaw.y + 81 }; // ворота
      const platform = getPos('1')       || { x: 240, y: 246 };
      const progress = 1 - (spawnTimer / SPAWN_DURATION);  // 0→1
      // Мультяшная схема (14.07.2026): 0..0.3 — материализация в воротах;
      // 0.3..0.7 — полёт вниз (ease-in-out); 0.7..1 — приземление на платформе.
      if (progress < 0.3) {
        renderX = shuttle.x; renderY = shuttle.y;
      } else if (progress < 0.7) {
        let t = (progress - 0.3) / 0.4;
        t = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; // easeInOutQuad
        renderX = shuttle.x + (platform.x - shuttle.x) * t;
        renderY = shuttle.y + (platform.y - shuttle.y) * t;
      } else {
        renderX = platform.x; renderY = platform.y;
      }
      return;
    }

    // Мёртвый не двигается и не обновляет позицию
    if (state === STATE.DEAD) {
      return; // renderX/Y остаются там где умер
    }
    if (state === STATE.MOVING && moveT < 0.05) {
      console.log('[Astro] update MOVING: from='+moveFrom+' to='+moveTo+' t='+moveT.toFixed(3));
    }
    if (state !== STATE.MOVING) {
      // Стоим — renderX/Y = позиция текущего узла
      // НО только если есть валидный node с позицией
      const pos = getPos(node);
      if (pos && state === STATE.IDLE) { 
        renderX = pos.x; 
        renderY = pos.y; 
      }
      return;
    }

    const duration = (CONFIG.ASTRONAUT_MOVE_DURATION / 1000) / _speedMult(); // мс → секунды
    moveT += dt / duration;

    if (moveT >= 1) {
      // Достигли цели
      moveT    = 1;
      node     = moveTo;
      prevNode = moveFrom;
      state    = STATE.IDLE;
      isTurning = false;
      isDiagonal = false;
      diagChosen = false;
      diagKey    = null;

      // Обновляем renderX/Y точно в центр платформы
      const pos = getPos(node);
      renderX = pos.x;
      renderY = pos.y;

      // Проигрываем буферизованный ввод
      if (inputBuffer !== null) {
        const buf = inputBuffer;
        inputBuffer = null;
        _startMove(buf);
      }
      return;
    }

    // Интерполяция позиции
    const easedT = isTurning
      ? easeInOut(moveT)    // при развороте — плавнее
      : easeInOut(moveT);

    const fromPos = getPos(moveFrom);
    const toPos   = getPos(moveTo);
    if (!fromPos || !toPos) {
      console.log('[Astro] ОШИБКА getPos: moveFrom='+moveFrom+'('+typeof moveFrom+')='+JSON.stringify(fromPos)+' moveTo='+moveTo+'('+typeof moveTo+')='+JSON.stringify(toPos));
      // НЕ сбрасываем в IDLE — просто пропускаем этот кадр
      return;
    }
    const newX = lerp(fromPos.x, toPos.x, easedT);
    const newY = lerp(fromPos.y, toPos.y, easedT);
    if (Math.abs(newX - renderX) > 1 || Math.abs(newY - renderY) > 1) {
      console.log('[Astro] MOVE t='+easedT.toFixed(2)+' pos='+Math.round(newX)+','+Math.round(newY)+' from='+fromPos.x+','+fromPos.y+' to='+toPos.x+','+toPos.y);
    }
    renderX = newX;
    renderY = newY;
  }

  // ---------- Приватные методы ----------

  function _startMove(dir) {
    const nav = NAV[node];
    if (!nav) {
      console.log('[Astro] _startMove: нет NAV для node=', node, typeof node);
      return;
    }

    const target = nav[dir];
    console.log('[Astro] _startMove:', dir, 'node=', node, '→ target=', target);
    if (target === null || target === undefined) {
      console.log('[Astro] стена — движение отменено');
      return; // стена
    }

    moveFrom   = node;
    moveDir    = dir;
    moveT      = 0;
    isTurning  = false;
    inputBuffer = null;

    if (target === 'diagonal') {
      isDiagonal = true;
      diagChosen = false;
      diagKey    = `${node}_${dir}`;

      // Временная цель — правый вариант по умолчанию (меняется коррекцией)
      const targets = DIAGONAL_TARGETS[diagKey];
      moveTo = targets ? targets[diagDefault] : null;
      if (moveTo === null) return; // нет данных — не двигаемся

      state = STATE.MOVING;
    } else {
      isDiagonal = false;
      diagChosen = true;
      moveTo = target;
      state  = STATE.MOVING;
    }
  }

  function _startTurn() {
    // Меняем местами from/to, пересчитываем t как (1 - t)
    // чтобы астронавт плавно вернулся на исходную платформу
    isTurning = true;
    const tmpFrom = moveFrom;
    moveFrom  = moveTo;
    moveTo    = tmpFrom;
    moveT     = 1 - moveT;

    // После разворота цель = исходная платформа (moveFrom до свапа)
    // moveTo теперь = исходная платформа — всё корректно
  }

  function _isOpposite(a, b) {
    return (a === 'up'   && b === 'down')  ||
           (a === 'down' && b === 'up')    ||
           (a === 'left' && b === 'right') ||
           (a === 'right'&& b === 'left');
  }

  function _speedMult() {
    // Импортируем из game.js через глобальный объект
    return (typeof Game !== 'undefined' && Game.speedMultiplier)
      ? Game.speedMultiplier
      : 1;
  }

  // ---------- Геттеры для renderer.js / game.js ----------

  function getState()   { return state;    }
  function getNode()    { return node;     }
  function getRenderX() { return renderX;  }
  function getRenderY() { return renderY;  }
  function getMoveT()   { return moveT;    }
  function getMoveTo()  { return moveTo;   }
  function getMoveFrom(){ return moveFrom; }
  function getIsDiagonal() { return isDiagonal; }
  function getDiagChosen() { return diagChosen; }
  function getIsMining()   { return isMining;   }

  // Проверка: астронавт находится на (или движется через) данный узел
  function isOnNode(checkNode) {
    if (state === STATE.DEAD) return false;
    if (state === STATE.MOVING) {
      // Во время движения уязвим ТОЛЬКО на целевой платформе
      // и только когда уже долетел (moveT > 0.8)
      // moveFrom полностью безопасна — ушёл, значит ушёл
      if (moveTo == checkNode) return moveT > 0.8;
      return false;
    }
    // Стоит — уязвим на текущей платформе
    return node == checkNode;
  }

  // Callback при гибели (game.js назначает)
  let onDeath = null;
  function setOnDeath(fn) { onDeath = fn; }

  // ---------- Публичный интерфейс ----------
  return {
    STATE,
    init,
    update,
    handleInput,
    handleMine,
    stopMine,
    kill,
    freeze,
    getSpawnProgress,
    setOnDeath,
    getState,
    getNode,
    getRenderX,
    getRenderY,
    getMoveT,
    getMoveTo,
    getMoveFrom,
    getIsDiagonal,
    getDiagChosen,
    getIsMining,
    isOnNode,
    startSpawning,
    isSpawning,
  };

})();


