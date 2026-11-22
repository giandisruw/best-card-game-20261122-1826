// Deterministic screenshot scenes behind ?shot=title|play|win|loss.
// Each scene plays the real rules forward from a fresh match with a fixed
// seed, steered by a simple policy, so the frame is what a real game looks
// like and the same seed always gives the same frame.
import { SUITS, SUIT_KEYS, suitBeats } from './cards.js';
import { startMatch, playSelectedCard, forceEnd, renderAll } from './main.js';

/** The court that beats the court Vex is leaning toward. */
function counterCourt(lean) {
  return SUIT_KEYS.find((s) => suitBeats(s, lean));
}

function pickCardIndex(state, mode) {
  const affordable = state.playerHand
    .map((card, index) => ({ card, index }))
    .filter((entry) => entry.card.cost <= state.playerEnergy);
  if (affordable.length === 0) return -1;
  if (mode === 'weak') {
    affordable.sort((a, b) => a.card.power - b.card.power);
    return affordable[0].index;
  }
  const counter = counterCourt(state.foeLean);
  const counters = affordable.filter((entry) => entry.card.suit === counter);
  const pool = counters.length > 0 ? counters : affordable;
  pool.sort((a, b) => b.card.power - a.card.power);
  return pool[0].index;
}

/** Play rounds with the given policy until the match ends or the cap hits. */
function playRounds(state, mode, maxRounds) {
  for (let i = 0; i < maxRounds && state.screen === 'play'; i += 1) {
    const index = pickCardIndex(state, mode);
    if (index < 0) break;
    state.selectedIndex = index;
    playSelectedCard(state);
  }
}

/**
 * Set the match to the named scene (title, play, win or loss) and render it.
 * Any other name is the title screen.
 */
export function stageShot(state, name) {
  if (name === 'title' || !name) {
    renderAll(state);
    return;
  }
  startMatch(state);
  if (name === 'play') {
    playRounds(state, 'strong', 3);
    renderAll(state);
    return;
  }
  if (name === 'win') {
    playRounds(state, 'strong', 40);
    if (state.screen !== 'win') forceEnd(state, 'player');
    renderAll(state);
    return;
  }
  if (name === 'loss') {
    playRounds(state, 'weak', 40);
    if (state.screen !== 'loss') forceEnd(state, 'foe');
    renderAll(state);
    return;
  }
  renderAll(state);
}

export function courtName(key) {
  return SUITS[key].name;
}
