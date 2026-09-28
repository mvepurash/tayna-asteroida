// ===== save.js =====
// ============================================================
// Сохранение прогресса.
//
// Два уровня, и это важно:
//
//   localStorage — источник правды ВНУТРИ сессии. Пишется синхронно,
//                  работает всегда, даже без интернета и вне площадки.
//
//   облако Яндекса (ysdk.getPlayer) — то, что переживает смену устройства
//                  и чистку браузера. Пишется с задержкой, чтобы не долбить
//                  их API на каждую доставленную партию кристаллов.
//
// Раньше было только localStorage. Формально требование «прогресс
// сохраняется между сессиями» это закрывает, но внутри iframe Яндекса
// Safari чистит хранилище по своим правилам, и игрок теряет рекорд на
// ровном месте. Плюс прогресс не переезжал между телефоном и компьютером.
//
// Разрешение конфликта при входе: рекорд и суммарная статистика берутся
// ПО МАКСИМУМУ из локального и облачного, лучшее время — по минимуму.
// Так игрок ничего не теряет, с какого бы устройства ни зашёл.
// ============================================================

const Save = (() => {

  const KEY = CONFIG.SAVE_KEY;
  const CLOUD_KEY = 'save';          // ключ внутри хранилища игрока
  const FLUSH_DELAY = 3000;          // мс тишины перед записью в облако

  let player = null;                 // объект игрока Яндекса, если доступен
  let cloudReady = false;
  let flushTimer = null;
  let pendingWrite = false;

  // ---------- локальный слой ----------

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function _saveLocal(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Save] Ошибка записи в localStorage:', e);
    }
  }

  // Любая запись идёт сюда: сразу в localStorage, в облако — погодя
  function _save(data) {
    _saveLocal(data);
    _scheduleCloudFlush();
  }

  // ---------- облачный слой ----------

  function _scheduleCloudFlush() {
    if (!cloudReady) return;
    pendingWrite = true;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(_flushCloud, FLUSH_DELAY);
  }

  function _flushCloud() {
    flushTimer = null;
    if (!cloudReady || !pendingWrite || !player) return;
    pendingWrite = false;
    try {
      const payload = {};
      payload[CLOUD_KEY] = _load();
      player.setData(payload, false).catch(e => {
        // Не роняем игру: локально всё уже сохранено
        console.warn('[Save] Облако недоступно, оставляем локально:', e);
      });
    } catch (e) {
      console.warn('[Save] setData():', e);
    }
  }

  // Слить облачные данные с локальными так, чтобы игрок ничего не потерял
  function _merge(localData, cloudData) {
    const l = localData || {}, c = cloudData || {};
    const out = Object.assign({}, l);
    out.record     = Math.max(l.record     || 0, c.record     || 0);
    out.flights    = Math.max(l.flights    || 0, c.flights    || 0);
    out.totalMined = Math.max(l.totalMined || 0, c.totalMined || 0);
    // Лучшее время — наименьшее ненулевое
    const times = [l.bestTime || 0, c.bestTime || 0].filter(v => v > 0);
    out.bestTime = times.length ? Math.min.apply(null, times) : 0;
    return out;
  }

  // Вызывается из game.js сразу после YaGames.init(). Возвращает промис,
  // но ждать его НЕ обязательно: игра стартует на локальных данных, а
  // облачные подмешиваются, как только придут.
  function initCloud(ysdk) {
    if (!ysdk || !ysdk.getPlayer) return Promise.resolve(false);
    // scopes: false — не просим у игрока личные данные, нам нужно только
    // хранилище. Так работает и для анонимных игроков, без окна входа.
    return ysdk.getPlayer({ scopes: false })
      .then(p => {
        player = p;
        cloudReady = true;
        return p.getData([CLOUD_KEY]);
      })
      .then(res => {
        const cloud = res && res[CLOUD_KEY];
        if (cloud) {
          const merged = _merge(_load(), cloud);
          _saveLocal(merged);
          console.log('[Save] Облачные данные подмешаны, рекорд:', merged.record);
          // Если локальные оказались богаче — вернём объединённое в облако
          _scheduleCloudFlush();
        } else {
          // В облаке пусто: заливаем то, что накопилось локально
          _scheduleCloudFlush();
        }
        return true;
      })
      .catch(e => {
        cloudReady = false;
        console.warn('[Save] Облако недоступно, работаем на localStorage:', e);
        return false;
      });
  }

  // ---------- публичное API (не менялось) ----------

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
    // Чистим и облако, иначе «сброс прогресса» вернётся при следующем входе
    if (cloudReady && player) {
      try {
        const payload = {};
        payload[CLOUD_KEY] = {};
        player.setData(payload, true).catch(() => {});
      } catch (e) {}
    }
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

  // Успеть записать при уходе со страницы: отложенная запись могла не сработать
  function flushNow() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    _flushCloud();
  }

  return { getRecord, setRecord, clear, getStats, updateStats, initCloud, flushNow };

})();
