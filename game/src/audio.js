// Sound from nothing: a small WebAudio synth — engine hum, siren, shots,
// pickups and stings. No audio files, so the game stays self-contained.

export class Sound {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenOsc.type = 'triangle';
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
    this.sirenOsc.start();
  }
  blip(freq, dur = 0.08, type = 'square', vol = 0.08, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }
  shot() { this.blip(160, 0.09, 'square', 0.1, -110); }
  pickup() { this.blip(660, 0.07, 'sine', 0.09); setTimeout(() => this.blip(990, 0.09, 'sine', 0.09), 60); }
  success() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.1), i * 90)); }
  fail() { this.blip(196, 0.25, 'sawtooth', 0.09, -80); }
  crash() { this.blip(70, 0.16, 'sawtooth', 0.14, -30); }
  setEngine(on, speedRatio = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.03 : 0, t, 0.1);
    if (on) this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.1);
  }
  setSiren(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.018 : 0, t, 0.15);
    if (on) {
      const wail = 620 + Math.sin(t * 2.4) * 160;
      this.sirenOsc.frequency.setTargetAtTime(wail, t, 0.05);
    }
  }
}
