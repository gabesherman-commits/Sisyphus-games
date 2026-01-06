let height = 0;
let StrengthGained = 0;
let pushPower = 1;
let pushLevel = 0;
let pushPerSecond = 0;
let autoLevel = 0;
let powerCost = 10;
let autoCost = 25;
let spiteBought = false;
let spiteCost = 500;
let spiteActive = false;
let spiteUsedSinceBottom = false;
const spiteBonus = 5; // added pushPower while active
const spiteDuration = 5000; // ms
let peakHeight = 0;
// Endurance: determines how many manual pushes you can do before resting
let enduranceMax = 10;
let enduranceCurrent = 10;
let enduranceLevel = 0;
let enduranceCost = 100;
let enduranceRegenLevel = 0;
let enduranceRegenCost = 150;
const enduranceRegenBonus = 0.8; // added regen /s per regen level
let gravity = 5.0; // units per second pulled down by gravity (reduced for balance)
const BOTTOM_EPS = 0.01; // consider at bottom when height <= this
const VISUAL_MAX_HEIGHT = 100; // game units that map to top of visual stage

// Leaderboard & player state (local-only fallback)
// To use a global leaderboard, set LEADERBOARD_API_URL to your server's base URL (CORS must be enabled).
// Expected API:
// GET  {url}/top?limit=10        -> [{ name, score, date }, ...]
// POST {url}/submit             -> accepts { name, score } and returns { ok: true, top: [...] }
const LEADERBOARD_API_URL = null; // e.g. 'https://sisyphus.example.com/api/leaderboard'
let username = 'Player';
let highHeight = 0; // player's lifetime best height (changed from best StrengthGained)
let leaderboard = []; // array of { name, score, date }
const LEADERBOARD_KEY = 'sisyphus_leaderboard';
const PLAYER_KEY = 'sisyphus_player';
const LEADERBOARD_MAX = 10;

// Autoclicker detector state
let clickTimestamps = []; // recent manual push timestamps (ms)
const CLICK_WINDOW_MS = 3000; // track clicks in this rolling window
const CLICK_HISTORY_MAX = 20; // keep at most this many timestamps
let autoclickDetected = false;
const AUTOCLICK_COOLDOWN_MS = 5000; // how long to disable push after detection
const AUTOCLICK_PENALTY_PERCENT = 0.05; // remove this fraction of StrengthGained as penalty
const AUTOCLICK_MESSAGE = 'Autoclicker detected â€” cooldown applied';

