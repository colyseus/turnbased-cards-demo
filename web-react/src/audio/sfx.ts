/* global OscillatorNode, GainNode */
import { readStorage } from "../storage.ts";

type AudioWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function normalizeVolumeValue(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function parseStoredVolumeValue(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return normalizeVolumeValue(Number(trimmed));
}

class SoundFX {
  private ctx: AudioContext | null = null;
  private volume = 0.5;
  private muted = false;
  private ambientOscs: OscillatorNode[] = [];
  private ambientGain: GainNode | null = null;

  private init() {
    if (this.ctx) return;
    if (typeof window === "undefined") return;
    const browserWindow = window as AudioWindow;
    const AudioContextClass = browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  private resumeIfNeeded() {
    if (!this.ctx || this.ctx.state !== "suspended") return;
    void this.ctx.resume().catch(() => undefined);
  }

  setVolume(vol: number) {
    const next = normalizeVolumeValue(vol);
    if (next === null) return;
    this.volume = next;
    this.updateAmbientVolume();
  }

  setMuted(mute: boolean) {
    this.muted = mute;
    this.updateAmbientVolume();
  }

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  private getGainMultiplier() {
    return this.muted ? 0 : this.volume;
  }

  private updateAmbientVolume() {
    if (this.ambientGain && this.ctx) {
      const mult = this.getGainMultiplier();
      this.ambientGain.gain.setTargetAtTime(0.012 * mult, this.ctx.currentTime, 0.15);
    }
  }

  startAmbientSoundscape(skin = "classic") {
    this.init();
    if (!this.ctx) return;
    this.resumeIfNeeded();
    this.stopAmbientSoundscape();

    const mult = this.getGainMultiplier();
    const now = this.ctx.currentTime;

    const gainNode = this.ctx.createGain();
    gainNode.connect(this.ctx.destination);
    gainNode.gain.setValueAtTime(0.012 * mult, now);
    this.ambientGain = gainNode;

    if (skin === "classic") {
      const freqs = [82.41, 98.0, 123.47, 146.83];
      this.ambientOscs = freqs.map((f) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);

        const pGain = this.ctx!.createGain();
        pGain.connect(gainNode);
        pGain.gain.setValueAtTime(0.25, now);

        osc.connect(pGain);
        osc.start(now);
        return osc;
      });
    } else if (skin === "cyber") {
      const freqs = [65.41, 98.0];
      this.ambientOscs = freqs.map((f) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, now);

        const filter = this.ctx!.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(120, now);

        osc.connect(filter);
        filter.connect(gainNode);
        osc.start(now);
        return osc;
      });
    } else {
      const freqs = [392.0, 493.88];
      this.ambientOscs = freqs.map((f, i) => {
        const osc = this.ctx!.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);

        const filter = this.ctx!.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(f + Math.sin(i) * 12, now);

        osc.connect(filter);
        filter.connect(gainNode);
        osc.start(now);
        return osc;
      });
    }
  }

  stopAmbientSoundscape() {
    this.ambientOscs.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // ignore
      }
      try {
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.ambientOscs = [];
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {
        // ignore
      }
      this.ambientGain = null;
    }
  }

  playPluck() {
    this.init();
    this.resumeIfNeeded();
  }
  playSwish() {}
  playChime() {}
  playTurnAlert() {}
  playHeartbeat() {}
}

export const sfx = new SoundFX();

const savedVol = readStorage("uno_volume");
const normalizedVol = parseStoredVolumeValue(savedVol);
if (normalizedVol !== null) {
  sfx.setVolume(normalizedVol);
}
const savedMuted = readStorage("uno_muted");
if (savedMuted === "true") sfx.setMuted(true);
