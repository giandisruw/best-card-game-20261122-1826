// Synthesised sound for Ember, Tide & Thorn: WebAudio only, no files.
// Every effect is a short oscillator or noise burst, so the game needs no
// audio assets and stays silent until the player first interacts.
let audioContext = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function ensureContext() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

/** One soft tone: frequency, duration, waveform, volume. */
export function playTone(freq, seconds, type, volume) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume || 0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + seconds);
}

/** A short filtered-noise burst, used for the card snap and the hit thud. */
function playNoise(seconds, volume, lowFreq) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowFreq || 1200;
  const gain = ctx.createGain();
  gain.gain.value = volume || 0.15;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export function soundDeal() {
  playNoise(0.09, 0.1, 2400);
  playTone(520, 0.08, 'triangle', 0.06);
}

export function soundSelect() {
  playTone(660, 0.07, 'triangle', 0.08);
}

export function soundFlip() {
  playNoise(0.07, 0.12, 1800);
  playTone(440, 0.09, 'triangle', 0.07);
}

export function soundHit() {
  playNoise(0.18, 0.22, 700);
  playTone(140, 0.22, 'sawtooth', 0.1);
}

export function soundWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.35, 'triangle', 0.12), i * 130);
  });
}

export function soundLose() {
  const notes = [392, 330, 262, 196];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.4, 'sine', 0.1), i * 160);
  });
}