function updateUI() {
  const elHeight = document.getElementById('height');
  const elTotal = document.getElementById('StrengthGained');
  const elPush = document.getElementById('pushPower');
  const elPushLevel = document.getElementById('pushLevel');
  const elAuto = document.getElementById('pushPerSecond');
  const elAutoLevel = document.getElementById('autoLevel');
  const elPowerCost = document.getElementById('powerCost');
  const elAutoCost = document.getElementById('autoCost');
  const elSpiteCost = document.getElementById('spiteCost');
  const buySpiteBtn = document.getElementById('buySpite');
  const elEndCur = document.getElementById('enduranceCurrent');
  const elEndMax = document.getElementById('enduranceMax');
  const elEndCost = document.getElementById('enduranceCost');
  const upgradeEnduranceBtn = document.getElementById('upgradeEndurance');
  const enduranceBar = document.querySelector('.endurance .fill');
  const elRegenCost = document.getElementById('regenCost');
  const upgradeRegenBtn = document.getElementById('upgradeRegen');

  if (elHeight) elHeight.textContent = height.toFixed(1);
  if (elTotal) elTotal.textContent = StrengthGained.toFixed(1);
  if (elPush) elPush.textContent = pushPower.toFixed(1);
  if (elPushLevel) elPushLevel.textContent = pushLevel;
  if (elAuto) elAuto.textContent = pushPerSecond.toFixed(1);
  if (elAutoLevel) elAutoLevel.textContent = autoLevel;
  if (elPowerCost) elPowerCost.textContent = Math.max(1, Math.round(powerCost));
  if (elAutoCost) elAutoCost.textContent = Math.max(1, Math.round(autoCost));
  if (elSpiteCost) elSpiteCost.textContent = Math.max(1, Math.round(spiteCost));
  if (elEndCur) elEndCur.textContent = Math.floor(enduranceCurrent);
  if (elEndMax) elEndMax.textContent = Math.floor(enduranceMax);
  if (elEndCost) elEndCost.textContent = Math.max(1, Math.round(enduranceCost));
  if (enduranceBar) {
    const pct = Math.max(0, Math.min(1, enduranceCurrent / Math.max(1, enduranceMax)));
    enduranceBar.style.width = (pct * 100) + '%';
  }
  if (elRegenCost) elRegenCost.textContent = Math.max(1, Math.round(enduranceRegenCost));

  const atBottom = height <= BOTTOM_EPS;
  const upgradePowerBtn = document.getElementById('upgradePower');
  const buyAutoBtn = document.getElementById('buyAuto');
  const spiteBtn = document.getElementById('buySpite');
  if (upgradePowerBtn) upgradePowerBtn.disabled = !atBottom;
  if (buyAutoBtn) buyAutoBtn.disabled = !atBottom;
  if (spiteBtn) {
    if (spiteBought) {
      spiteBtn.disabled = true;
      if (spiteActive) spiteBtn.textContent = 'Spite (Active)';
      else if (spiteUsedSinceBottom) spiteBtn.textContent = 'Spite (Used)';
      else spiteBtn.textContent = 'Spite (Ready)';
    } else {
      // allow buying Spite as soon as the player has the funds (no bottom-only restriction)
      spiteBtn.disabled = (typeof StrengthGained === 'number' && StrengthGained < spiteCost);
      spiteBtn.innerHTML = 'Spite (Cost: <span id="spiteCost">' + Math.max(1, Math.round(spiteCost)) + '</span>)';
    }
  }

  // push button should be disabled when no endurance remains or autoclick cooldown
  const pushBtn = document.getElementById('pushButton');
  if (pushBtn) pushBtn.disabled = (enduranceCurrent < 1) || autoclickDetected;
  if (upgradeEnduranceBtn) upgradeEnduranceBtn.disabled = !(atBottom && StrengthGained >= enduranceCost);
  if (upgradeRegenBtn) upgradeRegenBtn.disabled = !(atBottom && StrengthGained >= enduranceRegenCost);
  
  // Update visual boulder/man position so the path follows the CSS ramp
  const b = document.getElementById('boulder');
  const stage = document.querySelector('.stage');
  const ground = document.querySelector('.ground');
  if (b && stage && ground) {
    const bH = b.clientHeight || 56;
    const normalized = Math.min(1, Math.max(0, height / VISUAL_MAX_HEIGHT));

    // horizontal position along a working track area
    const stageW = stage.clientWidth;
    const leftStart = stageW * 0.15;
    const rightEnd = stageW * 0.85;
    const centerX = leftStart + normalized * (rightEnd - leftStart);
    b.style.left = centerX + 'px';

    // read ramp rise values from CSS variables (in px) and interpolate at centerX
    const rootStyle = getComputedStyle(document.documentElement);
    const leftRise = parseFloat(rootStyle.getPropertyValue('--ramp-left-rise')) || 0;
    const rightRise = parseFloat(rootStyle.getPropertyValue('--ramp-right-rise')) || 0;
    const frac = centerX / Math.max(1, stageW);
    const rampTop = leftRise + frac * (rightRise - leftRise);

    // place boulder so its bottom sits on the ramp surface
    b.style.bottom = rampTop + 'px';

    // position man (if present) slightly behind the boulder on the ramp
    const m = document.getElementById('man');
    if (m) {
      const mW = m.clientWidth || 64;
      const manLeft = centerX - (bH / 2) - mW + 6;
      const manBottom = Math.max(0, rampTop - 6);
      m.style.left = manLeft + 'px';
      m.style.bottom = manBottom + 'px';
    }

    if (normalized > 0.6) stage.classList.add('high'); else stage.classList.remove('high');
  }
}

