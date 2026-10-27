// Builds the README's SVGs in assets/ (light and dark). Text is converted to
// outlines because GitHub serves SVGs as images and won't load web fonts.
//   npm install && npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import opentype from 'opentype.js';

const load = (pkg, file) =>
  opentype.parse(readFileSync(new URL(`../node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url)).buffer);
const DISPLAY = load('martian-mono', 'martian-mono-latin-800-normal.woff');
const MONO = load('fragment-mono', 'fragment-mono-latin-400-normal.woff');

// Same palette as tunasakar.com.
const THEMES = {
  light: { bg: '#f6f5f1', ink: '#111110', muted: '#6a6862', rule: '#d9d6ce', panel: '#eeece6', accent: '#2b48f0', danger: '#c2341b' },
  dark: { bg: '#111110', ink: '#ecebe6', muted: '#8f8c84', rule: '#2c2b28', panel: '#1a1a18', accent: '#8c9bff', danger: '#ff7a5c' },
};

// opentype.js 2.0's toPathData() emits NaN for some glyphs, so serialise the
// (finite) path commands ourselves.
const n = (v) => (Math.round(v * 10) / 10).toString();
function pathData(path) {
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join('');
}

// Outlines a string glyph by glyph. `~~text~~` is struck through.
// Returns the SVG and the advance width so callers can keep writing on the line.
function text(str, x, y, { font = MONO, size = 16, fill, spacing = 0, cls = '' }) {
  let d = '';
  let cx = x;
  const strikes = [];
  let strikeFrom = null;
  for (let i = 0; i < str.length; i++) {
    if (str.startsWith('~~', i)) {
      if (strikeFrom === null) strikeFrom = cx;
      else strikes.push([strikeFrom, cx - spacing]), (strikeFrom = null);
      i++;
      continue;
    }
    const glyph = font.charToGlyph(str[i]);
    d += pathData(glyph.getPath(cx, y, size));
    cx += (glyph.advanceWidth / font.unitsPerEm) * size + spacing;
  }
  const lines = strikes
    .map(([a, b]) => `<path d="M${a.toFixed(1)} ${(y - size * 0.32).toFixed(1)}H${b.toFixed(1)}" stroke="${fill}" stroke-width="1.5"/>`)
    .join('');
  const c = cls ? ` class="${cls}"` : '';
  return { svg: `<g${c}><path d="${d}" fill="${fill}"/>${lines}</g>`, width: cx - x };
}

// Isometric projection: +x runs right-down, +z left-down, +y up.
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
function iso(ox, oy, s) {
  return ([x, y, z]) => [ox + (x - z) * COS * s, oy + (x + z) * SIN * s - y * s];
}

// The three faces you can see of an axis-aligned box.
function box(p, [x, z], [w, d, h], { fill, stroke, faceCls = '' }) {
  const poly = (pts) =>
    `<polygon${faceCls ? ` class="${faceCls}"` : ''} points="${pts
      .map(p)
      .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
      .join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  return [
    poly([[x, h, z], [x + w, h, z], [x + w, h, z + d], [x, h, z + d]]),
    poly([[x, 0, z + d], [x + w, 0, z + d], [x + w, h, z + d], [x, h, z + d]]),
    poly([[x + w, 0, z], [x + w, 0, z + d], [x + w, h, z + d], [x + w, h, z]]),
  ].join('');
}

const ROLES = [
  'Cloud-Native Architecture · Enterprise AI · API-First · SRE',
  'Event-Driven Systems · Automation · DevOps · Observability · DevEx',
];

function banner(t) {
  const W = 1200;
  const H = 380;
  const parts = [];

  // Name: "tuna | sakar", like the site's header.
  let x = 48;
  for (const [s, fill] of [['tuna', t.ink], [' | ', t.accent], ['sakar', t.ink]]) {
    const r = text(s, x, 104, { font: DISPLAY, size: 58, fill, spacing: -2.4 });
    parts.push(r.svg);
    x += r.width;
  }
  ROLES.forEach((line, i) => parts.push(text(line, 50, 156 + i * 30, { size: 19, fill: t.ink }).svg));

  // The ReplicaSet doing its job, on a 6 s loop.
  const log = [
    ['$ kubectl -n tuna delete pod aws-vhl76zgvj5-kbbrd', t.muted, ''],
    ['pod "aws-vhl76zgvj5-kbbrd" deleted', t.danger, 'l1'],
    ['pod/aws-vhl76zgvj5-x2k8q   ContainerCreating', t.accent, 'l2'],
    ['pod/aws-vhl76zgvj5-x2k8q   Running', t.muted, 'l3'],
  ];
  log.forEach(([s, fill, cls], i) => parts.push(text(s, 50, 248 + i * 26, { size: 15, fill, cls }).svg));
  parts.push(`<rect class="cursor" x="50" y="342" width="9" height="16" fill="${t.ink}"/>`);

  // Cluster: control plane at the back, one worker with five pods.
  // Scale 36 keeps the cluster right of the longest role line (~825 px).
  const S = 36;
  const p = iso(960, 104, S);
  const pod = (at, extra = {}) => box(p, at, [0.8, 0.8, 0.8], { fill: t.bg, stroke: t.ink, ...extra });
  const wireFrom = p([2, 0.3, -1.9]);
  const wireTo = p([2, 0.3, 0]);
  parts.push(box(p, [0, -3.2], [4, 1.3, 0.3], { fill: t.panel, stroke: t.ink }));
  parts.push(
    `<path d="M${wireFrom.map((n) => n.toFixed(1)).join(' ')}L${wireTo.map((n) => n.toFixed(1)).join(' ')}" stroke="${t.muted}" stroke-width="1.2" stroke-dasharray="6 5"/>`,
  );
  parts.push(box(p, [0, 0], [4, 3.2, 0.3], { fill: t.panel, stroke: t.ink }));
  // Pods sit on the slab (y offset 0.3), drawn back to front.
  const lift = (svg) => `<g transform="translate(0 ${(-0.3 * S).toFixed(1)})">${svg}</g>`;
  parts.push(lift(pod([0.4, 0.4])));
  parts.push(lift(pod([1.6, 0.4])));
  parts.push(lift(pod([2.8, 0.4])));
  parts.push(lift(pod([1.0, 1.9])));
  // The victim: an outer group places it, the inner one animates.
  parts.push(lift(`<g class="victim">${pod([2.2, 1.9], { faceCls: 'vface' })}</g>`));

  // Labels centred on a point: above the control plane, under the node.
  const label = (s, [lx, ly]) => {
    const w = text(s, 0, 0, { size: 13 }).width;
    return text(s, lx - w / 2, ly, { size: 13, fill: t.muted }).svg;
  };
  const [cpx, cpy] = p([0, 0.3, -3.2]);
  parts.push(label('control-plane', [cpx + 30, cpy - 12]));
  const [nx, ny] = p([4, 0, 3.2]);
  parts.push(label('node-01', [nx, ny + 24]));

  const css = `
    @keyframes victim {
      0%, 30% { opacity: 1; transform: translateY(0); }
      38% { opacity: 0; transform: translateY(-12px); }
      56% { opacity: 0; transform: translateY(-80px); }
      70%, 100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes vface {
      0%, 30% { fill: ${t.bg}; stroke: ${t.ink}; }
      31%, 38% { fill: ${t.bg}; stroke: ${t.danger}; }
      56%, 80% { fill: ${t.accent}; stroke: ${t.ink}; }
      88%, 100% { fill: ${t.bg}; stroke: ${t.ink}; }
    }
    @keyframes l1 { 0%, 31% { opacity: 0; } 33%, 100% { opacity: 1; } }
    @keyframes l2 { 0%, 57% { opacity: 0; } 59%, 100% { opacity: 1; } }
    @keyframes l3 { 0%, 85% { opacity: 0; } 87%, 100% { opacity: 1; } }
    @keyframes blink { 50% { opacity: 0; } }
    .victim { animation: victim 6s infinite; }
    .vface { animation: vface 6s infinite; }
    .l1 { animation: l1 6s infinite; }
    .l2 { animation: l2 6s infinite; }
    .l3 { animation: l3 6s infinite; }
    .cursor { animation: blink 1s steps(1) infinite; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<title>tuna | sakar: ${ROLES.join(' · ')}</title>
<style>${css}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="${t.bg}" stroke="${t.rule}"/>
${parts.join('\n')}
</svg>
`;
}

// The "What I Do" table as `kubectl get pods` output.
const STACK = [
  ['platform-cloud', 'AWS, Azure, Kubernetes, ~~Terraform~~ Pulumi, Docker, Linux'],
  ['cicd', 'ArgoCD, Jenkins, GitOps, Pipelines'],
  ['architecture', 'Cloud-Native, API-First, Event-Driven, IIoT'],
  ['enterprise-ai', 'Azure AI Foundry, Amazon Bedrock'],
  ['security', 'AuthN/AuthZ, OAuth2, SSL/TLS, Zero Trust'],
  ['sre-observability', 'ELK Stack, New Relic'],
  ['languages', 'Go, Python, JS, Shell'],
];

// Kube-style generated suffixes, stable per name.
function suffix(seed, len) {
  const abc = 'bcdfghjklmnpqrstvwxz2456789';
  let h = 0x811c9dc5;
  let out = '';
  for (let i = 0; i < len; i++) {
    for (const ch of seed + i) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    out += abc[h % abc.length];
  }
  return out;
}

function pods(t) {
  const size = 15;
  const cw = (MONO.charToGlyph('a').advanceWidth / MONO.unitsPerEm) * size;
  const cols = [0, 34, 41, 51];
  const rowH = 28;
  const W = 1200;
  const H = 48 + rowH * (STACK.length + 2) + 12;
  const at = (col) => 48 + cols[col] * cw;
  const parts = [];

  let x = 48;
  for (const [s, fill] of [['$ ', t.muted], ['kubectl -n tuna get pods -L stack', t.accent]]) {
    const r = text(s, x, 52, { size, fill });
    parts.push(r.svg);
    x += r.width;
  }
  ['NAME', 'READY', 'STATUS', 'STACK'].forEach((h, i) => parts.push(text(h, at(i), 52 + rowH * 1.4, { size, fill: t.muted }).svg));
  STACK.forEach(([name, stack], r) => {
    const y = 52 + rowH * (r + 2.4);
    const pod = `${name}-${suffix(`rs:${name}`, 6)}-${suffix(name, 5)}`;
    parts.push(text(pod, at(0), y, { size, fill: t.ink }).svg);
    parts.push(text('1/1', at(1), y, { size, fill: t.ink }).svg);
    parts.push(text('Running', at(2), y, { size, fill: t.accent }).svg);
    parts.push(text(stack, at(3), y, { size, fill: t.ink }).svg);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<title>What I do: ${STACK.map(([n, s]) => `${n}: ${s.replace(/~~[^~]+~~ /g, '')}`).join('; ')}</title>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="${t.bg}" stroke="${t.rule}"/>
${parts.join('\n')}
</svg>
`;
}

mkdirSync(new URL('../assets/', import.meta.url), { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  for (const [kind, render] of [['banner', banner], ['stack', pods]]) {
    const file = new URL(`../assets/${kind}-${name}.svg`, import.meta.url);
    writeFileSync(file, render(theme));
    console.log(`assets/${kind}-${name}.svg`);
  }
}
