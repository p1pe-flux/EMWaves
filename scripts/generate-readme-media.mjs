#!/usr/bin/env node
/** Deterministic, text-free README animations; never opens or records a browser. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs/media');
const scratch = path.join(root, 'test-results/readme-media');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const preview = args.includes('--preview');
const kinds = ['smith', 'single-stub', 'quarter-wave'];
if (only !== null && !kinds.includes(only)) throw new Error('--only accepts smith, single-stub, or quarter-wave.');
const W = 1200, H = 720, rasterWidth = 1000, rasterHeight = 600;
const C = { background: '#f5f4ef', ink: '#243c43', muted: '#6f7e80', teal: '#1c666b', coral: '#c56342', paper: '#fdfdfa', line: '#dce1db' };
const escape = (text) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function svgOnly(Component, props, x, y, w, h, prefix, transformerOpacity = 1) {
  const rendered = renderToStaticMarkup(React.createElement(Component, props));
  let svg = rendered.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  if (!svg) throw new Error('Component did not return an SVG.');
  // Labels remain in the application. Only these documentation exports omit them.
  svg = svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, '');
  svg = svg.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
  if (transformerOpacity < 1) svg = svg.replace(/<g class="qw-diagram__(?:transformer|reading-plane)"/g, tag => `${tag} opacity="${transformerOpacity}"`);
  return svg.replace(/<svg\b[^>]*>/, tag => tag.replace(/\s(?:style|width|height)="[^"]*"/g, '').replace('<svg', `<svg x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMin meet"`));
}
function modelStyles(source) {
  return source.match(/\.[^{}]+\{[^{}]*\}/g)?.filter(rule => /^(?:\.smith-(?:paper|grid|axis|boundary|scale|tick|reactance|center|measurement|swr|gamma|phase|trajectory|point|load|input)|\.transmission-line-diagram__|\.qw-diagram__)/.test(rule.trim())).join('\n') ?? '';
}
async function ffmpeg(args) {
  const child = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  let error = '';
  child.stderr.on('data', chunk => { error += chunk.toString(); });
  const [code] = await once(child, 'close');
  if (code !== 0) throw new Error(error || `ffmpeg exited with ${code}`);
}
async function encode(frameCount, fps, frameAt, destination, colors = 96) {
  const frames = path.join(scratch, path.basename(destination, '.gif') + '-frames');
  await fs.rm(frames, { recursive: true, force: true });
  await fs.mkdir(frames, { recursive: true });
  let previousSvg = '', previousPng;
  for (let i = 0; i < frameCount; i++) {
    const svg = frameAt(i / fps);
    const png = svg === previousSvg ? previousPng : await sharp(Buffer.from(svg)).resize({ width: rasterWidth }).png().toBuffer();
    await fs.writeFile(path.join(frames, `frame-${String(i).padStart(4, '0')}.png`), png);
    previousSvg = svg; previousPng = png;
    if ((i + 1) % (fps * 2) === 0) console.log(`${path.basename(destination)}: rendered ${i + 1}/${frameCount} frames`);
  }
  // Two disk-backed passes avoid retaining the entire decoded animation for palette generation.
  const input = ['-framerate', String(fps), '-start_number', '0', '-i', path.join(frames, 'frame-%04d.png')];
  const palette = path.join(frames, 'palette.png');
  await ffmpeg([...input, '-vf', `palettegen=max_colors=${colors}:stats_mode=full`, '-frames:v', '1', '-update', '1', palette]);
  await ffmpeg([...input, '-i', palette, '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', '-final_delay', String(100 / fps), '-gifflags', '+offsetting+transdiff', destination]);
  const metadata = await sharp(destination, { animated: true, limitInputPixels: false }).metadata();
  if (metadata.width !== rasterWidth || metadata.pageHeight !== rasterHeight || metadata.pages !== frameCount
    || metadata.loop !== 0 || metadata.delay?.length !== frameCount || metadata.delay.some(delay => delay !== 1000 / fps)) {
    throw new Error('GIF dimensions, frame timing, or infinite loop failed verification: ' + destination);
  }
  await fs.rm(frames, { recursive: true, force: true });
}

const vite = await createServer({ root, server: { middlewareMode: true, watch: null }, appType: 'custom' });
try {
  const scenes = await vite.ssrLoadModule('/scripts/readme-scenes.ts');
  const { SmithChart } = await vite.ssrLoadModule('/src/components/SmithChart.tsx');
  const { SingleStubDiagram } = await vite.ssrLoadModule('/src/components/SingleStubDiagram.tsx');
  const { QuarterWaveDiagram } = await vite.ssrLoadModule('/src/components/QuarterWaveDiagram.tsx');
  const projection = await vite.ssrLoadModule('/src/domain/smithProjection.ts');
  const sources = await Promise.all(['src/styles/global.css', 'src/styles/transmission-line-diagram.css', 'src/styles/quarter-wave.css'].map(file => fs.readFile(path.join(root, file), 'utf8')));
  const paletteVars = { '--ink': C.ink, '--muted': C.muted, '--teal': C.teal, '--coral': C.coral, '--line': C.line, '--paper': C.paper };
  const css = sources.map(modelStyles).join('\n').replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_, name) => paletteVars[name] ?? C.ink);

  function renderProjection(progress) {
    const bounds = { minRe: -1.45, maxRe: 1.45, minIm: -1.18, maxIm: 1.18 };
    const curves = projection.projectionGrid(progress, { bounds });
    const order = { active: 0, passive: 1, boundary: 2 };
    curves.sort((a, b) => order[a.region] - order[b.region]);
    const point = p => ({ x: 360 + 230 * p.re, y: 300 - 230 * p.im });
    const paths = curves.flatMap(curve => curve.paths.map(points => {
      const major = Number.isInteger(curve.value);
      const stroke = curve.region === 'boundary' || (curve.region === 'passive' && major) ? C.ink : curve.region === 'active' ? C.coral : C.teal;
      const opacity = curve.region === 'boundary' ? 0.8 : curve.region === 'active' ? major ? 0.65 : 0.42 : major ? 0.8 : 0.6;
      const d = points.map((p, i) => { const s = point(p); return `${i ? 'L' : 'M'}${s.x.toFixed(2)},${s.y.toFixed(2)}`; }).join(' ');
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${major ? 1.1 : 0.8}" opacity="${opacity}"/>`;
    })).join('');
    const markers = [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 1e12, im: 0 }].map(z => {
      const p = projection.projectImpedance(z, progress);
      if (!p || p.re < bounds.minRe || p.re > bounds.maxRe || Math.abs(p.im) > bounds.maxIm) return '';
      const s = point(p);
      return `<circle cx="${s.x}" cy="${s.y}" r="4" fill="${C.teal}" stroke="${C.background}" stroke-width="2"/>`;
    }).join('');
    return `<svg x="180" y="10" width="840" height="700" viewBox="0 0 720 600"><defs><clipPath id="projection-clip"><rect x="20" y="20" width="680" height="560"/></clipPath></defs><g clip-path="url(#projection-clip)">${paths}</g>${markers}</svg>`;
  }
  function render(kind, time) {
    const s = scenes.getReadmeScene(kind, time); let image = '';
    if (s.projection) image = renderProjection(s.projection.progress);
    if (s.chart) image = svgOnly(SmithChart, { solution: null, length: 0, showCurves: false, showGamma: false, showSwr: false, interactive: false, onSelectReflection() {}, construction: s.chart }, 0, 10, 700, 700, 'chart');
    if (s.circuit) {
      const { kind: circuitKind, transformerOpacity, ...props } = s.circuit;
      image += svgOnly(circuitKind === 'stub' ? SingleStubDiagram : QuarterWaveDiagram, props, 700, 180, 490, 360, 'circuit', transformerOpacity);
    }
    if (/<(?:text|foreignObject)\b/.test(image)) throw new Error('Visible text leaked into animation: ' + kind);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${escape(s.title)}</title><desc>Generated directly from EMWaves models and SVG components.</desc><style>${css}</style><rect width="${W}" height="${H}" fill="${C.background}"/><g opacity="${s.contentOpacity}">${image}</g></svg>`;
  }
  await fs.mkdir(output, { recursive: true }); await fs.mkdir(scratch, { recursive: true });
  for (const kind of only ? [only] : kinds) {
    const meta = scenes.README_SCENE_META[kind], fps = meta.fps;
    const filename = kind === 'smith' ? 'smith-chart' : kind;
    if (!preview && !Number.isInteger(100 / fps)) throw new Error('GIF frame rate must use an integer centisecond delay.');
    for (const [i, fraction] of [0.02, 0.2, 0.4, 0.6, 0.8, 0.93].entries()) {
      const svg = render(kind, meta.durationSeconds * fraction);
      await fs.writeFile(path.join(scratch, `${filename}-${i}.svg`), svg);
      await sharp(Buffer.from(svg)).resize({ width: rasterWidth }).png().toFile(path.join(scratch, `${filename}-${i}.png`));
    }
    if (preview) { console.log(`${kind}: SVG and PNG previews in test-results/readme-media/`); continue; }
    const target = path.join(output, filename + '.gif');
    const temporary = path.join(scratch, filename + '.gif');
    await encode(Math.round(meta.durationSeconds * fps), fps, time => render(kind, time), temporary, kind === 'smith' ? 64 : 96);
    await fs.rename(temporary, target);
    console.log(`${path.relative(root, target)}: ${(await fs.stat(target)).size} bytes, ${fps} fps, ${meta.durationSeconds}s`);
  }
} finally { await vite.close(); }
