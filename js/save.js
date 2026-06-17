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

  return { getRecord, setRecord, clear };

})();
