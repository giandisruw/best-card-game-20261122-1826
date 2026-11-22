// Ember, Tide & Thorn — the match itself: state, rounds, input and rendering.
// A duel of three courts. Each round both sides play one card; higher power
// wins the round and deals damage, the suit cycle adds +3, Flow and
// Attunement add more. Life starts at 30. Vex telegraphs a lean each round;
// reading it and answering with the beating court is how you win.
import { SUITS, SUIT_KEYS, START_LIFE, HAND_SIZE, MAX_ENERGY, buildDeck, resolveClash, cardLabel } from './cards.js';
import { mulberry32, seededShuffle } from './rng.js';
import { chooseLean, chooseFoeCard, LEAN_LINES, FOE_NAME } from './ai.js';
import { soundDeal, soundSelect, soundFlip, soundHit, soundWin, soundLose, setMuted, isMuted } from './sound.js';
import { stageShot } from './shots.js';

const $ = (id) => document.getElementById(id);

export function createMatch(seed) {
  const random = mulberry32(seed);
  const playerDeck = seededShuffle(buildDeck(), random);
  const foeDeck = seededShuffle(buildDeck(), random);
  return {
    seed,
    random,
    screen: 'title',
    phase: 'choose',
    round: 1,
    playerDeck,
    foeDeck,
    playerHand: [],
    foeHand: [],
    playerLife: START_LIFE,
    foeLife: START_LIFE,
    playerEnergy: 3,
    foeEnergy: 3,
    playerLastSuit: null,
    foeLastSuit: null,
    attunedSuit: null,
    foeLean: 'ember',
    foeCard: null,
    playerCard: null,
    lastResult: null,
    selectedIndex: 0,
    log: [],
    damageDealt: 0,
    damageTaken: 0,
    roundsWon: 0,
    roundsPlayed: 0,
  };
}

/** Deal the opening hands and set the first lean. */
export function startMatch(state) {
  state.screen = 'play';
  state.phase = 'choose';
  state.log = ['The duel begins. Read Vex’s lean, answer with the beating court.'];
  drawUpToHand(state, 'player');
  drawUpToHand(state, 'foe');
  state.foeLean = chooseLean(state, state.random);
  state.foeCard = chooseFoeCard(state, state.random);
  soundDeal();
}

export function drawUpToHand(state, side) {
  const hand = side === 'player' ? state.playerHand : state.foeHand;
  const deck = side === 'player' ? state.playerDeck : state.foeDeck;
  while (hand.length < HAND_SIZE && deck.length > 0) hand.push(deck.pop());
}

function addLog(state, text) {
  state.log.unshift(text);
  if (state.log.length > 4) state.log.length = 4;
}

/** Play the selected card against Vex's hidden card and resolve the round. */
export function playSelectedCard(state) {
  if (state.screen !== 'play' || state.phase !== 'choose') return false;
  const card = state.playerHand[state.selectedIndex];
  if (!card) return false;
  if (card.cost > state.playerEnergy) {
    addLog(state, `Not enough motes for ${cardLabel(card)}.`);
    renderAll(state);
    return false;
  }
  state.playerHand.splice(state.selectedIndex, 1);
  state.playerEnergy -= card.cost;
  state.playerCard = card;
  state.phase = 'reveal';
  soundFlip();
  const foeCard = state.foeCard || chooseFoeCard(state, state.random);
  if (foeCard) {
    const fi = state.foeHand.indexOf(foeCard);
    if (fi >= 0) state.foeHand.splice(fi, 1);
    state.foeEnergy -= foeCard.cost;
  }
  state.foeCard = foeCard;
  resolveRound(state, card, foeCard);
  return true;
}

