// ===== oxygen.js =====
// ============================================================
// oxygen.js — таймер кислорода
// 90 сек → убывает → 0 = смерть астронавта
// Пополняется при возврате на шаттл
// ============================================================

const Oxygen = (() => {

  let current  = CONFIG.OXYGEN_MAX;  // секунд
  let max      = CONFIG.OXYGEN_MAX;
  let depleted = false;               // уже сработала смерть
  let paused   = false;               // во время паузы/рекламы

  // ---------- Публичное API ----------

  function init() {
    current  = max;
    depleted = false;
    paused   = false;
  }

  function reset() {
    current  = max;
    depleted = false;
  }

  function pause()  { paused = true;  }
  function resume() { paused = false; }

  function update(dt) {
    if (paused) return;
    if (depleted) return;

    const st = Astronaut.getState();
    // Кислород не убывает пока астронавт мёртв или появляется
    if (st === Astronaut.STATE.DEAD || st === Astronaut.STATE.SPAWNING) return;

    current -= dt;

    if (current <= 0) {
      current  = 0;
      depleted = true;
      // Убиваем астронавта от удушья
      if (st !== Astronaut.STATE.DEAD) {
        console.log('[Oxygen] Кислород закончился — астронавт погиб');
        Astronaut.kill();
      }
    }
  }

  // Вызывается когда астронавт вернулся на шаттл
  function refill() {
    current  = max;
    depleted = false;
    console.log('[Oxygen] Кислород пополнен');
  }

  // ---------- Геттеры ----------

  function getCurrent()  { return current; }
  function getMax()      { return max; }
  function getRatio()    { return current / max; }        // 0..1
  function getSeconds()  { return Math.ceil(current); }  // для HUD
  function isDepleted()  { return depleted; }

  // Уровень тревоги для HUD (цвет шкалы)
  // 0 = норма (синий), 1 = внимание (жёлтый), 2 = критично (красный)
  function getAlertLevel() {
    const ratio = getRatio();
    if (ratio > 0.5) return 0;
    if (ratio > 0.25) return 1;
    return 2;
  }

  return {
    init,
    reset,
    pause,
    resume,
    update,
    refill,
    getCurrent,
    getMax,
    getRatio,
    getSeconds,
    isDepleted,
    getAlertLevel,
  };

})();


