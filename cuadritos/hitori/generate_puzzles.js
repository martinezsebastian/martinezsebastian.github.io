#!/usr/bin/env node
'use strict';
// Usage: node generate_puzzles.js [size] [count]
// Examples:
//   node generate_puzzles.js 5 100   → 100 puzzles, 5×5
//   node generate_puzzles.js 7 50    → 50 puzzles,  7×7
// Output: puzzles.js (include via <script src="puzzles.js"> in index.html)

const N     = parseInt(process.argv[2]) || 5;
const COUNT = parseInt(process.argv[3]) || 100;
const NUMS  = Array.from({length: N}, (_, i) => i + 1);

const MIN_SHADED = Math.max(3, Math.floor(N * N * 0.12));
const MAX_SHADED = Math.floor(N * N * 0.28);

// ── Utilities ──────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function unshadedConnected(sh) {
  const unshaded = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!sh.has(`${r},${c}`)) unshaded.push([r, c]);
  if (!unshaded.length) return false;
  const visited = new Set();
  const q = [unshaded[0]];
  visited.add(`${unshaded[0][0]},${unshaded[0][1]}`);
  while (q.length) {
    const [r, c] = q.shift();
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r+dr, nc = c+dc, nk = `${nr},${nc}`;
      if (nr>=0 && nr<N && nc>=0 && nc<N && !sh.has(nk) && !visited.has(nk)) {
        visited.add(nk); q.push([nr, nc]);
      }
    }
  }
  return visited.size === unshaded.length;
}

// ── Step 1: random valid shading ───────────────────────────────

function genShading() {
  for (let att = 0; att < 800; att++) {
    const cells = shuffle(Array.from({length: N*N}, (_, i) => `${i/N|0},${i%N}`));
    const sh = new Set();
    for (const key of cells) {
      if (sh.size >= MAX_SHADED) break;
      const [r, c] = key.split(',').map(Number);
      let adj = false;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]])
        if (sh.has(`${r+dr},${c+dc}`)) { adj = true; break; }
      if (!adj && Math.random() < 0.35) sh.add(key);
    }
    if (sh.size >= MIN_SHADED && unshadedConnected(sh)) return sh;
  }
  return null;
}

// ── Step 2: fill unshaded (partial Latin square) ───────────────

function fillUnshaded(grid, sh) {
  const cells = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!sh.has(`${r},${c}`)) cells.push([r, c]);

  function bt(idx) {
    if (idx === cells.length) return true;
    const [r, c] = cells[idx];
    for (const v of shuffle(NUMS)) {
      let ok = true;
      for (let cc = 0; cc < N && ok; cc++)
        if (cc !== c && !sh.has(`${r},${cc}`) && grid[r][cc] === v) ok = false;
      for (let rr = 0; rr < N && ok; rr++)
        if (rr !== r && !sh.has(`${rr},${c}`) && grid[rr][c] === v) ok = false;
      if (ok) {
        grid[r][c] = v;
        if (bt(idx + 1)) return true;
        grid[r][c] = 0;
      }
    }
    return false;
  }
  return bt(0);
}

// ── Step 3: fill shaded cells with a duplicate number ──────────

function fillShaded(grid, sh) {
  for (const key of sh) {
    const [r, c] = key.split(',').map(Number);
    const cands = new Set();
    for (let cc = 0; cc < N; cc++) if (!sh.has(`${r},${cc}`)) cands.add(grid[r][cc]);
    for (let rr = 0; rr < N; rr++) if (!sh.has(`${rr},${c}`)) cands.add(grid[rr][c]);
    cands.delete(0);
    if (!cands.size) return false;
    grid[r][c] = shuffle([...cands])[0];
  }
  return true;
}

// ── Step 4: solver (stop at `limit` solutions) ─────────────────

function solve(puzzle, limit) {
  const solutions = [];
  const cur = new Set();

  function bt(pos) {
    if (solutions.length >= limit) return;

    // End-of-row duplicate check (fast prune)
    if (pos > 0 && pos % N === 0) {
      const row = (pos / N | 0) - 1;
      const seen = {};
      for (let c = 0; c < N; c++) {
        if (cur.has(`${row},${c}`)) continue;
        const v = puzzle[row][c];
        if (seen[v] !== undefined) return;
        seen[v] = c;
      }
    }

    if (pos === N * N) {
      for (let c = 0; c < N; c++) {
        const seen = {};
        for (let r = 0; r < N; r++) {
          if (cur.has(`${r},${c}`)) continue;
          const v = puzzle[r][c];
          if (seen[v] !== undefined) return;
          seen[v] = r;
        }
      }
      if (unshadedConnected(cur)) solutions.push(new Set(cur));
      return;
    }

    const r = pos / N | 0, c = pos % N, key = `${r},${c}`;

    // Partial column check for already-decided rows
    if (r > 0) {
      const seen = {};
      for (let rr = 0; rr < r; rr++) {
        if (cur.has(`${rr},${c}`)) continue;
        const v = puzzle[rr][c];
        if (seen[v] !== undefined) return;
        seen[v] = rr;
      }
    }

    bt(pos + 1);

    if (solutions.length < limit) {
      let adj = false;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]])
        if (cur.has(`${r+dr},${c+dc}`)) { adj = true; break; }
      if (!adj) {
        cur.add(key);
        bt(pos + 1);
        cur.delete(key);
      }
    }
  }

  bt(0);
  return solutions;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ── Main generator loop ────────────────────────────────────────

function tryGenerate() {
  const sh = genShading();
  if (!sh) return null;
  const grid = Array.from({length: N}, () => Array(N).fill(0));
  if (!fillUnshaded(grid, sh)) return null;
  if (!fillShaded(grid, sh)) return null;
  const sols = solve(grid, 2);
  if (sols.length === 1 && setsEqual(sols[0], sh))
    return { grid, shading: [...sh] };
  return null;
}

function main() {
  console.log(`Generating ${COUNT} Hitori puzzles, size ${N}×${N} ...`);
  const start = Date.now();
  const puzzles = [];
  let attempts = 0;

  while (puzzles.length < COUNT) {
    attempts++;
    const p = tryGenerate();
    if (p) {
      puzzles.push(p);
      process.stdout.write(`\r  ${puzzles.length}/${COUNT}  (${attempts} attempts)`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s — success rate ${(COUNT/attempts*100).toFixed(1)}%`);

  const out =
    `// Generated by generate_puzzles.js — do not edit manually.\n` +
    `// N=${N}, count=${COUNT}, generated ${new Date().toISOString().slice(0,10)}\n` +
    `const HITORI_PUZZLES = ${JSON.stringify(puzzles)};\n`;

  const fs = require('fs');
  fs.writeFileSync('puzzles.js', out);
  console.log(`Wrote puzzles.js`);
}

main();
