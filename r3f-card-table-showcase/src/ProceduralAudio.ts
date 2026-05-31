class ProceduralAudio {
  ctx: AudioContext | null;
  masterVolume: number;
  isMuted: boolean;
  private _settingsLoaded: boolean;
  private _swooshBuffer: AudioBuffer | null;

  constructor() {
    this.ctx = null;
    this.masterVolume = 0.5;
    this.isMuted = false;
    this._settingsLoaded = false;
    this._swooshBuffer = null;
  }

  /** Deferred localStorage read — only called on first actual use */
  private _loadSettings() {
    if (this._settingsLoaded) return;
    this._settingsLoaded = true;
    try {
      const savedVol = localStorage.getItem('showcase_volume');
      if (savedVol !== null) this.masterVolume = parseFloat(savedVol);
      
      const savedMute = localStorage.getItem('showcase_muted');
      if (savedMute !== null) this.isMuted = savedMute === 'true';
    } catch {
      // localStorage may be unavailable in some contexts
    }
  }
  
  init() {
    if (this.ctx) return;
    this._loadSettings();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported:', e);
    }
  }
  
  setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('showcase_volume', this.masterVolume.toString());
    } catch { /* noop */ }
  }
  
  setMute(mute: boolean) {
    this.isMuted = mute;
    try {
      localStorage.setItem('showcase_muted', this.isMuted.toString());
    } catch { /* noop */ }
  }
  
  createGainNode(customVol = 1, forceInit = false) {
    if (forceInit) {
      this.init();
    }
    this._loadSettings();
    if (!this.ctx || this.ctx.state === 'suspended') return null;
    if (this.isMuted || this.masterVolume === 0) return null;
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(this.masterVolume * customVol, this.ctx.currentTime);
    gainNode.connect(this.ctx.destination);
    return gainNode;
  }
  
  playClick(vol = 0.2, forceInit = false) {
    const gainNode = this.createGainNode(vol, forceInit);
    if (!gainNode || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.03);
    
    gainNode.gain.setValueAtTime(this.masterVolume * vol, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
    
    osc.connect(gainNode);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }
  
  getSwooshBuffer(): AudioBuffer | null {
    if (this._swooshBuffer) return this._swooshBuffer;
    if (!this.ctx) return null;

    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._swooshBuffer = buffer;
    return this._swooshBuffer;
  }
  
  playSwoosh(vol = 0.3, forceInit = false) {
    const gainNode = this.createGainNode(vol, forceInit);
    if (!gainNode || !this.ctx) return;
    
    const buffer = this.getSwooshBuffer();
    if (!buffer) return;
    
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(6, this.ctx.currentTime);
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * vol, this.ctx.currentTime + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    
    noiseNode.connect(filter);
    filter.connect(gainNode);
    noiseNode.start();
  }
  
  playImpact(vol = 0.45, forceInit = false) {
    const gainNode = this.createGainNode(vol, forceInit);
    if (!gainNode || !this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.12);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);
    
    const snapOsc = this.ctx.createOscillator();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(400, this.ctx.currentTime);
    snapOsc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.02);
    
    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(this.masterVolume * vol * 0.35, this.ctx.currentTime);
    snapGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
    
    gainNode.gain.setValueAtTime(this.masterVolume * vol, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    
    osc.connect(filter);
    filter.connect(gainNode);
    
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
    
    snapOsc.start();
    snapOsc.stop(this.ctx.currentTime + 0.03);
  }
  
  playTones(vol = 0.35, forceInit = false) {
    if (forceInit) {
      this.init();
    }
    this._loadSettings();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    if (this.isMuted || this.masterVolume === 0) return;
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const noteInterval = 0.075;
    const baseTime = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const gainNode = this.createGainNode(vol * 0.7, false);
      if (!gainNode || !this.ctx) return;
      
      const startAt = baseTime + idx * noteInterval;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startAt);
      
      gainNode.gain.setValueAtTime(0.001, startAt);
      gainNode.gain.linearRampToValueAtTime(this.masterVolume * vol * 0.4, startAt + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + 0.3);
      
      osc.connect(gainNode);
      osc.start(startAt);
      osc.stop(startAt + 0.32);
    });
  }
}

export const audio = new ProceduralAudio();