function saveGame() {
  const data = { height, StrengthGained, pushPower, pushLevel, pushPerSecond, autoLevel, powerCost, autoCost };
  // persist spite purchase state
  data.spiteBought = spiteBought;
  data.spiteCost = spiteCost;
  data.spiteUsedSinceBottom = spiteUsedSinceBottom;
  // endurance
  data.enduranceMax = enduranceMax;
  data.enduranceCurrent = enduranceCurrent;
  data.enduranceLevel = enduranceLevel;
  data.enduranceCost = enduranceCost;
  // endurance regen upgrade
  data.enduranceRegenLevel = enduranceRegenLevel;
  data.enduranceRegenCost = enduranceRegenCost;
  try {
    localStorage.setItem('sisyphus_save', JSON.stringify(data));
    const el = document.getElementById('saveStatus');
    if (el) { el.textContent = 'Saved'; setTimeout(() => el.textContent = '', 900); }
  } catch (e) {
    // ignore storage errors
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('sisyphus_save');
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj.height === 'number') height = obj.height;
      if (typeof obj.StrengthGained === 'number') StrengthGained = obj.StrengthGained;
      if (typeof obj.pushPower === 'number') pushPower = obj.pushPower;
      if (typeof obj.pushLevel === 'number') pushLevel = obj.pushLevel;
      if (typeof obj.pushPerSecond === 'number') pushPerSecond = obj.pushPerSecond;
      if (typeof obj.autoLevel === 'number') autoLevel = obj.autoLevel;
      if (typeof obj.powerCost === 'number') powerCost = obj.powerCost;
      if (typeof obj.autoCost === 'number') autoCost = obj.autoCost;
      if (typeof obj.spiteBought === 'boolean') spiteBought = obj.spiteBought;
      if (typeof obj.spiteCost === 'number') spiteCost = obj.spiteCost;
      if (typeof obj.spiteUsedSinceBottom === 'boolean') spiteUsedSinceBottom = obj.spiteUsedSinceBottom;
      if (typeof obj.enduranceRegenLevel === 'number') enduranceRegenLevel = obj.enduranceRegenLevel;
      if (typeof obj.enduranceRegenCost === 'number') enduranceRegenCost = obj.enduranceRegenCost;
      if (typeof obj.enduranceMax === 'number') enduranceMax = obj.enduranceMax;
      if (typeof obj.enduranceCurrent === 'number') enduranceCurrent = obj.enduranceCurrent;
      if (typeof obj.enduranceLevel === 'number') enduranceLevel = obj.enduranceLevel;
      if (typeof obj.enduranceCost === 'number') enduranceCost = obj.enduranceCost;
    }
  } catch (e) {}
  updateUI();
  peakHeight = height;
}

function resetGame() {
  if (!confirm('Reset game? This will erase your progress.')) return;
  height = 0;
  StrengthGained = 0;
  pushPower = 1;
  pushLevel = 0;
  pushPerSecond = 0;
  autoLevel = 0;
  powerCost = 10;
  autoCost = 25;
  spiteBought = false;
  spiteCost = 500;
  spiteActive = false;
  peakHeight = 0;
  // reset endurance
  enduranceMax = 10;
  enduranceCurrent = 10;
  enduranceLevel = 0;
  enduranceCost = 100;
  enduranceRegenLevel = 0;
  enduranceRegenCost = 150;
  try { localStorage.removeItem('sisyphus_save'); } catch (e) {}
  updateUI();
  const el = document.getElementById('saveStatus');
  if (el) { el.textContent = 'Reset'; setTimeout(() => el.textContent = '', 1000); }
}

