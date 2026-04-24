let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let oscillators: OscillatorNode[] = [];
let lfo: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  return ctx;
}

function stopVoices() {
  oscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      // ignore
    }
    osc.disconnect();
  });
  oscillators = [];

  if (lfo) {
    try {
      lfo.stop();
    } catch {
      // ignore
    }
    lfo.disconnect();
    lfo = null;
  }
  lfoGain?.disconnect();
  lfoGain = null;
}

export async function setAmbientThemeSound(baseHz: number, enabled: boolean) {
  const context = getContext();
  if (!context) return;

  if (context.state === "suspended") {
    await context.resume().catch(() => undefined);
  }

  if (!enabled) {
    stopVoices();
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(context.currentTime);
      masterGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.12);
    }
    return;
  }

  if (!masterGain) {
    masterGain = context.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(context.destination);
  }

  stopVoices();

  const freqs = [baseHz, baseHz * 1.25, baseHz * 1.5];
  const nextOscillators = freqs.map((freq, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = index === 1 ? "triangle" : "sine";
    osc.frequency.value = freq;
    gain.gain.value = index === 1 ? 0.018 : 0.012;
    osc.connect(gain).connect(masterGain!);
    osc.start();
    return osc;
  });

  const nextLfo = context.createOscillator();
  const nextLfoGain = context.createGain();
  nextLfo.type = "sine";
  nextLfo.frequency.value = 0.18;
  nextLfoGain.gain.value = 6;
  nextLfo.connect(nextLfoGain);
  nextOscillators.forEach((osc) => nextLfoGain.connect(osc.frequency));
  nextLfo.start();

  oscillators = nextOscillators;
  lfo = nextLfo;
  lfoGain = nextLfoGain;

  masterGain.gain.cancelScheduledValues(context.currentTime);
  masterGain.gain.setTargetAtTime(0.045, context.currentTime, 0.25);
}
