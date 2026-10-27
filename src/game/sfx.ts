// Tiny synthesized sound engine — no assets, everything generated with WebAudio.
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let fx: GainNode | null = null;
let echo: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let volume = 0.7;
const level = () => (muted ? 0 : volume * 0.5);
const lastAt: Record<string, number> = {};

export function initAudio() {
  try {
    if (!ac) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ac = new Ctor();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 7;
      comp.attack.value = 0.002;
      comp.release.value = 0.22;
      master = ac.createGain();
      master.gain.value = level();
      fx = ac.createGain();
      fx.gain.value = 1;
      fx.connect(comp);
      // gentle feedback echo for space / weight
      const delay = ac.createDelay(0.5);
      delay.delayTime.value = 0.16;
      const fb = ac.createGain();
      fb.gain.value = 0.24;
      const wet = ac.createGain();
      wet.gain.value = 0.35;
      echo = ac.createGain();
      echo.gain.value = 1;
      echo.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(fx);
      comp.connect(master);
      master.connect(ac.destination);
      const len = Math.floor(ac.sampleRate * 1.2);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") void ac.resume();
  } catch {
    /* audio unavailable */
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ac) master.gain.setTargetAtTime(level(), ac.currentTime, 0.02);
}
export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master && ac) master.gain.setTargetAtTime(level(), ac.currentTime, 0.02);
}
export function getVolume() {
  return volume;
}
export function toggleMuted() {
  setMuted(!muted);
  return muted;
}
export function isMuted() {
  return muted;
}

