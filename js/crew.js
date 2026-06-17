// ============================================================
// crew.js — управление экипажем (3 астронавта)
// ============================================================

const Crew = (() => {

  let total = CONFIG.CREW_SIZE;   // 3
  let alive  = CONFIG.CREW_SIZE;  // сколько осталось

  function init() {
    total = CONFIG.CREW_SIZE;
    alive = CONFIG.CREW_SIZE;
  }

  // Вызывается при гибели астронавта
  // Возвращает true если есть ещё астронавты, false = game over
  function onDeath() {
    alive = Math.max(0, alive - 1);
    console.log(`[Crew] Погиб астронавт. Осталось: ${alive}/${total}`);
    return alive > 0;
  }

  function getAlive() { return alive; }
  function getTotal() { return total; }
  function isGameOver() { return alive <= 0; }

  return { init, onDeath, getAlive, getTotal, isGameOver };

})();
