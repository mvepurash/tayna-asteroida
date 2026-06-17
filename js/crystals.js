// ============================================================
// crystals.js — добыча и доставка кристаллов
// "Добыто за рейс" — теряется при гибели
// "Кристаллы" — засчитываются только при возврате на шаттл
// ============================================================

const Crystals = (() => {

  let sessionTotal = 0;   // доставлено на шаттл за всю сессию
  let carried      = 0;   // несёт сейчас (ещё не доставлено)
  let lastTapTime  = 0;   // для ограничения частоты тапов
  let record       = 0;   // рекорд (из localStorage)

  // ---------- Инициализация ----------

  function init() {
    sessionTotal = 0;
    carried      = 0;
    lastTapTime  = 0;
    record       = Save ? (Save.getRecord() || 0) : 0;
  }

  function resetRun() {
    // Сбрасываем только "за рейс" — сессионный счёт остаётся
    carried = 0;
  }

  // ---------- Добыча (тап кнопки ДОБЫЧА) ----------

  function mine(bypass_interval = false) {
    const st = Astronaut.getState();
    if (st !== Astronaut.STATE.MINING) return false;

    // Проверяем что на платформе 13
    const node = Astronaut.getNode();
    if (node != 13 && node !== '13') return false;

    // Ограничение частоты тапов (только для ручных тапов)
    if (!bypass_interval) {
      const now = performance.now();
      if (now - lastTapTime < CONFIG.MINING_TAP_INTERVAL) return false;
      lastTapTime = now;
    }

    carried += CONFIG.CRYSTALS_PER_TAP;
    console.log('[Crystal] mine! carried='+carried+' total='+sessionTotal);
    console.log(`[Crystals] Добыто: +${CONFIG.CRYSTALS_PER_TAP}, несёт: ${carried}`);
    return true;
  }

  // ---------- Доставка на шаттл ----------

  // Вызывается из game.js когда астронавт возвращается на шаттл
  function deliver() {
    if (carried <= 0) return 0;

    const amount  = carried;
    sessionTotal += amount;
    carried       = 0;

    // Обновляем рекорд
    if (sessionTotal > record) {
      record = sessionTotal;
      if (typeof Save !== 'undefined') Save.setRecord(record);
    }

    console.log(`[Crystals] Доставлено: ${amount}, итого: ${sessionTotal}, рекорд: ${record}`);
    return amount;
  }

  // ---------- Гибель — теряем всё несённое ----------

  function loseCarried() {
    const lost = carried;
    carried    = 0;
    if (lost > 0) console.log(`[Crystals] Потеряно при гибели: ${lost}`);
    return lost;
  }

  // ---------- Геттеры ----------

  function getCarried()      { return carried;      }
  function getSessionTotal() { return sessionTotal; }
  function getRecord()       { return record;       }

  return {
    init,
    resetRun,
    mine,
    deliver,
    loseCarried,
    getCarried,
    getSessionTotal,
    getRecord,
  };

})();
