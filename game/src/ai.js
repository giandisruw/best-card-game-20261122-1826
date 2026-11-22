// Vex, the AI opponent: picks a card each round and telegraphs its intent.
// The telegraph is the readable part of the duel: Vex leans toward one court
// (shown as a glowing suit mark above its hand) and usually — about 7 times
// in 10 — plays a card of that court. A player who reads the lean can answer
// with the court that beats it, but Vex sometimes bluffs, and it saves its
// big cards for rounds it can win.
import { SUITS, SUIT_KEYS, suitBeats } from './cards.js';
import { weightedPick } from './rng.js';

export const FOE_NAME = 'Vex, Warden of Thorns';

/** The three lean lines Vex shows, one per court. */
export const LEAN_LINES = {
  ember: 'Vex stokes the Ember court…',
  tide: 'Vex listens to the Tide court…',
  thorn: 'Vex sharpens the Thorn court…',
};

/**
 * Choose Vex's lean for the round: the court of its strongest affordable
 * card most of the time, a random court when it plans a bluff.
 */
export function chooseLean(state, random) {
  const affordable = state.foeHand.filter((c) => c.cost <= state.foeEnergy);
  if (affordable.length === 0) return SUIT_KEYS[Math.floor(random() * 3)];
  const best = affordable.slice().sort((a, b) => b.power - a.power)[0];
  if (random() < 0.7) return best.suit;
  const others = SUIT_KEYS.filter((s) => s !== best.suit);
  return others[Math.floor(random() * others.length)];
}

/**
 * Pick Vex's card. It prefers a card that beats the player's likely answer:
 * if the player just played a court, Vex answers with the court that beats
 * it when it can afford one; otherwise it plays its strongest affordable card
 * of the leaned court, and saves power-9 cards unless the round is winnable.
 */
export function chooseFoeCard(state, random) {
  const affordable = state.foeHand.filter((c) => c.cost <= state.foeEnergy);
  if (affordable.length === 0) return null;
  const playerLast = state.playerLastSuit;
  if (playerLast) {
    const counterSuit = SUIT_KEYS.find((s) => suitBeats(s, playerLast));
    const counters = affordable.filter((c) => c.suit === counterSuit);
    if (counters.length > 0 && random() < 0.6) {
      return counters.slice().sort((a, b) => b.power - a.power)[0];
    }
  }
  const leaned = affordable.filter((c) => c.suit === state.foeLean);
  const pool = leaned.length > 0 && random() < 0.75 ? leaned : affordable;
  const sorted = pool.slice().sort((a, b) => b.power - a.power);
  // Hold the 9 unless it wins the round outright or Vex is far behind.
  if (sorted[0].power === 9 && state.foeLife > state.playerLife + 6 && random() < 0.7) {
    return sorted[1] || sorted[0];
  }
  return sorted[0];
}

/** Pick Vex's lean for the next round, weighted toward its best court. */
export function nextLeanHint(state, random) {
  const weights = SUIT_KEYS.map((s) => {
    const best = state.foeHand.filter((c) => c.suit === s && c.cost <= state.foeEnergy);
    return 1 + best.reduce((sum, c) => sum + c.power, 0) / 9;
  });
  return weightedPick(SUIT_KEYS, weights, random);
}

export function suitName(key) {
  return SUITS[key].name;
}
