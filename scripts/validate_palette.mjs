#!/usr/bin/env node
// Re-runs every contrast row recorded in docs/DESIGN.md section 7.
//
// Reads the hexes straight out of src/index.css so the check can never drift from what ships.
// WCAG 2 relative luminance for contrast; CIEDE2000 after full-severity protan/deutan/tritan
// simulation for pair separation. Floors: 4.5:1 text, 3:1 non-text marks, dE00 15 normal and
// 8 CVD for any pair that must read as distinct.
//
// Usage: npm run palette        (exits non-zero if any row fails)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

/** Pull a token's value out of a given theme block. */
function block(name) {
  if (name === 'light') {
    const m = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    return m[1];
  }
  const m = css.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/);
  return m[1];
}
const blocks = { light: block('light'), dark: block('dark') };
function tok(mode, name) {
  const m = blocks[mode].match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found in ${mode} block`);
  return m[1].toLowerCase();
}

// --- colour math -----------------------------------------------------------
const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => {
  const [r, g, b] = srgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

function lab(h) {
  let [r, g, b] = srgb(h).map(lin);
  let X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [X, Y, Z] = [f(X), f(Y), f(Z)];
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

function ciede2000(h1, h2) {
  const [L1, a1, b1] = lab(h1);
  const [L2, a2, b2] = lab(h2);
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G);
  const ap2 = a2 * (1 + G);
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const deg = (r) => (r * 180) / Math.PI;
  const hp = (b, ap) => (b === 0 && ap === 0 ? 0 : (deg(Math.atan2(b, ap)) + 360) % 360);
  const hp1 = hp(b1, ap1);
  const hp2 = hp(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * Math.PI) / 360);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hbp < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos(((hbp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hbp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbp - 63) * Math.PI) / 180);
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt =
    -2 *
    Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) *
    Math.sin((60 * Math.exp(-(((hbp - 275) / 25) ** 2)) * Math.PI) / 180);
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

// Brettel/Vienot-style full-severity dichromat simulation in linear sRGB.
const CVD = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
const hex = (n) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0');
function simulate(h, kind) {
  const [r, g, b] = srgb(h).map(lin);
  const m = CVD[kind];
  const out = [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ].map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  return '#' + out.map(hex).join('');
}
const worstCvd = (a, b) =>
  Math.min(...Object.keys(CVD).map((k) => ciede2000(simulate(a, k), simulate(b, k))));

// --- the rows ---------------------------------------------------------------
let failed = 0;
const rows = [];
function row(label, value, floor, unit) {
  const ok = value >= floor;
  if (!ok) failed++;
  rows.push({ label, value, floor, unit, ok });
}

for (const mode of ['light', 'dark']) {
  const surface = tok(mode, 'al-surface');
  const plane = tok(mode, 'al-plane');
  const sunken = tok(mode, 'al-surface-sunken');
  const T = (n) => tok(mode, n);

  // Text on all three surfaces.
  let worst = Infinity;
  for (const ink of ['al-ink', 'al-ink-secondary', 'al-ink-muted'])
    for (const s of [plane, surface, sunken]) worst = Math.min(worst, contrast(T(ink), s));
  row(`${mode}: nine ink/surface text pairs`, worst, 4.5, ':1');

  // Marks on the card surface.
  for (const mark of ['al-viz-ahead', 'al-viz-behind', 'al-viz-voo', 'al-viz-estimate'])
    row(`${mode}: ${mark} on card`, contrast(T(mark), surface), 3, ':1');

  // Status colours.
  let sw = Infinity;
  for (const st of ['good', 'warning', 'serious', 'critical'])
    sw = Math.min(sw, contrast(T(`al-status-${st}`), surface));
  row(`${mode}: weakest status mark`, sw, 3, ':1');

  // Accent, brand surface, and the ink that sits on each.
  row(`${mode}: accent on plane`, contrast(T('al-accent'), plane), 3, ':1');
  row(`${mode}: accent-ink on accent`, contrast(T('al-accent-ink'), T('al-accent')), 4.5, ':1');
  row(
    `${mode}: brand-surface-ink on brand surface`,
    contrast(T('al-brand-surface-ink'), T('al-brand-surface')),
    4.5,
    ':1',
  );

  // Ramp labels against their own step.
  let rw = Infinity;
  for (let i = 1; i <= 7; i++) rw = Math.min(rw, contrast(T(`al-ramp-${i}-ink`), T(`al-ramp-${i}`)));
  row(`${mode}: weakest ramp label`, rw, 4.5, ':1');

  // The pairs that must stay distinguishable, including under CVD.
  const pairs = [
    ['ahead', 'behind', 'al-viz-ahead', 'al-viz-behind'],
    ['ahead', 'benchmark', 'al-viz-ahead', 'al-viz-voo'],
    ['behind', 'benchmark', 'al-viz-behind', 'al-viz-voo'],
    ['ahead', 'estimate', 'al-viz-ahead', 'al-viz-estimate'],
    ['behind', 'estimate', 'al-viz-behind', 'al-viz-estimate'],
  ];
  for (const [n1, n2, t1, t2] of pairs) {
    row(`${mode}: ${n1}/${n2} separation (normal)`, ciede2000(T(t1), T(t2)), 15, ' dE00');
    row(`${mode}: ${n1}/${n2} separation (worst CVD)`, worstCvd(T(t1), T(t2)), 8, ' dE00');
  }

  // The convention this design deliberately rejects. Documented as a FAIL on purpose.
  const gr = worstCvd(T('al-status-good'), T('al-viz-behind'));
  rows.push({
    label: `${mode}: green/red convention (rejected by design)`,
    value: gr,
    floor: 8,
    unit: ' dE00',
    ok: true,
    note: gr < 8 ? 'FAILS the CVD floor, as DESIGN 2.2 claims' : 'unexpectedly passes - revisit DESIGN 2.2',
  });
}

const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  const val = `${r.value.toFixed(2)}${r.unit}`;
  console.log(
    `${mark}  ${r.label.padEnd(w)}  ${val.padStart(11)}  (floor ${r.floor}${r.unit})${r.note ? '  ' + r.note : ''}`,
  );
}
console.log(
  failed ? `\n${failed} row(s) FAILED. Fix the tokens or justify the change in docs/DESIGN.md section 7.` : '\nAll rows pass.',
);
process.exit(failed ? 1 : 0);
