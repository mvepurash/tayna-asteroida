// ===== game.js =====
// ============================================================
// game.js — главный цикл
// БЕЗ setTimeout — все таймеры через dt (работает на file://)
// ============================================================

const Game = (() => {

  let lastTime        = 0;
  let sessionTime     = 0;
  let speedMultiplier = 1;
  let running         = false;

  // Таймер перезапуска после смерти (вместо setTimeout)
  let respawnTimer    = 0;
  let waitingRespawn  = false;
  let deathTimer      = 0;
  let waitingDeath    = false;
  let invincTimer     = 0;  // неуязвимость после respawn
  let miningTimer     = 0;  // таймер автодобычи при удержании
  let _pendingGameOver = false;  // ожидание показа экрана Game Over

  function init() {
    Save.getRecord();
    Renderer.init();
    Crew.init();
    Tentacles.init();
    Oxygen.init();
    Crystals.init();
    Input.init();
    UIManager.init();

    Astronaut.setOnDeath(_onDeath);

    // Стартуем в МЕНЮ: цикл рендерит фон игры, но геймплей не идёт
    running  = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // Полный запуск новой игры (кнопка НАЧАТЬ МИССИЮ / ПОПРОБОВАТЬ СНОВА)
  function startNewGame() {
    Crew.init();
    Crystals.init();
    Oxygen.reset();
    Crystals.resetRun();
    Tentacles.init();
    sessionTime     = 0;
    speedMultiplier = 1;
    waitingRespawn  = false;
    waitingDeath    = false;
    respawnTimer    = 0;
    deathTimer      = 0;
    invincTimer     = 0;
    Astronaut.startSpawning();
    Tentacles._startFirstSlot();
    running  = true;
    lastTime = performance.now();
  }

  // Выход в меню (из паузы) — глушим сессию
  function stopToMenu() {
    waitingRespawn = false;
    waitingDeath   = false;
    running        = true;  // цикл продолжает рендерить меню
    lastTime       = performance.now();
  }

  // Продолжение после рекламы (+1 жизнь): респавн без сброса кристаллов сессии
  function resumeAfterReward() {
    waitingRespawn = false;
    waitingDeath   = false;
    Astronaut.startSpawning();
    Oxygen.reset();
    Crystals.resetRun();
    invincTimer = 3.0;
    running  = true;
    lastTime = performance.now();
  }

  function loop(timestamp) {
    if (!running) { requestAnimationFrame(loop); return; }

    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // В меню/паузе/настройках/game over — геймплей стоит, только рендер + UI
    if (!UIManager.isPlaying()) {
      try { Renderer.draw(0); } catch(e) {}
      UIManager.draw(_ctx());
      requestAnimationFrame(loop);
      return;
    }

    // Таймер respawn (вместо setTimeout)
    if (waitingRespawn) {
      respawnTimer -= dt;
      if (respawnTimer <= 0) {
        waitingRespawn = false;
        if (_pendingGameOver) {
          _pendingGameOver = false;
          UIManager.setState(UIManager.STATE.GAME_OVER);
          Renderer.draw(0);
          UIManager.draw(_ctx());
          requestAnimationFrame(loop);
          return;
        }
        Astronaut.startSpawning();
        Oxygen.reset();
        Crystals.resetRun();
        invincTimer  = 3.0;  // 3 сек неуязвимости (начнётся после spawn-анимации)
        waitingDeath = false;
        deathTimer   = 0;
      }
      // Во время ожидания respawn — только рендерим
      Renderer.draw(dt);
      requestAnimationFrame(loop);
      return;
    }

    sessionTime     += dt;
    speedMultiplier  = 1 + sessionTime / CONFIG.SPEED_RAMP_TIME;

    Astronaut.update(dt);
    Tentacles.update(dt);
    Oxygen.update(dt);

    // Таймер неуязвимости после respawn — не тикает во время spawn-анимации,
    // чтобы все 3 секунды мигания шли уже после видимого появления астронавта
    if (invincTimer > 0 && !Astronaut.isSpawning()) invincTimer -= dt;

    // Автодобыча при удержании кнопки
    if (Astronaut.getIsMining()) {
      miningTimer -= dt;
      if (miningTimer <= 0) {
        miningTimer = CONFIG.MINING_HOLD_INTERVAL / 1000; // удержание медленнее
        Crystals.mine(true);  // bypass interval - управляется miningTimer
      }
    } else {
      miningTimer = 0;
    }

    // Захват щупальцем — с задержкой для анимации
    if (waitingDeath) {
      deathTimer -= dt;
      if (deathTimer <= 0) {
        waitingDeath = false;
        Astronaut.kill();
      }
    } else if (invincTimer <= 0) {
      const captured = Tentacles.checkCapture();
      if (captured && Astronaut.getState() !== Astronaut.STATE.DEAD) {
        Astronaut.freeze();  // мгновенно останавливаем движение
        waitingDeath = true;
        deathTimer   = 0.1;  // почти мгновенно → сразу анимация смерти
      }
    }

    // Возврат на шаттл
    _checkShuttleReturn();

    try {
      Renderer.draw(dt);
    } catch(e) {
      console.error('[Game] Renderer.draw error:', e.message);
    }
    UIManager.draw(_ctx());  // кнопка паузы поверх игры
    requestAnimationFrame(loop);
  }

  function _ctx() {
    return document.getElementById('game-canvas').getContext('2d');
  }

  function _checkShuttleReturn() {
    const node = Astronaut.getNode();
    const st   = Astronaut.getState();
    if (st !== Astronaut.STATE.IDLE) return;
    if (node !== 'shuttle') return;

    const delivered = Crystals.deliver();
    if (delivered > 0) {
      console.log(`[Game] Доставлено ${delivered} кристаллов`);
    }
    Oxygen.refill();
  }

  function _onDeath() {
    console.log('[Game] Астронавт погиб');
    Crystals.loseCarried();

    const hasMore = Crew.onDeath();
    if (!hasMore) {
      console.log('[Game] GAME OVER — экипаж погиб');
      // Даём 1.5с на анимацию смерти, затем экран Game Over
      waitingRespawn = true;
      respawnTimer   = 1.5;
      _pendingGameOver = true;
      return;
    }

    // Следующий астронавт через 2 сек
    waitingRespawn = true;
    respawnTimer   = 2.5;  // 1.5с анимация смерти + 1с пауза
  }

  function pause() {
    running = false;
    Oxygen.pause();
  }

  function resume() {
    running  = true;
    lastTime = performance.now();
    Oxygen.resume();
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', () => {
    console.log('[Game] load event fired');
    console.log('[Game] canvas:', document.getElementById('game-canvas'));
    if (typeof YaGames !== 'undefined') {
      YaGames.init().then(ysdk => {
        window.ysdk = ysdk;
        init();
      }).catch(() => init());
    } else {
      init();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); }
    else if (UIManager.isPlaying()) { resume(); }
    else { running = true; lastTime = performance.now(); requestAnimationFrame(loop); }
  });

  return {
    get speedMultiplier() { return speedMultiplier; },
    get sessionTime()     { return sessionTime;     },
    get invincTimer()     { return invincTimer;     },
    get waitingDeath()    { return waitingDeath;    },
    pause,
    resume,
    startNewGame,
    stopToMenu,
    resumeAfterReward,
  };

})();


