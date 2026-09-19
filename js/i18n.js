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
    console.log('[I18n] выбран язык:', lang);
    return lang;
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

  return { init, t, getLang };

})();
