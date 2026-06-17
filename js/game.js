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

  function init() {
    Save.getRecord();
    Renderer.init();
    Crew.init();
    Astronaut.init();
    Tentacles.init();
    Oxygen.init();
    Crystals.init();
    Input.init();

    Astronaut.setOnDeath(_onDeath);
    Tentacles._startFirstSlot();

    running  = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(timestamp) {
    if (!running) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Таймер respawn (вместо setTimeout)
    if (waitingRespawn) {
      respawnTimer -= dt;
      if (respawnTimer <= 0) {
        waitingRespawn = false;
        if (Crew.isGameOver()) {
          // Полный рестарт
          Crew.init();
          Crystals.init();
          sessionTime = 0;
          speedMultiplier = 1;
        }
        Astronaut.init();
        Oxygen.reset();
        Crystals.resetRun();
        invincTimer  = 3.0;  // 3 сек неуязвимости
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

    // Таймер неуязвимости после respawn
    if (invincTimer > 0) invincTimer -= dt;

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
        deathTimer   = 0.8;
      }
    }

    // Возврат на шаттл
    _checkShuttleReturn();

    Renderer.draw(dt);
    requestAnimationFrame(loop);
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
      // TODO: показать экран game over
      // Пока просто останавливаем игру на 3 сек потом рестарт
      waitingRespawn = true;
      respawnTimer   = 3.0;
      return;
    }

    // Следующий астронавт через 2 сек
    waitingRespawn = true;
    respawnTimer   = 2.0;
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
    if (document.hidden) pause();
    else resume();
  });

  return {
    get speedMultiplier() { return speedMultiplier; },
    get sessionTime()     { return sessionTime;     },
    get invincTimer()     { return invincTimer;     },
    pause,
    resume,
  };

})();