function ready() {
  if (!ac || !fx || muted) return null;
  return ac;
}
function throttle(key: string, ms: number) {
  const now = performance.now();
  if ((lastAt[key] || 0) + ms > now) return false;
  lastAt[key] = now;
  return true;
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  glide?: number;
  echo?: number;
  filter?: number;
}
function tone(freq: number, end: number, dur: number, o: ToneOpts = {}) {
  const a = ready();
  if (!a || !fx) return;
  const t = a.currentTime + (o.delay || 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(Math.max(20, freq), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.15), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const bp = a.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = o.filter;
    osc.connect(bp);
    node = bp;
  }
  node.connect(g);
  g.connect(fx);
  if (o.echo && echo) {
    const s = a.createGain();
    s.gain.value = o.echo;
    g.connect(s);
    s.connect(echo);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface NoiseOpts {
  q?: number;
  gain?: number;
  delay?: number;
  qtype?: BiquadFilterType;
  echo?: number;
  attack?: number;
}
function noise(dur: number, from: number, to: number, o: NoiseOpts = {}) {
  const a = ready();
  if (!a || !noiseBuf || !fx) return;
  const t = a.currentTime + (o.delay || 0);
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const filter = a.createBiquadFilter();
  filter.type = o.qtype || "bandpass";
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = a.createGain();
  const peak = Math.max(0.0002, o.gain ?? 0.2);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(fx);
  if (o.echo && echo) {
    const s = a.createGain();
    s.gain.value = o.echo;
    g.connect(s);
    s.connect(echo);
  }
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  shot(kind: string) {
    if (kind === "rail") {
      tone(1800, 120, 0.3, { type: "sawtooth", gain: 0.17, echo: 0.5 });
      tone(90, 40, 0.25, { type: "sine", gain: 0.2 });
      noise(0.3, 5200, 320, { gain: 0.26, q: 2, echo: 0.4 });
    } else if (kind === "rocket") {
      noise(0.32, 1100, 120, { gain: 0.34, q: 0.9, echo: 0.3 });
      tone(190, 45, 0.3, { type: "square", gain: 0.14 });
      noise(0.16, 400, 1800, { gain: 0.14, q: 1.5 });
    } else if (kind === "shotgun") {
      noise(0.23, 2100, 140, { gain: 0.4, q: 0.7, echo: 0.25 });
      tone(135, 42, 0.18, { type: "square", gain: 0.18 });
      tone(70, 36, 0.22, { type: "sine", gain: 0.22 });
    } else if (kind === "smg") {
      noise(0.055, 3000, 900, { gain: 0.16, q: 1.1 });
      tone(360, 130, 0.045, { type: "square", gain: 0.07 });
    } else {
      noise(0.085, 2400, 500, { gain: 0.2, q: 1 });
      tone(460, 150, 0.065, { type: "square", gain: 0.08 });
      tone(900, 300, 0.04, { type: "triangle", gain: 0.05 });
    }
  },
  enemyShot() {
    if (!throttle("eshot", 70)) return;
    tone(220, 110, 0.09, { type: "sawtooth", gain: 0.055 });
    noise(0.06, 1200, 500, { gain: 0.06, q: 1.5 });
  },
  hit() {
    if (!throttle("hit", 28)) return;
    noise(0.055, 1900, 650, { gain: 0.13, q: 2 });
    tone(340, 180, 0.04, { type: "triangle", gain: 0.05 });
  },
  crit() {
    if (!throttle("crit", 60)) return;
    tone(1000, 500, 0.08, { type: "square", gain: 0.1 });
    noise(0.08, 2600, 900, { gain: 0.1 });
  },
  boom() {
    if (!throttle("boom", 55)) return;
    noise(0.5, 750, 45, { gain: 0.44, q: 0.6, echo: 0.45 });
    tone(105, 28, 0.45, { type: "sine", gain: 0.4, echo: 0.3 });
    noise(0.12, 2800, 600, { gain: 0.18, q: 1.6 });
  },
  bigBoom() {
    noise(0.9, 900, 30, { gain: 0.55, q: 0.5, echo: 0.6, attack: 0.01 });
    tone(80, 22, 0.9, { type: "sine", gain: 0.5, echo: 0.5 });
    tone(150, 40, 0.5, { type: "sawtooth", gain: 0.16 });
    noise(0.3, 3200, 400, { gain: 0.24, q: 1.4 });
  },
  hurt() {
    tone(300, 60, 0.36, { type: "sawtooth", gain: 0.24 });
    noise(0.24, 1000, 160, { gain: 0.22, q: 0.8 });
    tone(120, 50, 0.3, { type: "square", gain: 0.12 });
  },
  dash() {
    noise(0.2, 500, 3200, { gain: 0.2, q: 1.4, attack: 0.02 });
    tone(300, 900, 0.14, { type: "triangle", gain: 0.08 });
  },
  pickup() {
    tone(540, 820, 0.1, { type: "triangle", gain: 0.16 });
    tone(820, 1240, 0.12, { type: "triangle", gain: 0.14, delay: 0.08 });
  },
  ult() {
    tone(72, 26, 1.1, { type: "sine", gain: 0.5, echo: 0.4 });
    noise(1, 3400, 60, { gain: 0.5, q: 0.6, attack: 0.02, echo: 0.4 });
    tone(920, 90, 0.8, { type: "sawtooth", gain: 0.18, delay: 0.02 });
    noise(0.25, 5000, 700, { gain: 0.22, q: 2 });
  },
  bossIntro() {
    tone(58, 34, 2.2, { type: "sawtooth", gain: 0.3, echo: 0.6 });
    tone(116, 40, 2, { type: "square", gain: 0.1, echo: 0.5 });
    noise(2.1, 700, 60, { gain: 0.3, q: 0.7, attack: 0.5, echo: 0.5 });
    noise(0.5, 3200, 600, { gain: 0.2, q: 1.4, delay: 1.4 });
  },
  phase() {
    tone(150, 45, 0.9, { type: "sawtooth", gain: 0.28, echo: 0.4 });
    noise(0.7, 2400, 100, { gain: 0.34, q: 0.8, echo: 0.4 });
    tone(600, 1200, 0.35, { type: "triangle", gain: 0.14, delay: 0.1 });
  },
  laserCharge() {
    tone(240, 1500, 0.75, { type: "sawtooth", gain: 0.13, filter: 3000, echo: 0.3 });
    noise(0.75, 500, 2500, { gain: 0.1, q: 3, attack: 0.2 });
  },
  laserFire() {
    noise(0.35, 5000, 800, { gain: 0.3, q: 2, echo: 0.4 });
    tone(1700, 300, 0.3, { type: "sawtooth", gain: 0.15 });
    tone(90, 50, 0.35, { type: "sine", gain: 0.3 });
  },
  slam() {
    noise(0.45, 420, 40, { gain: 0.42, q: 0.8, echo: 0.35 });
    tone(85, 24, 0.5, { type: "sine", gain: 0.42 });
  },
  summon() {
    for (let i = 0; i < 4; i++) {
      tone(180 + i * 90, 420 + i * 120, 0.16, { type: "triangle", gain: 0.08, delay: i * 0.07 });
    }
    noise(0.4, 900, 300, { gain: 0.14, q: 1.2, echo: 0.3 });
  },
  rain() {
    for (let i = 0; i < 5; i++) noise(0.12, 2000 + i * 200, 300, { gain: 0.07, q: 2, delay: i * 0.05 });
  },
  mine() {
    tone(700, 700, 0.08, { type: "square", gain: 0.06 });
    tone(1050, 1050, 0.06, { type: "square", gain: 0.05, delay: 0.1 });
  },
  gameover() {
    tone(230, 45, 1.2, { type: "sawtooth", gain: 0.25, echo: 0.6 });
    noise(1.1, 700, 50, { gain: 0.3, q: 0.7, echo: 0.4 });
    tone(120, 40, 0.9, { type: "square", gain: 0.14, delay: 0.2 });
  },
  step() {
    // soft wooden tap for the walk-on footfalls
    noise(0.07, 300, 110, { gain: 0.13, q: 1.4, qtype: "lowpass" });
  },
  whoosh() {
    noise(0.45, 1800, 220, { gain: 0.2, q: 0.7, attack: 0.06, echo: 0.4 });
    tone(430, 90, 0.42, { type: "sine", gain: 0.08 });
  },
  streak() {
    tone(700, 1400, 0.18, { type: "triangle", gain: 0.18, echo: 0.3 });
    tone(1100, 1900, 0.22, { type: "triangle", gain: 0.12, delay: 0.13 });
    noise(0.2, 3000, 900, { gain: 0.08, q: 2 });
  },
  levelClear() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      tone(f, f * 1.01, 0.3, { type: "triangle", gain: 0.15, delay: i * 0.13, echo: 0.35 });
      tone(f / 2, f / 2, 0.4, { type: "sine", gain: 0.1, delay: i * 0.13 });
    });
  },
};
