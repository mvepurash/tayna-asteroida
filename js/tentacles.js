// ===== tentacles.js =====
// ============================================================
// НЕЗЫБЛЕМЫЕ ПРАВИЛА ДВИЖЕНИЯ ЧЕРВЕЙ (нарушение ЗАПРЕЩЕНО):
// ПРАВИЛО 1: Змеи НИКОГДА не пересекаются визуально
// ПРАВИЛО 2: Змеи НИКОГДА не атакуют одну платформу одновременно
// ПРАВИЛО 3: Хвост НИКОГДА не показывается из логова
// ПРАВИЛО 4: Движение ТЕЛЕСКОПИЧЕСКОЕ
// ПРАВИЛО 5: Голова НИКОГДА не разворачивается к логову
// ПРАВИЛО 6: Туловище НЕПРЕРЫВНО (Catmull-Rom)
//
// СИСТЕМА ЗАПУСКА (зафиксировано):
//   Старт:   T1(0мс) → T6(2400мс) → T5(4800мс) → T2(7200мс) → T3(9600мс) → T4(12000мс)
//   Задержка между стартами: 2400мс
//   Прогрессия: 0→T1+T6, 500→+T5, 1000→+T2, 1500→+T3, 2000→+T4
//
//   ЧЁТНЫЕ циклы:   ЛЕВЫЕ (T1,T3,T5) используют маршруты к центру
//                   ПРАВЫЕ (T2,T4,T6) — только короткие маршруты
//   НЕЧЁТНЫЕ циклы: ПРАВЫЕ идут к центру, ЛЕВЫЕ — только короткие
//   T6 — исключение: всегда начинает с [12,13], всегда угрожает платформе 13
//
//   Ротация +1 ОТМЕНЕНА — вариативность обеспечивают чётность и прогрессия
// ============================================================