// click to push
const pushBtn = document.getElementById('pushButton');
if (pushBtn) pushBtn.addEventListener('click', function () {
  // manual push consumes endurance
  if (enduranceCurrent < 1) return;
  enduranceCurrent = Math.max(0, enduranceCurrent - 1);
  height += pushPower;
  StrengthGained += pushPower;
  // small man push animation
  const m = document.getElementById('man');
  if (m) {
    m.classList.add('pushing');
    setTimeout(() => m.classList.remove('pushing'), 140);
  }
  updateUI();
  saveGame();
});

// upgrade push power (spend lifetime `StrengthGained`)
const upgradeBtn = document.getElementById('upgradePower');
if (upgradeBtn) upgradeBtn.addEventListener('click', function () {
  if (height <= BOTTOM_EPS && StrengthGained >= powerCost) {
    StrengthGained -= powerCost;
    pushPower += 1;
    pushLevel += 1;
    powerCost *= 2;
    updateUI();
    saveGame();
  }
});

// buy muscle memory (auto) — spends `StrengthGained`
const buyAutoBtn = document.getElementById('buyAuto');
if (buyAutoBtn) buyAutoBtn.addEventListener('click', function () {
  if (height <= BOTTOM_EPS && StrengthGained >= autoCost) {
    StrengthGained -= autoCost;
    pushPerSecond += 0.2;
    autoLevel += 1;
    autoCost = Math.ceil(autoCost * 2.5);
    updateUI();
    saveGame();
  }
});

// upgrade Endurance (increase max endurance)
const upgradeEnduranceBtn = document.getElementById('upgradeEndurance');
if (upgradeEnduranceBtn) upgradeEnduranceBtn.addEventListener('click', function () {
  if (height <= BOTTOM_EPS && StrengthGained >= enduranceCost) {
    StrengthGained -= enduranceCost;
    enduranceLevel += 1;
    // each level increases max by 2 and improves later regen
    enduranceMax += 2;
    enduranceCurrent = Math.min(enduranceMax, enduranceCurrent + 2);
    enduranceCost = Math.ceil(enduranceCost * 2.5);
    updateUI();
    saveGame();
  }
});

// buy Spite (one-time purchase)
const buySpiteBtn = document.getElementById('buySpite');
if (buySpiteBtn) buySpiteBtn.addEventListener('click', function () {
  // allow purchase whenever the player has enough StrengthGained
  if (StrengthGained >= spiteCost && !spiteBought) {
    StrengthGained -= spiteCost;
    spiteBought = true;
    updateUI();
    saveGame();
  }
});

// reset button
const resetBtn = document.getElementById('resetButton');
if (resetBtn) resetBtn.addEventListener('click', resetGame);

