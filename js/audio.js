// ============================================================
// audio.js — Web Audio: эффекты + вибрация (16.07.2026)
// Инициализация лениво, в стеке первого пользовательского клика
// (autoplay policy). Громкость и вибро — в localStorage.
// ============================================================

const AudioFX = (() => {

  const FILES = ['tap','mine','deliver','warning','death','spawn','reward'];
  let ctx = null, master = null;
  const buf = {};
  let volume  = parseFloat(localStorage.getItem('ta_vol')  ?? '1');
  let vibroOn = (localStorage.getItem('ta_vibro') ?? '1') === '1';
  let sfxOn   = (localStorage.getItem('ta_sfx')   ?? '1') === '1';
  let musicOn = (localStorage.getItem('ta_music') ?? '1') === '1';
  let musicNodes = null; // осцилляторы дрона-заглушки

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
    if (musicOn) _startMusic();
  }

  // Фоновая музыка-ЗАГЛУШКА: синтезированный космо-дрон (луп без файла).
  // Замена на трек: положить assets/sfx/music.mp3 и переписать _startMusic на BufferSource loop=true.
  function _startMusic() {
    if (!ctx || musicNodes) return;
    const g = ctx.createGain(); g.gain.value = 0.10; g.connect(master);
    const mk = (type, freq, det) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det || 0;
      o.connect(g); o.start(); return o;
    };
    const o1 = mk('sine', 55), o2 = mk('sine', 82.5, 6), o3 = mk('triangle', 110, -5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lg = ctx.createGain(); lg.gain.value = 0.05;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    musicNodes = { g, osc: [o1, o2, o3, lfo] };
  }
  function _stopMusic() {
    if (!musicNodes) return;
    musicNodes.osc.forEach(o => { try { o.stop(); } catch(e){} });
    musicNodes.g.disconnect();
    musicNodes = null;
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
  }
  function getVolume() { return volume; }

  function pause()  { if (ctx && ctx.state === 'running')  ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

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
    if (musicOn) _startMusic(); else _stopMusic();
  }
  function getMusic()   { return musicOn; }
  function unlock()     { _init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { play, setVolume, getVolume, pause, resume, vibrate, setVibro, getVibro, setSfx, getSfx, setMusic, getMusic, unlock };

})();
