// -------------------- Core State --------------------

let height = 0;
let StrengthGained = 0;

let pushPower = 1;
let pushLevel = 0;

let pushPerSecond = 0;
let autoLevel = 0;

let powerCost = 10;
let autoCost = 25;

let gravity = 5.0;

const BOTTOM_EPS = 0.01;
const VISUAL_MAX_HEIGHT = 100;

// -------------------- Endurance --------------------

let enduranceMax = 10;
let enduranceCurrent = 10;
let enduranceLevel = 0;
let enduranceCost = 100;

// -------------------- Spite --------------------

let spiteBought = false;
let spiteActive = false;
let spiteUsedSinceBottom = false;

const spiteBonus = 5;
const spiteDuration = 5000;

// -------------------- UI Update --------------------

function updateUI() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('height', height.toFixed(1));
  set('StrengthGained', StrengthGained.toFixed(1));
  set('pushPower', pushPower.toFixed(1));
  set('pushLevel', pushLevel);
  set('pushPerSecond', pushPerSecond.toFixed(1));
  set('autoLevel', autoLevel);
  set('powerCost', Math.round(powerCost));
  set('autoCost', Math.round(autoCost));
  set('enduranceCurrent', Math.floor(enduranceCurrent));
  set('enduranceMax', Math.floor(enduranceMax));
  set('enduranceCost', Math.round(enduranceCost));

  // -------------------- Visual Positioning --------------------

  const stage = document.querySelector('.stage');
  const ground = document.querySelector('.ground');
  const boulder = document.getElementById('boulder');
  const man = document.getElementById('man');

  if (!stage || !ground || !boulder) return;

  const stageW = stage.clientWidth;
  const bSize = boulder.clientHeight || 56;

  const normalized = Math.max(0, Math.min(1, height / VISUAL_MAX_HEIGHT));

  const leftStart = stageW * 0.15;
  const rightEnd = stageW * 0.85;
  const centerX = leftStart + normalized * (rightEnd - leftStart);

  const root = getComputedStyle(document.documentElement);
  const leftRise = parseFloat(root.getPropertyValue('--ramp-left-rise')) || 28;
  const rightRise = parseFloat(root.getPropertyValue('--ramp-right-rise')) || 180;

  const frac = centerX / Math.max(1, stageW);
  const rampTop = leftRise + frac * (rightRise - leftRise);

  boulder.style.left = centerX + 'px';
  boulder.style.bottom = rampTop + 'px';

  if (man) {
    const mW = man.clientWidth || 64;
    let manLeft = centerX - bSize / 2 - mW + 6;
    manLeft = Math.max(0, Math.min(stageW - mW, manLeft));

    man.style.left = manLeft + 'px';
    man.style.bottom = Math.max(0, rampTop - 6) + 'px';
  }
}

// -------------------- Save / Load --------------------

function saveGame() {
  try {
    localStorage.setItem(
      'sisyphus_save',
      JSON.stringify({
        height,
        StrengthGained,
        pushPower,
        pushLevel,
        pushPerSecond,
        autoLevel,
        powerCost,
        autoCost,
        enduranceMax,
        enduranceCurrent,
        enduranceLevel,
        enduranceCost,
        spiteBought
      })
    );
  } catch {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem('sisyphus_save');
    if (!raw) return;

    const s = JSON.parse(raw);
    Object.assign(window, s);
  } catch {}
}

// -------------------- Input --------------------

document.getElementById('pushButton')?.addEventListener('click', () => {
  if (enduranceCurrent < 1) return;

  enduranceCurrent -= 1;
  height += pushPower;
  StrengthGained += pushPower;

  const m = document.getElementById('man');
  if (m) {
    m.classList.add('pushing');
    setTimeout(() => m.classList.remove('pushing'), 140);
  }

  updateUI();
  saveGame();
});

document.getElementById('upgradePower')?.addEventListener('click', () => {
  if (height <= BOTTOM_EPS && StrengthGained >= powerCost) {
    StrengthGained -= powerCost;
    pushPower += 1;
    pushLevel += 1;
    powerCost *= 2;
    updateUI();
    saveGame();
  }
});

document.getElementById('buyAuto')?.addEventListener('click', () => {
  if (height <= BOTTOM_EPS && StrengthGained >= autoCost) {
    StrengthGained -= autoCost;
    pushPerSecond += 0.2;
    autoLevel += 1;
    autoCost = Math.ceil(autoCost * 2.5);
    updateUI();
    saveGame();
  }
});

document.getElementById('upgradeEndurance')?.addEventListener('click', () => {
  if (height <= BOTTOM_EPS && StrengthGained >= enduranceCost) {
    StrengthGained -= enduranceCost;
    enduranceLevel += 1;
    enduranceMax += 2;
    enduranceCurrent = enduranceMax;
    enduranceCost = Math.ceil(enduranceCost * 2.5);
    updateUI();
    saveGame();
  }
});

// -------------------- Main Loop --------------------

setInterval(() => {
  const delta = pushPerSecond / 10;
  height += delta;
  StrengthGained += delta;

  const normalized = Math.min(1, height / VISUAL_MAX_HEIGHT);
  const fallSpeed = gravity + Math.pow(normalized, 2) * 60;

  height -= fallSpeed / 10;

  if (height <= BOTTOM_EPS) {
    height = 0;
    enduranceCurrent = Math.min(enduranceMax, enduranceCurrent + 0.2);
    spiteUsedSinceBottom = false;
  }

  updateUI();
}, 100);

// -------------------- Init --------------------

loadGame();
updateUI();
window.addEventListener('beforeunload', saveGame);
