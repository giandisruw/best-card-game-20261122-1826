// The deck, the three courts, and the round rules of Ember, Tide & Thorn.
// Suits are told apart by colour AND shape, never by text alone:
//   Ember = red + triangle, Tide = blue + circle, Thorn = green + diamond.
// The cycle is Ember > Thorn > Tide > Ember: the winning suit deals +3.
export const SUITS = {
  ember: { key: 'ember', name: 'Ember', color: '#e5484d', dark: '#8f1d22', shape: '▲', glyph: '▲', beats: 'thorn' },
  tide: { key: 'tide', name: 'Tide', color: '#3e8ef7', dark: '#174a8f', shape: '●', glyph: '●', beats: 'ember' },
  thorn: { key: 'thorn', name: 'Thorn', color: '#46a758', dark: '#1d5c2e', shape: '◆', glyph: '◆', beats: 'tide' },
};

export const SUIT_KEYS = ['ember', 'tide', 'thorn'];
export const START_LIFE = 30;
export const HAND_SIZE = 5;
export const MAX_ENERGY = 6;
export const SUIT_BONUS = 3;
export const FLOW_BONUS = 1;
export const ATTUNE_BONUS = 2;

let nextCardId = 1;

/** Build one card: power 1-9, cost grows with power, suit from its court. */
export function makeCard(suitKey, power) {
  const cost = power <= 3 ? 0 : power <= 6 ? 1 : power <= 8 ? 2 : 3;
  return { id: nextCardId, suit: suitKey, power, cost };
}

export function resetCardIds() {
  nextCardId = 1;
}

/** The full 27-card court deck: three suits, powers 1-9 each. */
export function buildDeck() {
  resetCardIds();
  const deck = [];
  for (const suit of SUIT_KEYS) {
    for (let power = 1; power <= 9; power += 1) deck.push(makeCard(suit, power));
  }
  return deck;
}

/** Does suit A beat suit B in the cycle? */
export function suitBeats(a, b) {
  return SUITS[a].beats === b;
}

/**
 * Resolve one clash. Returns { winner, damage, tie, reasons } where winner is
 * 'player', 'foe' or null on a tie. Damage is power difference plus bonuses:
 * suit advantage +3, Flow (same suit as your last card) +1, Attunement (same
 * suit as the last round's winning card) +2. Equal powers clash: no damage,
 * both sides draw a card.
 */
export function resolveClash(playerCard, foeCard, context) {
  const reasons = [];
  if (playerCard.power === foeCard.power) {
    return { winner: null, damage: 0, tie: true, reasons: ['Equal power — the cards clash and shatter. Both sides draw.'] };
  }
  const winner = playerCard.power > foeCard.power ? 'player' : 'foe';
  const winCard = winner === 'player' ? playerCard : foeCard;
  const loseCard = winner === 'player' ? foeCard : playerCard;
  let damage = winCard.power - loseCard.power;
  if (suitBeats(winCard.suit, loseCard.suit)) {
    damage += SUIT_BONUS;
    reasons.push(`${SUITS[winCard.suit].name} ${SUITS[winCard.suit].glyph} beats ${SUITS[loseCard.suit].name} ${SUITS[loseCard.suit].glyph} (+${SUIT_BONUS})`);
  }
  const lastSuit = winner === 'player' ? context.playerLastSuit : context.foeLastSuit;
  if (lastSuit && winCard.suit === lastSuit) {
    damage += FLOW_BONUS;
    reasons.push(`Flow: same court as last round (+${FLOW_BONUS})`);
  }
  if (context.attunedSuit && winCard.suit === context.attunedSuit) {
    damage += ATTUNE_BONUS;
    reasons.push(`Attuned to the ${SUITS[context.attunedSuit].name} court (+${ATTUNE_BONUS})`);
  }
  return { winner, damage, tie: false, reasons };
}

/** Human-readable label for a card, used by the log and screen readers. */
export function cardLabel(card) {
  return `${SUITS[card.suit].name} ${card.power} (${card.cost} mote${card.cost === 1 ? '' : 's'})`;
}