export function resolveRound(state, playerCard, foeCard) {
  state.roundsPlayed += 1;
  state.lastPlayerCard = playerCard;
  state.lastFoeCard = foeCard;
  if (!foeCard) {
    addLog(state, 'Vex has no card it can afford — it passes, and you strike unopposed.');
    state.foeLife -= playerCard.power;
    state.damageDealt += playerCard.power;
    state.lastResult = { winner: 'player', damage: playerCard.power, tie: false, reasons: ['Vex passed.'] };
  } else {
    const result = resolveClash(playerCard, foeCard, {
      playerLastSuit: state.playerLastSuit,
      foeLastSuit: state.foeLastSuit,
      attunedSuit: state.attunedSuit,
    });
    state.lastResult = result;
    if (result.tie) {
      addLog(state, `Clash! Both played ${cardLabel(playerCard)} power — no damage, both draw.`);
      drawUpToHand(state, 'player');
      drawUpToHand(state, 'foe');
    } else if (result.winner === 'player') {
      state.foeLife = Math.max(0, state.foeLife - result.damage);
      state.damageDealt += result.damage;
      state.roundsWon += 1;
      state.attunedSuit = playerCard.suit;
      addLog(state, `You win the round: ${cardLabel(playerCard)} beats ${cardLabel(foeCard)} for ${result.damage}. ${result.reasons.join(' ')}`);
      soundHit();
    } else {
      state.playerLife = Math.max(0, state.playerLife - result.damage);
      state.damageTaken += result.damage;
      state.attunedSuit = foeCard.suit;
      addLog(state, `Vex wins the round: ${cardLabel(foeCard)} beats ${cardLabel(playerCard)} for ${result.damage}. ${result.reasons.join(' ')}`);
      soundHit();
    }
  }
  state.playerLastSuit = playerCard.suit;
  if (foeCard) state.foeLastSuit = foeCard.suit;
  state.selectedIndex = 0;
  checkMatchEnd(state);
  if (state.screen === 'play') {
    state.round += 1;
    state.playerEnergy = Math.min(MAX_ENERGY, state.playerEnergy + 2);
    state.foeEnergy = Math.min(MAX_ENERGY, state.foeEnergy + 2);
    drawUpToHand(state, 'player');
    drawUpToHand(state, 'foe');
    state.foeLean = chooseLean(state, state.random);
    state.foeCard = chooseFoeCard(state, state.random);
    state.phase = 'choose';
    // Keep playerCard / foeCard on the table so the arena still shows the
    // last round's clash until the next card is played.
  }
  renderAll(state);
}

export function checkMatchEnd(state) {
  if (state.foeLife <= 0 && state.playerLife <= 0) {
    state.screen = state.damageDealt >= state.damageTaken ? 'win' : 'loss';
  } else if (state.foeLife <= 0) {
    state.screen = 'win';
    soundWin();
  } else if (state.playerLife <= 0) {
    state.screen = 'loss';
    soundLose();
  }
}

/** Force an ending for a staged screenshot when the scripted rounds did not end it. */
export function forceEnd(state, winner) {
  if (winner === 'player') {
    state.foeLife = 0;
    state.screen = 'win';
  } else {
    state.playerLife = 0;
    state.screen = 'loss';
  }
  renderAll(state);
}

// ---- rendering ----

function lifeBar(life) {
  const pct = Math.max(0, Math.min(100, (life / START_LIFE) * 100));
  const cls = pct > 50 ? 'good' : pct > 25 ? 'warn' : 'bad';
  return `<div class="lifebar" role="img" aria-label="Life ${life} of ${START_LIFE}"><div class="lifefill ${cls}" style="width:${pct}%"></div><span>${life} ♥</span></div>`;
}

function energyPips(energy) {
  let pips = '';
  for (let i = 0; i < MAX_ENERGY; i += 1) pips += `<span class="pip ${i < energy ? 'on' : ''}">●</span>`;
  return `<div class="energy" aria-label="Energy ${energy} of ${MAX_ENERGY}">${pips}<span class="energy-label">${energy} motes</span></div>`;
}

function cardHtml(card, opts) {
  const suit = SUITS[card.suit];
  const classes = ['card', `suit-${card.suit}`];
  if (opts.selected) classes.push('selected');
  if (opts.disabled) classes.push('disabled');
  if (opts.played) classes.push('played');
  if (opts.hidden) classes.push('back');
  const costDots = '●'.repeat(card.cost) || '—';
  const inner = opts.hidden
    ? `<div class="card-back-mark">✦</div><div class="card-back-name">EMBER · TIDE · THORN</div>`
    : `<div class="card-suit">${suit.glyph}</div><div class="card-power">${card.power}</div><div class="card-name">${suit.name}</div><div class="card-cost" title="Cost">${costDots}</div>`;
  return `<button type="button" class="${classes.join(' ')}" data-index="${opts.index ?? ''}" aria-label="${opts.hidden ? 'Hidden card' : cardLabel(card)}">${inner}</button>`;
}

function renderFoeHand(state) {
  return state.foeHand.map((c, i) => cardHtml(c, { hidden: true, index: i })).join('');
}

function renderPlayerHand(state) {
  return state.playerHand.map((c, i) => cardHtml(c, {
    selected: i === state.selectedIndex,
    disabled: c.cost > state.playerEnergy,
    index: i,
  })).join('');
}

function renderArena(state) {
  const result = state.lastResult;
  let banner = '<div class="banner">Choose a card — click it, or press 1–5, then Enter.</div>';
  if (result) {
    if (result.tie) banner = '<div class="banner tie">⚔ CLASH — equal power! Both sides draw.</div>';
    else if (result.winner === 'player') banner = `<div class="banner win">✦ YOU TAKE THE ROUND −${result.damage} to Vex</div>`;
    else banner = `<div class="banner lose">✦ VEX TAKES THE ROUND −${result.damage} to you</div>`;
  }
  const played = state.lastResult
    ? `<div class="played-row">
        <div class="played-label">You played</div>${state.lastPlayerCard ? cardHtml(state.lastPlayerCard, { played: true }) : '<div class="card empty">—</div>'}
        <div class="vs">VS</div>
        ${state.lastFoeCard ? cardHtml(state.lastFoeCard, { played: true }) : '<div class="card empty">—</div>'}
        <div class="played-label">Vex played</div>
      </div>`
    : '<div class="played-row"><div class="played-hint">Your card and Vex’s card meet here.</div></div>';
  return banner + played;
}