const Tentacles = (() => {

  // ---------- Маршруты ----------
  // Два набора на каждого червя: полные (к центру) и короткие (только ближние платформы)
  const LAIRS = {
    T1: {
      side: 'left',
      full:  [[2],[4],[2,1],[2,5],[4,8],[4,5]],
      short: [[2],[4],[2],[4],[2],[4]],
    },
    T2: {
      side: 'right',
      full:  [[3],[6],[3,1],[3,5],[6,5],[6,8]],
      short: [[3],[6],[3],[6],[3],[6]],
    },
    T3: {
      side: 'left',
      full:  [[4],[7],[4,5],[4,8],[7,8],[7,11]],
      short: [[4],[7],[4],[7],[4],[7]],
    },
    T4: {
      side: 'right',
      full:  [[6],[9],[6,5],[6,8],[9,8],[9,11]],
      short: [[6],[9],[6],[9],[6],[9]],
    },
    T5: {
      side: 'left',
      full:  [[10],[7],[7,8],[7,11],[10,11],[10,13]],
      short: [[10],[7],[10],[7],[10],[7]],
    },
    T6: {
      // T6 — исключение: всегда full, первый маршрут сразу [12,13] (угроза кристаллам)
      side: 'right',
      full:  [[12,13],[12,13],[9,8],[9,11],[12,11],[12,13]],
      short: [[12,13],[12,13],[9,8],[9,11],[12,11],[12,13]],
    },
  };

  const ALL_IDS    = ['T1','T2','T3','T4','T5','T6'];
  const LEFT_IDS   = ['T1','T3','T5'];
  const RIGHT_IDS  = ['T2','T4','T6'];

  // Порядок запуска и порог разблокировки (кристаллов)
  const LAUNCH_ORDER = [
    { id: 'T1', unlock: 0    },
    { id: 'T6', unlock: 0    },
    { id: 'T5', unlock: 500  },
    { id: 'T2', unlock: 1000 },
    { id: 'T3', unlock: 1500 },
    { id: 'T4', unlock: 2000 },
  ];

  const START_DELAY_MS = 2400;
  const INITIAL_DELAY  = 3.0;

  // ---------- Скорость от кристаллов ----------
  const CRYSTALS_PER_STEP   = 500;
  const SPEED_MULT_PER_STEP = 0.8;
  const BASE_SPEED = 68;
  const BASE_HOLD  = 0.6;
  const BASE_PAUSE = 1.0;

  function _totalCrystals() {
    return (typeof Crystals !== 'undefined') ? Crystals.getRecord() : 0;
  }

  function _getSpeedMult() {
    const steps = Math.floor(_totalCrystals() / CRYSTALS_PER_STEP);
    return Math.max(0.4, Math.pow(SPEED_MULT_PER_STEP, steps)); // потолок скорости x2.5
  }

  function _effectiveSpeed() { return BASE_SPEED / _getSpeedMult(); }
  function _effectiveHold()  { return BASE_HOLD  * _getSpeedMult(); }
  function _effectivePause() { return BASE_PAUSE * _getSpeedMult(); }

  // ---------- Выбор маршрутов по чётности цикла ----------
  function _routes(id, cycleCount) {
    const lair   = LAIRS[id];
    const isEven = (cycleCount % 2 === 0);
    const isLeft = LEFT_IDS.includes(id);
    // Чётный: левые используют full, правые — short (кроме T6)
    // Нечётный: правые используют full, левые — short
    if (id === 'T6') return lair.full; // T6 всегда full
    if (isEven) return isLeft ? lair.full : lair.short;
    return isLeft ? lair.short : lair.full;
  }

  // ---------- Прогрессия: активные черви ----------
  function _activeIds() {
    const total = _totalCrystals();
    return LAUNCH_ORDER
      .filter(e => total >= e.unlock)
      .map(e => e.id);
  }

  // ---------- Состояние ----------
  const state = {};
  for (const id of ALL_IDS) {
    state[id] = {
      routeIdx:  0,
      phase:     'idle',
      timer:     0,
      trail:     [],
      pathPts:   [],
      headIdx:   0,
      tailIdx:   0,
      started:   false,
      totalRoutesCompleted: 0,
      cycleCount: 0,  // сколько полных наборов из 6 маршрутов прошёл этот червь
    };
  }

  let sessionTime    = 0;
  let _started       = false;
  let startTimes     = {};
  let cycleStartTime = 0;

  function _calcStartTimes() {
    const active = _activeIds();
    startTimes = {};
    LAUNCH_ORDER.forEach((e, i) => {
      if (active.includes(e.id)) {
        startTimes[e.id] = cycleStartTime + i * START_DELAY_MS;
      }
    });
  }


  // ---------- Отрисовка ----------
  const SEG_SPACING = 10;
  const SEG_SIZE    = 28;
  let _segImg  = null;
  let _headImg = null;

  function _loadSprites() {
    const td = (typeof window !== 'undefined' && window.TENTACLE_SPRITE_DATA) || {};
    _segImg  = new Image(); _segImg.src  = td.body   || td.segment || '';
    _headImg = new Image(); _headImg.src = td.head   || '';
  }

  // ---------- Построение пути (Catmull-Rom) ----------
  function _getPlatformPos(key) {
    if (!key && key !== 0) return null;
    return (typeof PLATFORMS !== 'undefined') ? PLATFORMS[key] || PLATFORMS[String(key)] : null;
  }

  function _buildPath(id, routeIdx) {
    const lp    = (typeof LAIRS_POS !== 'undefined') ? LAIRS_POS[id] : null;
    if (!lp) return [];
    const route = _routes(id, state[id].cycleCount)[routeIdx];
    const pts   = [{ x: lp.x, y: lp.y }];
    for (const key of route) {
      const p = _getPlatformPos(key);
      if (p) pts.push({ x: p.x, y: p.y });
    }
    return pts;
  }

  function _sampleCR(p0, p1, p2, p3) {
    const alpha = 0.5;
    function td(a, b) {
      return Math.pow((b.x-a.x)**2+(b.y-a.y)**2, alpha/2) || 0.0001;
    }
    const t0=0, t1=t0+td(p0,p1), t2=t1+td(p1,p2), t3=t2+td(p2,p3);
    function pt(tv) {
      const a1x=(t1-tv)/(t1-t0)*p0.x+(tv-t0)/(t1-t0)*p1.x;
      const a1y=(t1-tv)/(t1-t0)*p0.y+(tv-t0)/(t1-t0)*p1.y;
      const a2x=(t2-tv)/(t2-t1)*p1.x+(tv-t1)/(t2-t1)*p2.x;
      const a2y=(t2-tv)/(t2-t1)*p1.y+(tv-t1)/(t2-t1)*p2.y;
      const a3x=(t3-tv)/(t3-t2)*p2.x+(tv-t2)/(t3-t2)*p3.x;
      const a3y=(t3-tv)/(t3-t2)*p2.y+(tv-t2)/(t3-t2)*p3.y;
      const b1x=(t2-tv)/(t2-t0)*a1x+(tv-t0)/(t2-t0)*a2x;
      const b1y=(t2-tv)/(t2-t0)*a1y+(tv-t0)/(t2-t0)*a2y;
      const b2x=(t3-tv)/(t3-t1)*a2x+(tv-t1)/(t3-t1)*a3x;
      const b2y=(t3-tv)/(t3-t1)*a2y+(tv-t1)/(t3-t1)*a3y;
      return {
        x:(t2-tv)/(t2-t1)*b1x+(tv-t1)/(t2-t1)*b2x,
        y:(t2-tv)/(t2-t1)*b1y+(tv-t1)/(t2-t1)*b2y,
      };
    }
    const N=30; const res=[{x:p1.x,y:p1.y}];
    let arcLen=0, prev=pt(t1), target=SEG_SPACING;
    for (let i=1;i<=N;i++) {
      const tv=t1+(t2-t1)*i/N;
      const cur=pt(tv);
      arcLen+=Math.hypot(cur.x-prev.x,cur.y-prev.y);
      if (arcLen>=target) { res.push({x:cur.x,y:cur.y}); target+=SEG_SPACING; }
      prev=cur;
    }
    const last=res[res.length-1];
    if (Math.hypot(last.x-p2.x,last.y-p2.y)>1) res.push({x:p2.x,y:p2.y});
    return res;
  }

  function _precomputePath(id, routeIdx) {
    const pts = _buildPath(id, routeIdx);
    if (pts.length < 2) return [];
    if (pts.length === 2) {
      const res=[], dx=pts[1].x-pts[0].x, dy=pts[1].y-pts[0].y;
      const len=Math.hypot(dx,dy);
      for (let d=0;d<=len+0.01;d+=SEG_SPACING)
        res.push({x:pts[0].x+dx*Math.min(d/len,1),y:pts[0].y+dy*Math.min(d/len,1)});
      if (Math.hypot(res[res.length-1].x-pts[1].x,res[res.length-1].y-pts[1].y)>1)
        res.push({x:pts[1].x,y:pts[1].y});
      return res;
    }
    const f=pts[0],l=pts[pts.length-1];
    const ph0={x:f.x-(pts[1].x-f.x),y:f.y-(pts[1].y-f.y)};
    const phN={x:l.x+(l.x-pts[pts.length-2].x),y:l.y+(l.y-pts[pts.length-2].y)};
    const full=[ph0,...pts,phN];
    const result=[];
    for (let i=1;i<full.length-2;i++) {
      const seg=_sampleCR(full[i-1],full[i],full[i+1],full[i+2]);
      if (i===1) result.push(...seg); else result.push(...seg.slice(1));
    }
    return result;
  }

  // ---------- ПРАВИЛО 2: платформа свободна? ----------
  function _isPlatformFree(id, routeIdx) {
    const myRoute  = _routes(id, state[id].cycleCount)[routeIdx];
    const myPlats  = new Set(myRoute.map(String));
    for (const otherId of ALL_IDS) {
      if (otherId === id) continue;
      const other = state[otherId];
      // Проверяем out, hold И in (при втягивании тело ещё занимает платформы)
      if (other.phase !== 'out' && other.phase !== 'hold' && other.phase !== 'in') continue;
      const otherRoute = _routes(otherId, other.cycleCount)[other.routeIdx];
      if (!otherRoute) continue;
      for (const key of otherRoute) {
        if (myPlats.has(String(key))) return false;
      }
    }
    return true;
  }

  // ---------- Инициализация ----------
  function init() {
    _loadSprites();
    sessionTime    = -INITIAL_DELAY * 1000;
    cycleStartTime = 0;
    for (const id of ALL_IDS) {
      Object.assign(state[id], {
        routeIdx: 0, phase: 'idle', timer: 0,
        trail: [], pathPts: [], headIdx: 0, tailIdx: 0,
        started: false, totalRoutesCompleted: 0, cycleCount: 0,
      });
    }
    _calcStartTimes();
  }

  function _startFirstSlot() { _started = true; }

  // ---------- UPDATE ----------
  function update(dt) {
    if (!_started) return;
    sessionTime += dt * 1000;

    // Пересчитать активных червей при изменении прогрессии
    _calcStartTimes();

    const speed = _effectiveSpeed();
    const hold  = _effectiveHold();
    const pause = _effectivePause();

    for (const id of ALL_IDS) {
      const s = state[id];
      if (!(id in startTimes)) continue;
      if (sessionTime < startTimes[id]) continue;

      if (!s.started) {
        s.started = true;
        s.phase   = 'pause';
        s.timer   = pause;
        s.trail   = [];
      }

      if (s.phase === 'pause') {
        s.timer -= dt;
        s.trail  = [];
        if (s.timer <= 0) {
          if (!_isPlatformFree(id, s.routeIdx)) {
            s.timer = 0.3;
            continue;
          }
          s.phase   = 'out';
          s.pathPts = _precomputePath(id, s.routeIdx);
          s.headIdx = 0;
          s.tailIdx = 0;
          s.trail   = [];
        }
        continue;
      }

      if (s.phase === 'out') {
        const maxIdx = s.pathPts.length - 1;
        s.headIdx += speed * dt / SEG_SPACING;
        if (s.headIdx >= maxIdx) s.headIdx = maxIdx;
        s.trail = s.pathPts.slice(0, Math.floor(s.headIdx) + 1).reverse();
        if (s.headIdx >= maxIdx) {
          s.trail = s.pathPts.slice().reverse();
          s.phase = 'hold';
          s.timer = hold;
        }
        continue;
      }

      if (s.phase === 'hold') {
        s.timer -= dt;
        if (s.timer <= 0) { s.phase = 'in'; s.tailIdx = 0; }
        continue;
      }

      if (s.phase === 'in') {
        const maxIdx = s.pathPts.length - 1;
        s.tailIdx += speed * dt / SEG_SPACING;
        if (s.tailIdx > maxIdx) s.tailIdx = maxIdx;
        const headPos = Math.max(0, maxIdx - Math.floor(s.tailIdx));
        s.trail = headPos > 0 ? s.pathPts.slice(0, headPos + 1).reverse() : [];
        if (headPos <= 0) {
          s.trail    = [];
          s.phase    = 'pause';
          s.timer    = pause;
          const totalRoutes = _routes(id, s.cycleCount).length;
          s.routeIdx = (s.routeIdx + 1) % totalRoutes;
          s.totalRoutesCompleted++;
          // Закончил полный набор — переключить цикл (чётный/нечётный)
          if (s.routeIdx === 0) s.cycleCount++;
        }
        continue;
      }
    }
  }

  // ---------- DRAW ----------
  function draw(ctx) {
    const segOk = _segImg  && _segImg.complete  && _segImg.naturalWidth  > 0;
    const hOk   = _headImg && _headImg.complete && _headImg.naturalWidth > 0;
    const SS = SEG_SIZE;

    function catPt(p0,p1,p2,p3,t) {
      const t2=t*t,t3=t2*t;
      return {
        x:0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y:0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      };
    }

    function smooth(trail) {
      if (trail.length < 2) return trail;
      const out=[]; const S=6;
      for (let i=0;i<trail.length-1;i++) {
        const p0=trail[Math.max(0,i-1)],p1=trail[i];
        const p2=trail[i+1],p3=trail[Math.min(trail.length-1,i+2)];
        for (let s=0;s<S;s++) out.push(catPt(p0,p1,p2,p3,s/S));
      }
      out.push(trail[trail.length-1]);
      return out;
    }

    // Проход 1: тела
    for (const id of ALL_IDS) {
      const s = state[id];
      if (!s.trail || s.trail.length < 2) continue;
      const sm = smooth(s.trail);
      for (let i=sm.length-2;i>=0;i--) {
        const angle=Math.atan2(sm[i].y-sm[i+1].y,sm[i].x-sm[i+1].x);
        ctx.save();
        ctx.translate(sm[i].x,sm[i].y);
        ctx.rotate(angle);
        if (segOk) {
          ctx.drawImage(_segImg,-SS*0.55,-SS/2,SS,SS);
        } else {
          ctx.fillStyle=i===0?'#cc2200':'#8b0000';
          ctx.beginPath();
          ctx.ellipse(0,0,SS*0.55,SS*0.45,0,0,Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Проход 2: головы поверх тел
    for (const id of ALL_IDS) {
      const s = state[id];
      if (!s.trail || s.trail.length < 1) continue;
      const head=s.trail[0], neck=s.trail[1]||s.trail[0];
      const angle=Math.atan2(head.y-neck.y,head.x-neck.x);
      const mirror=LAIRS[id].side==='right';
      const HW=58,HH=46;
      ctx.save();
      ctx.translate(head.x,head.y);
      ctx.rotate(angle);
      if (mirror) ctx.scale(1,-1);
      if (hOk) {
        ctx.drawImage(_headImg,-HW/2,-HH/2,HW,HH);
      } else {
        ctx.fillStyle='#ff4400';
        ctx.beginPath();
        ctx.ellipse(0,0,HW/2,HH/2,0,0,Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- Захват и опасные узлы ----------
  function checkCapture() {
    if (typeof Astronaut === 'undefined') return false;
    const astNode = String(Astronaut.getNode());
    for (const id of ALL_IDS) {
      const s = state[id];
      // Только hold: червь физически стоит на платформе
      if (s.phase !== 'hold') continue;
      const route = _routes(id, s.cycleCount)[s.routeIdx];
      if (!route) continue;
      for (const key of route) {
        if (String(key) === astNode) return true;
      }
    }
    return false;
  }

  function getDangerNodes() {
    const nodes = new Set();
    for (const id of ALL_IDS) {
      const s = state[id];
      if (s.phase !== 'hold' && s.phase !== 'out') continue;
      const route = _routes(id, s.cycleCount)[s.routeIdx];
      if (route) for (const key of route) nodes.add(String(key));
    }
    return nodes;
  }

  function getRenderData() {
    return ALL_IDS.map(id => ({
      lairId: id,
      phase: state[id].phase,
      routeIdx: state[id].routeIdx,
      cycleCount: state[id].cycleCount,
      trail: state[id].trail,
    }));
  }

  return { init, update, draw, checkCapture, getDangerNodes, getRenderData, LAIRS, _startFirstSlot };
})();


