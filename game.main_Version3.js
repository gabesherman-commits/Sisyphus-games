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

// -------------------- Spite --------------------

let spiteBought = false;
let spiteCost = 500;
let spiteActive = false;
let spiteUsedSinceBottom = false;

const spiteBonus = 5;
const spiteDuration = 5000;

let peakHeight = 0;

// -------------------- Endurance --------------------

let enduranceMax = 10;
let enduranceCurrent = 10;
let enduranceLevel = 0;
let enduranceCost = 100;

let enduranceRegenLevel = 0;
let enduranceRegenCost = 150;

// -------------------- UI --------------------

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
  set('spiteCost', Math.round(spiteCost));
  set('enduranceCurrent', Math.floor(enduranceCurrent));
  set('enduranceMax', Math.floor(enduranceMax));
  set('enduranceCost', Math.round(enduranceCost));
  set('regenCost', Math.round(enduranceRegenCost));

  const enduranceBar = document.querySelector('.endurance .fill');
  if (enduranceBar) {
    enduranceBar.style.width =
      Math.max(0, Math.min(1, enduranceCurrent / enduranceMax)) * 100 + '%';
  }

  const atBottom = height <= BOTTOM_EPS;

  const disable = (id, state) => {
    const el = document.getElementById(id);
    if (el) el.disabled = state;
  };

  disable('upgradePower', !atBottom);
  disable('buyAuto', !atBottom);
  disable('upgradeEndurance', !(atBottom && StrengthGained >= enduranceCost));
  disable('upgradeRegen', !(atBottom && StrengthGained >= enduranceRegenCost));
  disable('pushButton', enduranceCurrent < 1);

  const spiteBtn = document.getElementById('buySpite');
  if (spiteBtn) {
    if (spiteBought) {
      spiteBtn.disabled = true;
      spiteBtn.textContent = spiteActive
        ? 'Spite (Active)'
        : spiteUsedSinceBottom
        ? 'Spite (Used)'
        : 'Spite (Ready)';
    } else {
      spiteBtn.disabled = !atBottom || StrengthGained < spiteCost;
      spiteBtn.textContent = `Spite (Cost: ${Math.round(spiteCost)})`;
    }
  }

  // -------------------- Visuals --------------------

  const stage = document.querySelector('.stage');
  const boulder = document.getElementById('boulder');
  const man = document.getElementById('man');

  if (!stage || !boulder) return;

  const stageW = stage.clientWidth;
  const bH = boulder.clientHeight || 56;

  const normalized = Math.min(1, Math.max(0, height / VISUAL_MAX_HEIGHT));
  const leftStart = stageW * 0.15;
  const rightEnd = stageW * 0.85;
  const centerX = leftStart + normalized * (rightEnd - leftStart);

  const root = getComputedStyle(document.documentElement);
  const leftRise = parseFloat(root.getPropertyValue('--ramp-left-rise')) || 0;
  const rightRise = parseFloat(root.getPropertyValue('--ramp-right-rise')) || 0;

  const frac = centerX / Math.max(1, stageW);
  const rampTop = leftRise + frac * (rightRise - leftRise);

  boulder.style.left = centerX + 'px';
  boulder.style.bottom = rampTop + 'px';

  if (man) {
    const mW = man.clientWidth || 64;
    const manLeft = Math.max(0, centerX - bH / 2 - mW + 6);
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
        spiteBought,
        spiteCost,
        spiteUsedSinceBottom,
        enduranceMax,
        enduranceCurrent,
        enduranceLevel,
        enduranceCost,
        enduranceRegenLevel,
        enduranceRegenCost,
      })
    );
  } catch {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem('sisyphus_save');
    if (!raw) return;
    Object.assign(window, JSON.parse(raw));
  } catch {}
}

// -------------------- Input --------------------

document.getElementById('pushButton')?.addEventListener('click', () => {
  if (enduranceCurrent < 1) return;

  enduranceCurrent--;
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
    pushPower++;
    pushLevel++;
    powerCost *= 2;
    updateUI();
    saveGame();
  }
});

document.getElementById('buyAuto')?.addEventListener('click', () => {
  if (height <= BOTTOM_EPS && StrengthGained >= autoCost) {
    StrengthGained -= autoCost;
    pushPerSecond += 0.2;
    autoLevel++;
    autoCost = Math.ceil(autoCost * 2.5);
    updateUI();
    saveGame();
  }
});

document.getElementById('upgradeEndurance')?.addEventListener('click', () => {
  if (height <= BOTTOM_EPS && StrengthGained >= enduranceCost) {
    StrengthGained -= enduranceCost;
    enduranceLevel++;
    enduranceMax += 2;
    enduranceCurrent = enduranceMax;
    enduranceCost = Math.ceil(enduranceCost * 2.5);
    updateUI();
    saveGame();
  }
});

document.getElementById('buySpite')?.addEventListener('click', () => {
  if (height <= BOTTOM_EPS && StrengthGained >= spiteCost && !spiteBought) {
    StrengthGained -= spiteCost;
    spiteBought = true;
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
    spiteUsedSinceBottom = false;
    enduranceCurrent = Math.min(
      enduranceMax,
      enduranceCurrent + (1 + enduranceLevel * 0.5) / 10
    );
  }

  if (
    spiteBought &&
    !spiteActive &&
    !spiteUsedSinceBottom &&
    peakHeight - height >= 20
  ) {
    spiteActive = true;
    spiteUsedSinceBottom = true;
    pushPower += spiteBonus;

    setTimeout(() => {
      pushPower -= spiteBonus;
      spiteActive = false;
    }, spiteDuration);
  }

  peakHeight = Math.max(peakHeight, height);
  height = Math.max(0, Math.min(height, VISUAL_MAX_HEIGHT * 0.999));

  updateUI();
}, 100);

// -------------------- Init --------------------

loadGame();
updateUI();
window.addEventListener('beforeunload', saveGame);

