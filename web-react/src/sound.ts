/**
 * Sound effects using Web Audio API — no external files required.
 */

let soundEnabled = true;
export function setSoundEnabled(v: boolean) { soundEnabled = v; }
export function isSoundEnabled() { return soundEnabled; }

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Short sine-wave beep */
function beep(frequency: number, duration: number, gain = 0.15, type: OscillatorType = "sine") {
  if (!soundEnabled) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // AudioContext not available (e.g., policy blocked) — silently ignore
  }
}

/** Short noise burst for shuffle/draw sounds */
function noise(duration: number, gain = 0.08) {
  if (!soundEnabled) return;
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    source.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.start(ctx.currentTime);
  } catch {
    // Silently ignore
  }
}

/** Play a card sound — short high-pitched click */
export function playCardSound() {
  beep(880, 0.06, 0.12, "triangle");
}

/** Draw card sound — soft shuffling noise */
export function drawCardSound() {
  noise(0.08, 0.06);
}

/** Color picker select sound — ascending chime */
export function selectColorSound() {
  beep(523, 0.08, 0.1); // C5
  setTimeout(() => beep(659, 0.08, 0.1), 60); // E5
  setTimeout(() => beep(784, 0.1, 0.12), 120); // G5
}

/** Wild card played — lower tone */
export function wildCardSound() {
  beep(220, 0.15, 0.15, "sawtooth");
  setTimeout(() => beep(196, 0.15, 0.1), 100);
}

/** Win sound — ascending triumphant chord */
export function winSound() {
  beep(523, 0.15, 0.12);
  setTimeout(() => beep(659, 0.15, 0.12), 100);
  setTimeout(() => beep(784, 0.15, 0.12), 200);
  setTimeout(() => beep(1047, 0.3, 0.15), 300);
}

/** UNO called — special alert */
export function unoSound() {
  beep(880, 0.1, 0.15, "square");
  setTimeout(() => beep(1047, 0.2, 0.12), 80);
}

/** Card hover — very subtle tick */
export function hoverCardSound() {
  beep(1200, 0.02, 0.04, "sine");
}

type VibratePattern = number | number[];

/** Haptic feedback — vibrate on mobile if supported */
export function vibrate(pattern: VibratePattern = 30) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // Vibrate API not available — silently ignore
  }
}
