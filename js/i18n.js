// ===== i18n.js =====
// ============================================================
// Локализация и автоопределение языка.
//
// Требование Яндекс Игр, пункт 2.14: автоопределение языка через
// ysdk.environment.i18n.lang должно быть реализовано у ВСЕХ игр —
// даже если заявлен один язык или текстов нет вообще. Определение
// обязано происходить при запуске, а не по ходу игры.
//
// Как работает: I18n.init(ysdk) вызывается один раз до старта игры,
// читает код языка игрока и выбирает словарь. Если язык не поддержан —
// откат на резервный (русский).
//
// Тексты на самих экранах (кнопки, заголовки) сейчас вшиты в картинки
// и существуют только на русском, поэтому SUPPORTED = ['ru'].
// Чтобы добавить язык: положить словарь в DICT, дописать код в SUPPORTED
// и подготовить картинки экранов на этом языке.
// ============================================================

const I18n = (() => {

  const FALLBACK = 'ru';
  const SUPPORTED = ['ru'];   // языки, для которых есть полный перевод И графика

  const DICT = {
    ru: {
      loading:        'ЗАГРУЗКА',
      shuttle:        'ШАТТЛ',
      record:         'РЕКОРД',
      minedPerRun:    'ДОБЫТО ЗА РЕЙС',
      mine:           'ДОБЫЧА',
      mineHint:       'НАЖИМАЙТЕ',
      resetConfirm:   'НАЖМИТЕ ЕЩЁ РАЗ ДЛЯ СБРОСА',
      reviveTitle:    'ВОССТАНОВЛЕНИЕ',
      reviveSubtitle: 'Подготовка систем скафандра',
      adCooldown:     'Реклама будет доступна через',
      seconds:        'с',
      crystals:       'кристаллов',
      noTime:         '--:--',
    },
    en: {
      loading:        'LOADING',
      shuttle:        'SHUTTLE',
      record:         'BEST',
      minedPerRun:    'MINED THIS RUN',
      mine:           'MINE',
      mineHint:       'TAP',
      resetConfirm:   'TAP AGAIN TO RESET',
      reviveTitle:    'RECOVERY',
      reviveSubtitle: 'Preparing suit systems',
      adCooldown:     'Ad available in',
      seconds:        's',
      crystals:       'crystals',
      noTime:         '--:--',
    },
  };

  let lang = FALLBACK;

  // Вызывается ОДИН РАЗ при запуске, до инициализации игры.
  // ysdk может быть undefined (запуск вне площадки) — тогда пробуем язык
  // браузера, и в любом случае откатываемся на резервный.
  function init(ysdk) {
    let detected = null;
    try {
      if (ysdk && ysdk.environment && ysdk.environment.i18n) {
        detected = ysdk.environment.i18n.lang;
        console.log('[I18n] язык из SDK Яндекса:', detected);
      }
    } catch (e) {
      console.warn('[I18n] не удалось прочитать язык из SDK:', e);
    }

    if (!detected && typeof navigator !== 'undefined') {
      detected = (navigator.language || '').slice(0, 2).toLowerCase();
      console.log('[I18n] язык из браузера (SDK недоступен):', detected);
    }

    lang = SUPPORTED.includes(detected) ? detected : FALLBACK;
    if (detected && lang !== detected) {
      console.log(`[I18n] язык "${detected}" не поддержан, откат на "${lang}"`);
    }

    // Режим проверки неполного перевода: ?lang=xx задаёт язык и текстов тоже,
    // иначе на английских экранах остались бы русские надписи от кода и
    // проверка была бы нерепрезентативной. Только для localhost/github.io.
    const forced = _forcedLang();
    if (forced && DICT[forced]) {
      lang = forced;
      console.log('[I18n] тексты тоже переключены на', forced, '(режим проверки)');
    }

    console.log('[I18n] выбран язык:', lang);
    return lang;
  }

  // Принудительный язык из адреса — только на localhost и github.io.
  // На площадке Яндекса игнорируется, чтобы игрок не включил незавершённый перевод.
  function _forcedLang() {
    try {
      const devHost = ['localhost', '127.0.0.1', ''].includes(location.hostname)
                   || location.hostname.endsWith('.github.io');
      if (!devHost) return null;
      return new URLSearchParams(location.search).get('lang');
    } catch (e) {
      return null;
    }
  }

  // Получить строку. Если ключа нет — возвращаем сам ключ, чтобы
  // пропажа перевода была заметна, а игра не падала.
  function t(key) {
    const pack = DICT[lang] || DICT[FALLBACK];
    if (pack && pack[key] !== undefined) return pack[key];
    const fb = DICT[FALLBACK];
    if (fb && fb[key] !== undefined) return fb[key];
    console.warn('[I18n] нет перевода для ключа:', key);
    return key;
  }

  function getLang() { return lang; }

  // Язык для картинок экранов. Отличается от getLang() тем, что может быть
  // переопределён параметром ?lang=xx для проверки неполных наборов до их
  // включения в SUPPORTED. Работает только на localhost и github.io —
  // на площадке Яндекса переопределение игнорируется.
  function getScreenLang() {
    const forced = _forcedLang();
    if (forced) {
      console.log('[I18n] язык экранов принудительно:', forced, '(режим проверки)');
      return forced;
    }
    return lang;
  }

  return { init, t, getLang, getScreenLang };

})();
