// ============================================================
// audio.js — Web Audio: эффекты + вибрация (16.07.2026)
// Инициализация лениво, в стеке первого пользовательского клика
// (autoplay policy). Громкость и вибро — в localStorage.
// ============================================================

const AudioFX = (() => {

  const FILES = ['tap','mine','deliver','warning','death','spawn','reward'];
  const MUSIC_MAIN  = 'assets/music/asteroid_ambient_01.mp3';  // фоновая музыка игры
  const MUSIC_DEATH = 'assets/music/asteroid_ambient_02.mp3';  // музыка экрана Game Over
  const MUSIC_FADE_MS = 300;
  let ctx = null, master = null;
  const buf = {};
  let volume  = parseFloat(localStorage.getItem('ta_vol')  ?? '1');
  let vibroOn = (localStorage.getItem('ta_vibro') ?? '1') === '1';
  let sfxOn   = (localStorage.getItem('ta_sfx')   ?? '1') === '1';
  let musicOn = (localStorage.getItem('ta_music') ?? '1') === '1';

  // Фоновая музыка — обычные <audio>-элементы (стриминг, без decodeAudioData
  // тяжёлых mp3 целиком в память). currentTrack: 'main' | 'death' | null.
  let mainMusicEl = null, deathMusicEl = null, currentTrack = null;
  let _wasPlayingOnPause = null; // трек, приостановленный через pause()

  function _init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    FILES.forEach(n => {
      fetch('assets/sfx/' + n + '.wav')
        .then(r => r.arrayBuffer())
        .then(ab => ctx.decodeAudioData(ab))
        .then(b => { buf[n] = b; })
        .catch(() => console.warn('[AudioFX] не загружен:', n));
    });
    // Музыкальные <audio>-элементы здесь НЕ создаём: их запускает либо явный
    // preloadMusic() (вызывает UIManager, когда все картинки интерфейса уже
    // точно загружены — чтобы тяжёлые mp3 не конкурировали с ними за сеть),
    // либо, как страховка, сам playMainMusic()/playDeathMusic() при первом
    // реальном воспроизведении.
  }

  // Явный публичный вызов — начать буферизацию музыки ЗАРАНЕЕ (не дожидаясь
  // клика/пуска трека), но только когда это безопасно по времени (см. выше).
  function preloadMusic() { _initMusicElements(); }

  function _initMusicElements() {
    if (mainMusicEl) return;
    mainMusicEl = new Audio(MUSIC_MAIN);
    mainMusicEl.loop = true;
    mainMusicEl.preload = 'auto';
    mainMusicEl.volume = volume;
    mainMusicEl.setAttribute('fetchpriority', 'low'); // не мешать загрузке UI-картинок (пауза/настройки и т.п.)
    deathMusicEl = new Audio(MUSIC_DEATH);
    deathMusicEl.loop = true;
    deathMusicEl.preload = 'auto';
    deathMusicEl.volume = volume;
    deathMusicEl.setAttribute('fetchpriority', 'low');
  }

  // Буферизация музыки запускается ЯВНО извне через preloadMusic() —
  // вызывает UIManager, как только все картинки интерфейса точно загружены
  // (см. ui_manager.js init()). Так тяжёлые mp3 никогда не конкурируют за
  // сеть с мелкими экранами (пауза/настройки), которые должны быть готовы
  // мгновенно по первому клику.

  function _fade(el, from, to, ms) {
    if (!el) return;
    const start = performance.now();
    const step = (now) => {
      try {
        const t = Math.min(1, (now - start) / ms);
        el.volume = from + (to - from) * t;
        if (t < 1) requestAnimationFrame(step);
      } catch (e) { /* аудио — второстепенный эффект, никогда не должен ронять игру */ }
    };
    try { requestAnimationFrame(step); } catch (e) {}
  }

  // Безопасный запуск HTMLMediaElement: .play() в редких случаях (политики
  // браузера/расширения/корп. окружение) может не вернуть нормальный Promise
  // или выбросить исключение синхронно — это НИКОГДА не должно ломать игровую
  // логику выше по стеку вызовов (клик "старт", смена состояний UI и т.д.)
  function _safePlay(el) {
    if (!el) return;
    try {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* проглатываем — звук необязателен для работы игры */ }
  }
  function _safePause(el) {
    if (!el) return;
    try { el.pause(); } catch (e) {}
  }

  // Переключение на фоновый трек игры (меню, полёт). Останавливает трек смерти.
  function playMainMusic() {
    try {
      _initMusicElements();
      if (currentTrack === 'main') return;
      if (deathMusicEl && !deathMusicEl.paused) { _safePause(deathMusicEl); deathMusicEl.currentTime = 0; }
      currentTrack = 'main';
      if (!musicOn) return;
      mainMusicEl.volume = 0;
      mainMusicEl.currentTime = mainMusicEl.currentTime || 0;
      _safePlay(mainMusicEl);
      _fade(mainMusicEl, 0, volume, MUSIC_FADE_MS);
    } catch (e) { console.warn('[AudioFX] playMainMusic:', e); }
  }

  // Переключение на трек экрана смерти (Game Over). Останавливает основной трек.
  function playDeathMusic() {
    try {
      _initMusicElements();
      if (currentTrack === 'death') return;
      if (mainMusicEl && !mainMusicEl.paused) { _safePause(mainMusicEl); }
      currentTrack = 'death';
      if (!musicOn) return;
      deathMusicEl.volume = 0;
      deathMusicEl.currentTime = 0;
      _safePlay(deathMusicEl);
      _fade(deathMusicEl, 0, volume, MUSIC_FADE_MS);
    } catch (e) { console.warn('[AudioFX] playDeathMusic:', e); }
  }

  function _stopMusic() {
    _safePause(mainMusicEl);
    _safePause(deathMusicEl);
  }

  function play(name, vol = 1) {
    _init();
    if (!ctx || !sfxOn) return;
    if (ctx.state === 'suspended') ctx.resume();
    const b = buf[name];
    if (!b) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(master);
    src.start();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('ta_vol', String(volume));
    if (master) master.gain.value = volume;
    if (mainMusicEl  && currentTrack === 'main')  mainMusicEl.volume  = volume;
    if (deathMusicEl && currentTrack === 'death') deathMusicEl.volume = volume;
  }
  function getVolume() { return volume; }

  function pause() {
    if (ctx && ctx.state === 'running') ctx.suspend();
    _wasPlayingOnPause = null;
    if (currentTrack === 'main'  && mainMusicEl  && !mainMusicEl.paused)  { mainMusicEl.pause();  _wasPlayingOnPause = 'main';  }
    if (currentTrack === 'death' && deathMusicEl && !deathMusicEl.paused) { deathMusicEl.pause(); _wasPlayingOnPause = 'death'; }
  }
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (musicOn && _wasPlayingOnPause === 'main'  && mainMusicEl)  mainMusicEl.play().catch(() => {});
    if (musicOn && _wasPlayingOnPause === 'death' && deathMusicEl) deathMusicEl.play().catch(() => {});
    _wasPlayingOnPause = null;
  }

  // ---- Вибрация (Android Chrome; iOS не поддерживает Vibration API) ----
  function vibrate(ms) {
    if (vibroOn && navigator.vibrate) navigator.vibrate(ms);
  }
  function setVibro(on) {
    vibroOn = !!on;
    localStorage.setItem('ta_vibro', vibroOn ? '1' : '0');
  }
  function getVibro() { return vibroOn; }
  function setSfx(on)   { sfxOn = !!on; localStorage.setItem('ta_sfx', sfxOn ? '1' : '0'); }
  function getSfx()     { return sfxOn; }
  function setMusic(on) {
    musicOn = !!on; localStorage.setItem('ta_music', musicOn ? '1' : '0');
    _init();
    if (musicOn) {
      // включаем именно тот трек, что должен звучать по текущей сцене
      const wanted = currentTrack === 'death' ? 'death' : 'main';
      currentTrack = null; // сброс, чтобы play*Music() не увидел "уже играет" и правда запустил звук
      if (wanted === 'death') playDeathMusic(); else playMainMusic();
    } else {
      _stopMusic();
    }
  }
  function getMusic()   { return musicOn; }
  function unlock()     { _init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { play, setVolume, getVolume, pause, resume, vibrate, setVibro, getVibro, setSfx, getSfx, setMusic, getMusic, unlock, playMainMusic, playDeathMusic, preloadMusic };

})();