// Main game loop (runs 10 times per second)
setInterval(function () {
  const delta = pushPerSecond / 10;
  height += delta;
  StrengthGained += delta;

  // gravity increases as the boulder gets higher so falling gets faster
  const normalized = Math.min(1, Math.max(0, height / VISUAL_MAX_HEIGHT));
  // make fall speed grow with height (tweak coefficient for balance)
  const extraGravity = Math.pow(normalized, 2) * 60; // stronger ramp as height increases
  const effectiveGravity = gravity + extraGravity;
  height -= effectiveGravity / 10;

  // track peak and detect large falls to trigger Spite
  // if we're back at bottom, clear the 'used' marker so Spite can trigger again
  if (height <= BOTTOM_EPS) {
    spiteUsedSinceBottom = false;
    peakHeight = height;
    // regenerate endurance slowly when at bottom
    const regenPerSecond = 1 + (enduranceLevel * 0.5);
    enduranceCurrent = Math.min(enduranceMax, enduranceCurrent + (regenPerSecond / 10));
  }

  if (height > peakHeight) {
    peakHeight = height;
    // If this session peak exceeds the player's lifetime best, update and submit
    if (peakHeight > highHeight) {
      highHeight = peakHeight;
      savePlayerLocal();
      // best height improved — submit (async, don't await here)
      submitCurrentScore();
      renderLeaderboard();
    }
  } else {
    if (spiteBought && !spiteActive && !spiteUsedSinceBottom && (peakHeight - height) >= 20) {
      // trigger temporary strength boost
      spiteActive = true;
      spiteUsedSinceBottom = true;
      pushPower += spiteBonus;
      // show popup with countdown
      const popup = document.getElementById('spitePopup');
      const timerEl = document.getElementById('spiteTimer');
      if (popup && timerEl) {
        let remaining = Math.ceil(spiteDuration / 1000);
        timerEl.textContent = remaining;
        popup.classList.add('show');
        const tick = setInterval(() => {
          remaining -= 1;
          timerEl.textContent = Math.max(0, remaining);
        }, 1000);
        setTimeout(() => {
          clearInterval(tick);
          popup.classList.remove('show');
        }, spiteDuration);
      }
      setTimeout(() => {
        pushPower = Math.max(1, pushPower - spiteBonus);
        spiteActive = false;
      }, spiteDuration);
      // reset peak to avoid immediate retrigger
      peakHeight = height;
    }
  }

  // clamp slightly below the visual max so the boulder can never exactly reach the top
  const MAX_HEIGHT = VISUAL_MAX_HEIGHT * 0.999;
  if (height > MAX_HEIGHT) height = MAX_HEIGHT;
  if (height < 0) height = 0;
  updateUI();
}, 100);

// autosave periodically
setInterval(function () {
  saveGame();
  // also ensure player's lifetime best (highHeight) is updated if current peakHeight exceeds it
  const currentBest = Math.max(highHeight || 0, peakHeight || 0, height || 0);
  if (currentBest > highHeight) {
    highHeight = currentBest;
    savePlayerLocal();
    submitCurrentScore();
    renderLeaderboard();
  }
}, 5000);

loadGame();
loadPlayerLocal();
loadLeaderboard().then(() => renderLeaderboard()).catch(() => renderLeaderboard());
window.addEventListener('beforeunload', saveGame);

// Cheat code detector: typing the sequence H A D E S grants a big reward
let cheatBuffer = '';
const CHEAT_CODE = 'HADES';
window.addEventListener('keydown', function (e) {
  const k = e.key;
  if (!k || typeof k !== 'string') return;
  if (k.length !== 1) return; // ignore non-character keys
  cheatBuffer += k.toUpperCase();
  if (cheatBuffer.length > CHEAT_CODE.length) cheatBuffer = cheatBuffer.slice(-CHEAT_CODE.length);
  if (cheatBuffer === CHEAT_CODE) {
    const reward = 9999;
    StrengthGained += reward;
    updateUI();
    saveGame();
    const el = document.getElementById('saveStatus');
    if (el) { el.textContent = 'Cheat HADES: +' + reward; setTimeout(() => { if (el) el.textContent = ''; }, 2500); }
    cheatBuffer = '';
  }
});

// -------------------- Leaderboard / global integration --------------------

