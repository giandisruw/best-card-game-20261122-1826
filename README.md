# Ember, Tide & Thorn — A Duel of Three Courts

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/giandisruw/best-card-game-20261122-1826/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/giandisruw/best-card-game-20261122-1826/reward.svg)](https://make.fun)

An original card duel for the make.fun **best-card-game-20261122-1826** bounty.
Static files only — serve `game/` with any static server and play offline in
desktop Chrome, mouse or keyboard, no network requests.

## How to play

Life 30 each. Every round you and **Vex, Warden of Thorns**, each play one
card from a hand of five. Higher power wins the round and deals damage equal
to the power difference.

**The three courts** (told apart by colour *and* shape):

| Court | Mark | Beats |
|---|---|---|
| Ember | ▲ red | Thorn |
| Thorn | ◆ green | Tide |
| Tide | ● blue | Ember |

- **Suit advantage +3** — winning with the court that beats your rival's.
- **Flow +1** — winning with the same court as your last card.
- **Attunement +2** — winning with the court of the last round's winner.
- **Clash** — equal power: no damage, both sides draw a card.
- **Motes** — cards cost 0–3 motes; you gain 2 motes a round (max 6), so big
  cards must be timed.

**Reading Vex:** before you commit, Vex leans toward a court — a glowing
suit mark and a line above its hand. It plays that court about 7 times in
10, so answering with the beating court is usually right… but Vex sometimes
bluffs, and it saves its power-9 cards for rounds it can win.

**Controls:** click a card (or keys `1–5`, `←`/`→` to move) then `Enter` to
play. `R` rematches, `M` mutes the synthesised WebAudio sounds.

## Files

- `game/index.html` — the table
- `game/styles.css` — table, cards, overlays
- `game/src/main.js` — match state, rounds, input, rendering
- `game/src/cards.js` — deck, courts, clash resolution
- `game/src/ai.js` — Vex's lean, bluffs and card choice
- `game/src/rng.js` — seeded random + shuffle
- `game/src/sound.js` — WebAudio sound effects (synthesised, no files)
- `game/src/shots.js` — deterministic `?shot=` scenes for screenshots
- `main.ts` — hand-in program (Node 22, stdlib only)
- `serve.ts` — local static server (`node serve.ts` → http://localhost:8080)

## Play-test

```sh
node serve.ts
# open http://localhost:8080 — or ?shot=title|play|win|loss&seed=1 for the staged states
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Referral code: `0txwmf1m`
