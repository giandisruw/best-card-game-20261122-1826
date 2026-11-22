// Seeded random numbers for Ember, Tide & Thorn.
// One tiny job: a deterministic mulberry32 generator plus a seeded shuffle,
// so a ?shot= render and a replayed match always deal the same cards.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle that draws only from the given random function. */
export function seededShuffle(deck, random) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Pick one element of `items` with weights, using the seeded random source. */
export function weightedPick(items, weights, random) {
  let total = 0;
  for (const w of weights) total += w;
  let roll = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