function buildLeaderboardUI() {
  // Create a small fixed panel in the bottom-right if the page doesn't already have a leaderboard container
  let container = document.getElementById('leaderboardContainer');
  if (container) return container;

  container = document.createElement('div');
  container.id = 'leaderboardContainer';
  container.style.position = 'fixed';
  container.style.right = '16px';
  container.style.bottom = '16px';
  container.style.zIndex = 2000;
  container.style.width = '260px';
  container.style.maxHeight = '60vh';
  container.style.overflow = 'auto';
  container.style.padding = '10px';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
  container.style.background = 'rgba(255,255,255,0.95)';
  container.style.fontFamily = 'sans-serif';
  container.style.fontSize = '13px';
  container.style.color = '#111';

  const title = document.createElement('div');
  title.textContent = 'Leaderboard';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';
  container.appendChild(title);

  // player info area
  const playerRow = document.createElement('div');
  playerRow.style.marginBottom = '8px';
  playerRow.innerHTML = `
    <div style="margin-bottom:6px;">
      <input id="leaderNameInput" placeholder="Your name" style="width:140px;padding:6px;border:1px solid #ccc;border-radius:4px;" />
      <button id="leaderSetNameBtn" style="margin-left:6px;padding:6px 8px;border-radius:4px">Set</button>
    </div>
    <div style="font-size:12px;color:#444;">
      Your best height: <span id="playerHighScore">0</span>
      <button id="submitScoreBtn" style="float:right;padding:4px 6px;border-radius:4px">Submit</button>
    </div>
  `;
  container.appendChild(playerRow);

  // server/local mode indicator
  const modeLine = document.createElement('div');
  modeLine.id = 'leaderMode';
  modeLine.style.fontSize = '12px';
  modeLine.style.color = '#666';
  modeLine.style.marginBottom = '6px';
  container.appendChild(modeLine);

  // list area
  const list = document.createElement('div');
  list.id = 'leaderList';
  list.style.marginTop = '8px';
  container.appendChild(list);

  // small footer for status messages
  const status = document.createElement('div');
  status.id = 'leaderStatus';
  status.style.fontSize = '12px';
  status.style.color = '#666';
  status.style.marginTop = '8px';
  container.appendChild(status);

  document.body.appendChild(container);

  // wire up events
  const input = document.getElementById('leaderNameInput');
  const setBtn = document.getElementById('leaderSetNameBtn');
  const submitBtn = document.getElementById('submitScoreBtn');

  if (input) input.value = username || '';

  setBtn.addEventListener('click', function () {
    const val = (input.value || '').trim();
    if (val.length === 0) {
      username = 'Player';
    } else {
      username = val;
    }
    savePlayerLocal(); // store the username locally
    renderLeaderboard();
    const st = document.getElementById('leaderStatus');
    if (st) { st.textContent = 'Name saved'; setTimeout(() => { if (st) st.textContent = ''; }, 1500); }
  });

  submitBtn.addEventListener('click', function () {
    // force submit current best height as a score
    submitCurrentScore();
  });

  return container;
}

function renderLeaderboard() {
  buildLeaderboardUI();
  const list = document.getElementById('leaderList');
  const phs = document.getElementById('playerHighScore');
  const mode = document.getElementById('leaderMode');
  if (phs) phs.textContent = Math.floor(highHeight);
  if (mode) {
    if (LEADERBOARD_API_URL) mode.textContent = 'Using global leaderboard';
    else mode.textContent = 'Local leaderboard (no server configured)';
  }
  if (!list) return;
  // clear
  list.innerHTML = '';

  if (!leaderboard || leaderboard.length === 0) {
    list.innerHTML = '<div style="color:#666">No scores yet</div>';
    return;
  }

  // construct entries
  const ul = document.createElement('ol');
  ul.style.paddingLeft = '18px';
  ul.style.margin = '0';
  ul.style.color = '#111';
  leaderboard.forEach((entry, idx) => {
    const li = document.createElement('li');
    li.style.marginBottom = '6px';
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = Math.floor(entry.score);
    scoreSpan.style.fontWeight = '700';
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    ul.appendChild(li);
  });
  list.appendChild(ul);
}

