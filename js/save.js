// ===== save.js =====
// ============================================================
// save.js — localStorage, рекорд между сессиями
// ============================================================

const Save = (() => {

  const KEY = CONFIG.SAVE_KEY;

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Save] Ошибка записи:', e);
    }
  }

  function getRecord() {
    return _load().record || 0;
  }

  function setRecord(value) {
    const data = _load();
    data.record = value;
    _save(data);
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  // ---- Статистика для экрана РЕКОРДЫ (14.07.2026) ----
  function getStats() {
    const d = _load();
    return {
      flights:    d.flights    || 0,   // завершённых рейсов (доставок)
      totalMined: d.totalMined || 0,   // всего доставлено кристаллов за всё время
      bestTime:   d.bestTime   || 0,   // лучшее (мин.) время рейса, сек; 0 = нет данных
    };
  }
  function updateStats(delivered, runTime) {
    const d = _load();
    d.flights    = (d.flights    || 0) + 1;
    d.totalMined = (d.totalMined || 0) + delivered;
    if (runTime > 0 && (!d.bestTime || runTime < d.bestTime)) d.bestTime = runTime;
    _save(d);
  }

  return { getRecord, setRecord, clear, getStats, updateStats };

})();


