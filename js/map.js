// ===== map.js =====
const PLATFORMS = {
  shuttle:   { x: 240, y: 84 },
  1:         { x: 240, y: 221 },
  2:         { x: 133, y: 258 },
  3:         { x: 347, y: 258 },
  5:         { x: 240, y: 301 },
  4:         { x: 133, y: 343 },
  6:         { x: 347, y: 343 },
  8:         { x: 240, y: 391 },
  7:         { x: 133, y: 438 },
  9:         { x: 347, y: 438 },
  11:        { x: 240, y: 487 },
  10:        { x: 133, y: 535 },
  12:        { x: 347, y: 535 },
  13:        { x: 240, y: 583 },
};
// Логова — зафиксированы по финальному фону художника (замерены по пикселям, это точки контроля,
// от которых строится сетка платформ выше; НЕ пересчитывать от платформ)
const LAIRS_POS = {
  T1: { x: 55,  y: 321 },
  T2: { x: 425, y: 321 },
  T3: { x: 55,  y: 415 },
  T4: { x: 425, y: 415 },
  T5: { x: 55,  y: 512 },
  T6: { x: 425, y: 512 },
};

const PLATFORM_RADIUS    = 25;
const PLATFORM_13_RADIUS = 25;

// Все платформы, которые щупальцы могут атаковать
const PLAYFIELD_NODES = [1,2,3,4,5,6,7,8,9,10,11,12,13];

// Граф навигации — прямые маршруты, нет diagonal
const NAV = {
  shuttle: { up: null,      down: 1,    left: null, right: null },
  1:       { up: 'shuttle', down: 5,    left: 2,    right: 3   },
  2:       { up: 1,         down: 4,    left: null, right: 5   },
  3:       { up: 1,         down: 6,    left: 5,    right: null },
  5:       { up: 1,         down: 8,    left: 4,    right: 6   },
  4:       { up: 2,         down: 7,    left: null, right: 8   },
  6:       { up: 3,         down: 9,    left: 8,    right: null },
  8:       { up: 5,         down: 11,   left: 7,    right: 9   },
  7:       { up: 4,         down: 10,   left: null, right: 11  },
  9:       { up: 6,         down: 12,   left: 11,   right: null },
  11:      { up: 8,         down: 13,   left: 10,   right: 12  },
  10:      { up: 7,         down: 13,   left: null, right: 11  },
  12:      { up: 9,         down: 13,   left: 11,   right: null },
  13:      { up: 11,        down: null, left: null, right: null },
};

// Нет диагональных переходов
const DIAGONAL_TARGETS = {};

// Геттеры
function getPos(nodeKey) {
  return PLATFORMS[nodeKey];
}

function getNavTargets(nodeKey) {
  return NAV[nodeKey] || null;
}


