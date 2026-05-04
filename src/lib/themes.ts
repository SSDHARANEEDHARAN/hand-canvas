// 24 visual themes. Each defines background + glow + accent + primary HSL tokens
// plus a short SFX descriptor used by playThemeSound().

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  // HSL "h s% l%" strings, fed into CSS vars
  background: string;
  foreground: string;
  primary: string;
  primaryFg: string;
  glow: string;   // --gesture-glow
  accent: string; // --gesture-accent
  // Sound descriptor
  sound: { freq: number; type: OscillatorType; duration?: number };
}

export const THEMES: Theme[] = [
  { id: "midnight",   name: "Midnight Violet", emoji: "🌌", background: "240 30% 4%",  foreground: "210 40% 98%", primary: "280 90% 65%", primaryFg: "0 0% 100%", glow: "280 90% 65%", accent: "190 95% 60%", sound: { freq: 440, type: "sine" } },
  { id: "aurora",     name: "Aurora",          emoji: "🌠", background: "200 60% 6%",  foreground: "150 80% 95%", primary: "150 90% 55%", primaryFg: "180 50% 5%",  glow: "150 90% 55%", accent: "280 90% 70%", sound: { freq: 523, type: "sine" } },
  { id: "sunset",     name: "Sunset",          emoji: "🌅", background: "20 50% 8%",   foreground: "30 90% 96%",  primary: "20 95% 60%",  primaryFg: "20 60% 10%",  glow: "20 95% 60%",  accent: "330 90% 65%", sound: { freq: 392, type: "triangle" } },
  { id: "ocean",      name: "Deep Ocean",      emoji: "🌊", background: "210 80% 6%",  foreground: "200 50% 95%", primary: "200 95% 55%", primaryFg: "210 60% 10%", glow: "200 95% 55%", accent: "180 90% 60%", sound: { freq: 349, type: "sine" } },
  { id: "forest",     name: "Forest",          emoji: "🌲", background: "150 40% 5%",  foreground: "120 30% 95%", primary: "140 70% 50%", primaryFg: "150 50% 8%",  glow: "140 70% 50%", accent: "60 80% 60%",  sound: { freq: 329, type: "triangle" } },
  { id: "lava",       name: "Lava",            emoji: "🔥", background: "0 60% 6%",    foreground: "30 90% 96%",  primary: "10 95% 55%",  primaryFg: "0 0% 100%",   glow: "10 95% 55%",  accent: "40 100% 55%", sound: { freq: 220, type: "sawtooth" } },
  { id: "ice",        name: "Ice",             emoji: "❄️", background: "200 30% 10%", foreground: "200 30% 98%", primary: "190 85% 70%", primaryFg: "200 50% 10%", glow: "190 85% 70%", accent: "220 85% 75%", sound: { freq: 880, type: "sine" } },
  { id: "candy",      name: "Candy",           emoji: "🍭", background: "320 40% 10%", foreground: "320 40% 98%", primary: "320 95% 70%", primaryFg: "320 50% 10%", glow: "320 95% 70%", accent: "180 95% 65%", sound: { freq: 660, type: "square" } },
  { id: "cyberpunk",  name: "Cyberpunk",       emoji: "🤖", background: "270 60% 5%",  foreground: "180 80% 95%", primary: "320 100% 60%",primaryFg: "0 0% 100%",   glow: "320 100% 60%",accent: "180 100% 55%",sound: { freq: 587, type: "sawtooth" } },
  { id: "matrix",     name: "Matrix",          emoji: "💻", background: "120 40% 3%",  foreground: "120 80% 75%", primary: "120 100% 50%",primaryFg: "120 60% 5%",  glow: "120 100% 50%",accent: "120 60% 40%", sound: { freq: 440, type: "square" } },
  { id: "rose",       name: "Rose Gold",       emoji: "🌹", background: "350 30% 8%",  foreground: "30 50% 96%",  primary: "350 80% 65%", primaryFg: "0 0% 100%",   glow: "350 80% 65%", accent: "30 90% 70%",  sound: { freq: 494, type: "sine" } },
  { id: "lemon",      name: "Lemon Lime",      emoji: "🍋", background: "70 30% 8%",   foreground: "60 80% 96%",  primary: "70 95% 55%",  primaryFg: "60 60% 10%",  glow: "70 95% 55%",  accent: "100 80% 55%", sound: { freq: 698, type: "triangle" } },
  { id: "noir",       name: "Noir",            emoji: "⚫", background: "0 0% 4%",     foreground: "0 0% 95%",    primary: "0 0% 90%",    primaryFg: "0 0% 5%",     glow: "0 0% 70%",    accent: "0 0% 50%",    sound: { freq: 261, type: "sine" } },
  { id: "paper",      name: "Paper",           emoji: "📄", background: "40 20% 12%",  foreground: "40 20% 96%",  primary: "40 60% 70%",  primaryFg: "40 40% 10%",  glow: "40 60% 70%",  accent: "20 50% 60%",  sound: { freq: 392, type: "sine" } },
  { id: "galaxy",     name: "Galaxy",          emoji: "🪐", background: "260 50% 5%",  foreground: "260 30% 95%", primary: "260 90% 65%", primaryFg: "0 0% 100%",   glow: "260 90% 65%", accent: "200 90% 60%", sound: { freq: 466, type: "sine" } },
  { id: "neon",       name: "Neon",            emoji: "💡", background: "240 50% 5%",  foreground: "60 100% 95%", primary: "60 100% 60%", primaryFg: "240 60% 10%", glow: "60 100% 60%", accent: "300 100% 60%",sound: { freq: 784, type: "square" } },
  { id: "minty",      name: "Minty",           emoji: "🌿", background: "160 30% 8%",  foreground: "160 40% 96%", primary: "160 70% 55%", primaryFg: "160 50% 8%",  glow: "160 70% 55%", accent: "180 70% 60%", sound: { freq: 523, type: "triangle" } },
  { id: "blood",      name: "Blood Moon",      emoji: "🌑", background: "0 50% 5%",    foreground: "0 30% 95%",   primary: "0 90% 50%",   primaryFg: "0 0% 100%",   glow: "0 90% 50%",   accent: "30 80% 50%",  sound: { freq: 196, type: "sawtooth" } },
  { id: "skyblue",    name: "Sky",             emoji: "☁️", background: "210 50% 10%", foreground: "210 30% 98%", primary: "210 90% 65%", primaryFg: "210 60% 10%", glow: "210 90% 65%", accent: "180 80% 65%", sound: { freq: 587, type: "sine" } },
  { id: "amber",      name: "Amber",           emoji: "🍯", background: "30 40% 8%",   foreground: "40 80% 96%",  primary: "40 95% 55%",  primaryFg: "30 60% 10%",  glow: "40 95% 55%",  accent: "20 90% 60%",  sound: { freq: 415, type: "triangle" } },
  { id: "deepsea",    name: "Deep Sea",        emoji: "🐠", background: "220 70% 5%",  foreground: "190 50% 95%", primary: "180 90% 50%", primaryFg: "220 60% 10%", glow: "180 90% 50%", accent: "260 80% 60%", sound: { freq: 311, type: "sine" } },
  { id: "snow",       name: "Snowfall",        emoji: "🌨️", background: "210 30% 14%", foreground: "0 0% 98%",    primary: "210 30% 90%", primaryFg: "210 30% 15%", glow: "210 50% 85%", accent: "210 70% 70%", sound: { freq: 1046, type: "sine" } },
  { id: "volcano",    name: "Volcano",         emoji: "🌋", background: "10 60% 5%",   foreground: "30 80% 96%",  primary: "15 100% 55%", primaryFg: "0 0% 100%",   glow: "15 100% 55%", accent: "45 100% 55%", sound: { freq: 175, type: "sawtooth" } },
  { id: "pastel",     name: "Pastel Dream",    emoji: "🦄", background: "300 30% 12%", foreground: "300 30% 98%", primary: "300 70% 75%", primaryFg: "300 40% 15%", glow: "300 70% 75%", accent: "180 70% 75%", sound: { freq: 740, type: "triangle" } },
];

export const DEFAULT_THEME_ID = "midnight";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--foreground", theme.foreground);
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-foreground", theme.primaryFg);
  root.style.setProperty("--gesture-glow", theme.glow);
  root.style.setProperty("--gesture-accent", theme.accent);
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function playThemeSound(theme: Theme) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  const dur = theme.sound.duration ?? 0.35;

  // Two-tone chime: root + perfect fifth
  const tones = [theme.sound.freq, theme.sound.freq * 1.5];
  tones.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = theme.sound.type;
    osc.frequency.setValueAtTime(f, now);
    const g = c.createGain();
    const start = now + i * 0.06;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  });
}

const STORAGE_KEY = "gesture.theme.v1";
export function loadThemeId(): string {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_ID;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID;
}
export function saveThemeId(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}