export function renderAll(state) {
  $('round-label').textContent = `Round ${state.round}`;
  $('player-life').innerHTML = lifeBar(state.playerLife);
  $('foe-life').innerHTML = lifeBar(state.foeLife);
  $('player-energy').innerHTML = energyPips(state.playerEnergy);
  $('foe-hand').innerHTML = renderFoeHand(state);
  $('player-hand').innerHTML = renderPlayerHand(state);
  $('arena').innerHTML = renderArena(state);
  const lean = SUITS[state.foeLean];
  $('foe-lean').innerHTML = `<span class="lean-mark" style="color:${lean.color}">${lean.glyph}</span> ${LEAN_LINES[state.foeLean]}`;
  $('game-log').innerHTML = state.log.map((line) => `<li>${line}</li>`).join('');
  $('status').textContent = `Round ${state.round}. Your life ${state.playerLife}, Vex ${state.foeLife}. Energy ${state.playerEnergy}.`;
  document.querySelectorAll('#player-hand .card').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = Number(el.dataset.index);
      state.selectedIndex = idx;
      soundSelect();
      renderAll(state);
    });
    el.addEventListener('dblclick', () => playSelectedCard(state));
  });
  const playBtn = $('play-button');
  const selected = state.playerHand[state.selectedIndex];
  playBtn.disabled = !selected || selected.cost > state.playerEnergy || state.phase !== 'choose';
  playBtn.textContent = selected ? `Play ${cardLabel(selected)} ⏎` : 'Play card ⏎';
  const title = $('title-screen');
  const end = $('end-screen');
  title.classList.toggle('hidden', state.screen !== 'title');
  end.classList.toggle('hidden', state.screen !== 'win' && state.screen !== 'loss');
  if (state.screen === 'win' || state.screen === 'loss') {
    const won = state.screen === 'win';
    $('end-title').textContent = won ? '✦ VICTORY ✦' : '✦ DEFEAT ✦';
    $('end-title').className = won ? 'end-title win' : 'end-title lose';
    $('end-text').textContent = won
      ? `The courts bow to you. Vex falls with ${state.damageDealt} damage dealt across ${state.roundsPlayed} rounds.`
      : `Vex takes the duel. You dealt ${state.damageDealt} damage across ${state.roundsPlayed} rounds — read the lean and try again.`;
    $('end-stats').textContent = `Rounds: ${state.roundsPlayed} · Rounds won: ${state.roundsWon} · Damage dealt: ${state.damageDealt} · Damage taken: ${state.damageTaken}`;
  }
  document.body.dataset.screen = state.screen;
}

// ---- input ----

export function handleKey(state, event) {
  if (state.screen === 'title' && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    startMatch(state);
    renderAll(state);
    return;
  }
  if ((state.screen === 'win' || state.screen === 'loss') && event.key.toLowerCase() === 'r') {
    const fresh = createMatch(state.seed + 1);
    Object.assign(state, fresh);
    startMatch(state);
    renderAll(state);
    return;
  }
  if (state.screen !== 'play') return;
  if (event.key >= '1' && event.key <= '5') {
    const idx = Number(event.key) - 1;
    if (idx < state.playerHand.length) {
      state.selectedIndex = idx;
      soundSelect();
      renderAll(state);
    }
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const dir = event.key === 'ArrowLeft' ? -1 : 1;
    state.selectedIndex = (state.selectedIndex + dir + state.playerHand.length) % Math.max(1, state.playerHand.length);
    soundSelect();
    renderAll(state);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    playSelectedCard(state);
  } else if (event.key.toLowerCase() === 'm') {
    setMuted(!isMuted());
    $('mute-button').textContent = isMuted() ? '🔇 Sound off (M)' : '🔊 Sound on (M)';
  }
}

// ---- boot ----

export function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || '1');
  const state = createMatch(seed);
  window.__ett = state;
  $('start-button').addEventListener('click', () => {
    startMatch(state);
    renderAll(state);
  });
  $('play-button').addEventListener('click', () => playSelectedCard(state));
  $('again-button').addEventListener('click', () => {
    const fresh = createMatch(state.seed + 1);
    Object.assign(state, fresh);
    startMatch(state);
    renderAll(state);
  });
  $('mute-button').addEventListener('click', () => {
    setMuted(!isMuted());
    $('mute-button').textContent = isMuted() ? '🔇 Sound off (M)' : '🔊 Sound on (M)';
  });
  document.addEventListener('keydown', (event) => handleKey(state, event));
  const shot = params.get('shot');
  if (shot) {
    stageShot(state, shot);
  } else {
    renderAll(state);
  }
  return state;
}

boot();
