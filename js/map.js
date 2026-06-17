// ============================================================
// map.js — координаты платформ и граф навигации
// Канвас 480×854, игровая зона y=110..706
// Равномерный шаг между уровнями
// ============================================================

// Все платформы: x симметрично (левая=136, центр=240, правая=344)
// y равномерно: шаттл=130, далее шаг ~62px на 8 уровней до y=669
const PLATFORMS = {
  shuttle: { x: 240, y: 130 },
  1:       { x: 240, y: 209 },
  2:       { x: 136, y: 271 },
  3:       { x: 344, y: 271 },
  5:       { x: 240, y: 333 },
  4:       { x: 136, y: 395 },
  6:       { x: 344, y: 395 },
  8:       { x: 240, y: 457 },
  7:       { x: 136, y: 513 },
  9:       { x: 344, y: 513 },
  11:      { x: 240, y: 565 },
  10:      { x: 136, y: 617 },
  12:      { x: 344, y: 617 },
  13:      { x: 240, y: 669 },
};

// Логова — по краям, выровнены по уровням платформ
const LAIRS_POS = {
  T1: { x: 20,  y: 333 },   // между 2/3 и 4/6
  T2: { x: 460, y: 333 },
  T3: { x: 20,  y: 454 },   // между 4/6 и 7/9
  T4: { x: 460, y: 454 },
  T5: { x: 20,  y: 565 },   // между 7/9 и 10/12
  T6: { x: 460, y: 565 },
};

const PLATFORM_RADIUS    = 32;
const PLATFORM_13_RADIUS = 41;

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