async function loadLeaderboard() {
  // If a global server is configured, try to fetch top results from there,
  // otherwise restore local leaderboard from localStorage.
  if (LEADERBOARD_API_URL) {
    try {
      const res = await fetch(`${LEADERBOARD_API_URL}/top?limit=${LEADERBOARD_MAX}`, { method: 'GET' });
      if (!res.ok) throw new Error('Server responded with ' + res.status);
      const json = await res.json();
      if (Array.isArray(json)) {
        leaderboard = json.slice(0, LEADERBOARD_MAX).map(e => ({ name: e.name || 'Anon', score: Number(e.score) || 0, date: e.date || null }));
        return;
      } else if (json.top && Array.isArray(json.top)) {
        leaderboard = json.top.slice(0, LEADERBOARD_MAX).map(e => ({ name: e.name || 'Anon', score: Number(e.score) || 0, date: e.date || null }));
        return;
      } else {
        throw new Error('Unexpected server response');
      }
    } catch (err) {
      console.warn('Leaderboard server fetch failed, falling back to local:', err);
      const st = document.getElementById('leaderStatus');
      if (st) st.textContent = 'Server unavailable, showing local scores';
      // fall through to local
    }
  }

  // local fallback
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) {
        leaderboard = obj.slice(0, LEADERBOARD_MAX);
      }
    }
  } catch (e) {
    leaderboard = [];
  }
}

async function submitScoreToServer(name, score) {
  if (!LEADERBOARD_API_URL) throw new Error('No leaderboard server configured');
  const payload = { name: String(name || 'Player'), score: Number(score || 0) };
  const res = await fetch(`${LEADERBOARD_API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Server error: ' + res.status + ' ' + txt);
  }
  const json = await res.json();
  // server may return the updated top list or a simple ack
  if (json && Array.isArray(json.top)) {
    leaderboard = json.top.slice(0, LEADERBOARD_MAX).map(e => ({ name: e.name || 'Anon', score: Number(e.score) || 0, date: e.date || null }));
  } else if (Array.isArray(json)) {
    leaderboard = json.slice(0, LEADERBOARD_MAX).map(e => ({ name: e.name || 'Anon', score: Number(e.score) || 0, date: e.date || null }));
  } else {
    // if server didn't return a list, re-fetch the top
    await loadLeaderboard();
  }
}

function saveLeaderboardLocal() {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard.slice(0, LEADERBOARD_MAX)));
  } catch (e) {}
}

function loadPlayerLocal() {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.username === 'string') username = obj.username;
      if (obj && typeof obj.highHeight === 'number') highHeight = obj.highHeight;
    }
  } catch (e) {}
}

function savePlayerLocal() {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ username: username, highHeight: highHeight }));
  } catch (e) {}
}

async function submitCurrentScore() {
  // Submit the player's lifetime best height (highHeight)
  const scoreToSubmit = Math.floor(highHeight || 0);
  const nameToSubmit = username || 'Player';
  const st = document.getElementById('leaderStatus');
  if (LEADERBOARD_API_URL) {
    try {
      if (st) st.textContent = 'Submitting to server...';
      await submitScoreToServer(nameToSubmit, scoreToSubmit);
      if (st) { st.textContent = 'Submitted (server)'; setTimeout(() => { if (st) st.textContent = ''; }, 1500); }
      renderLeaderboard();
      return;
    } catch (err) {
      console.warn('Submit to leaderboard server failed:', err);
      if (st) { st.textContent = 'Submit failed, saved locally'; setTimeout(() => { if (st) st.textContent = ''; }, 2000); }
      // fall through to local submit
    }
  }

  // Local submit fallback: insert into local leaderboard array and persist
  const existingIndex = leaderboard.findIndex(e => e.name === nameToSubmit && Math.floor(e.score) === Math.floor(scoreToSubmit));
  if (existingIndex === -1) {
    leaderboard.push({ name: nameToSubmit, score: scoreToSubmit, date: new Date().toISOString() });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, LEADERBOARD_MAX);
    saveLeaderboardLocal();
    if (st) { st.textContent = 'Submitted locally'; setTimeout(() => { if (st) st.textContent = ''; }, 1200); }
  } else {
    if (st) { st.textContent = 'Already on board'; setTimeout(() => { if (st) st.textContent = ''; }, 800); }
  }
  renderLeaderboard();
}

// -------------------- end leaderboard --------------------