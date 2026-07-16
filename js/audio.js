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
  }

  function play(name, vol = 1) {
    _init();
    if (!ctx) return;
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

  return { play, setVolume, getVolume, pause, resume, vibrate, setVibro, getVibro };

})();
