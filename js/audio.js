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
    _initMusicElements();
    if (musicOn) playMainMusic();
  }

  function _initMusicElements() {
    if (mainMusicEl) return;
    mainMusicEl = new Audio(MUSIC_MAIN);
    mainMusicEl.loop = true;
    mainMusicEl.preload = 'auto';
    mainMusicEl.volume = volume;
    deathMusicEl = new Audio(MUSIC_DEATH);
    deathMusicEl.loop = true;
    deathMusicEl.preload = 'auto';
    deathMusicEl.volume = volume;
  }

  function _fade(el, from, to, ms) {
    if (!el) return;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      el.volume = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(step); 
    };
    requestAnimationFrame(step);
  }

  // Переключение на фоновый трек игры (меню, полёт). Останавливает трек смерти.
  function playMainMusic() {
    _initMusicElements();
    if (currentTrack === 'main') return;
    if (deathMusicEl && !deathMusicEl.paused) { deathMusicEl.pause(); deathMusicEl.currentTime = 0; }
    currentTrack = 'main';
    if (!musicOn) return;
    mainMusicEl.volume = 0;
    mainMusicEl.currentTime = mainMusicEl.currentTime || 0;
    mainMusicEl.play().catch(() => {});
    _fade(mainMusicEl, 0, volume, MUSIC_FADE_MS);
  }

  // Переключение на трек экрана смерти (Game Over). Останавливает основной трек.
  function playDeathMusic() {
    _initMusicElements();
    if (currentTrack === 'death') return;
    if (mainMusicEl && !mainMusicEl.paused) { mainMusicEl.pause(); }
    currentTrack = 'death';
    if (!musicOn) return;
    deathMusicEl.volume = 0;
    deathMusicEl.currentTime = 0;
    deathMusicEl.play().catch(() => {});
    _fade(deathMusicEl, 0, volume, MUSIC_FADE_MS);
  }

  function _stopMusic() {
    if (mainMusicEl)  mainMusicEl.pause();
    if (deathMusicEl) deathMusicEl.pause();
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

  return { play, setVolume, getVolume, pause, resume, vibrate, setVibro, getVibro, setSfx, getSfx, setMusic, getMusic, unlock, playMainMusic, playDeathMusic };

})();
