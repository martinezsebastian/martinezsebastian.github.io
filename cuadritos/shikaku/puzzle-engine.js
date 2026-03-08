/**
 * Shikaku Puzzle Engine
 *
 * Public API (window.ShikakuEngine):
 *   generatePuzzle(rows, cols, opts?) → { clues: {"r,c": val}, solution: [{r1,c1,r2,c2}] }
 *   solvePuzzle(clues, rows, cols, maxSolutions?) → solution[]
 *   generatePartition(rows, cols) → [{r1,c1,r2,c2}]
 */
(function (global) {
  'use strict';

  // ── Utilities ────────────────────────────────────────────────────────────────

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Partition Generator ──────────────────────────────────────────────────────

  /**
   * Randomly partition a rows×cols grid into non-overlapping rectangles.
   * Processes cells in row-major order: the first uncovered cell is always
   * the top-left corner of a new rectangle, so we only try extensions
   * rightward (c2) and downward (r2). Backtracking is used if a branch fails.
   */
  function generatePartition(rows, cols, rng, maxArea) {
    rng     = rng     || Math.random;
    maxArea = maxArea || (rows * cols); // default: no cap

    const grid = Array.from({ length: rows }, () => new Array(cols).fill(-1));
    const rects = [];

    function fill() {
      let fr = -1, fc = -1;
      outer: for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (grid[r][c] === -1) { fr = r; fc = c; break outer; }

      if (fr === -1) return true;

      // Collect valid (r2, c2): rectangle [fr,r2]×[fc,c2] fully uncovered
      // and within the area cap.
      const candidates = [];
      let maxC2 = cols - 1;
      for (let r2 = fr; r2 < rows; r2++) {
        if (grid[r2][fc] !== -1) break;
        for (let c = fc; c <= maxC2; c++) {
          if (grid[r2][c] !== -1) { maxC2 = c - 1; break; }
        }
        if (maxC2 < fc) break;
        for (let c2 = fc; c2 <= maxC2; c2++) {
          if ((r2 - fr + 1) * (c2 - fc + 1) <= maxArea) candidates.push([r2, c2]);
        }
        // If even the single-cell in this row would exceed maxArea going further down, stop
        if ((r2 - fr + 2) * 1 > maxArea) break;
      }

      // Shuffle, but push 1×1 to the back to favour larger rectangles
      shuffle(candidates, rng);
      candidates.sort((a, b) => (a[0] === fr && a[1] === fc ? 1 : 0) - (b[0] === fr && b[1] === fc ? 1 : 0));

      const id = rects.length;
      for (const [r2, c2] of candidates) {
        for (let r = fr; r <= r2; r++)
          for (let c = fc; c <= c2; c++)
            grid[r][c] = id;
        rects.push({ r1: fr, c1: fc, r2, c2 });

        if (fill()) return true;

        rects.pop();
        for (let r = fr; r <= r2; r++)
          for (let c = fc; c <= c2; c++)
            grid[r][c] = -1;
      }
      return false;
    }

    if (!fill()) throw new Error('generatePartition: backtracking exhausted');
    return rects;
  }

  // ── Solver ───────────────────────────────────────────────────────────────────

  /**
   * For each clue, precompute every valid rectangle:
   *   - contains the clue cell, area === clue.val
   *   - contains no other clue cell, fits in the grid
   */
  function precomputeValidRects(clues, rows, cols) {
    return clues.map((clue, idx) => {
      const { r: cr, c: cc, val } = clue;
      const result = [];
      for (let h = 1; h <= val && h <= rows; h++) {
        if (val % h !== 0) continue;
        const w = val / h;
        if (w > cols) continue;
        for (let r1 = Math.max(0, cr - h + 1); r1 <= Math.min(cr, rows - h); r1++) {
          const r2 = r1 + h - 1;
          for (let c1 = Math.max(0, cc - w + 1); c1 <= Math.min(cc, cols - w); c1++) {
            const c2 = c1 + w - 1;
            let conflict = false;
            for (let i = 0; i < clues.length && !conflict; i++) {
              if (i === idx) continue;
              if (clues[i].r >= r1 && clues[i].r <= r2 &&
                  clues[i].c >= c1 && clues[i].c <= c2) conflict = true;
            }
            if (!conflict) result.push({ r1, c1, r2, c2 });
          }
        }
      }
      return result;
    });
  }

  /**
   * Solve a Shikaku puzzle. Returns up to maxSolutions solutions.
   *
   * Uses two key optimisations:
   *   1. "First uncovered cell" — at each step find the top-left empty cell
   *      and only consider clues/rects that cover it (huge branching reduction).
   *   2. MCV (Most Constrained Variable) — among those candidates, try the
   *      clue with the fewest feasible placements first (fail-fast pruning).
   */
  function solvePuzzle(clues, rows, cols, maxSolutions) {
    maxSolutions = (maxSolutions == null) ? 2 : maxSolutions;

    const validRects = precomputeValidRects(clues, rows, cols);
    const solutions  = [];
    const grid       = Array.from({ length: rows }, () => new Array(cols).fill(-1));
    const placed     = new Array(clues.length).fill(null);
    let   nodes      = 0;
    const NODE_LIMIT = 2_000_000;

    function solve() {
      if (solutions.length >= maxSolutions || nodes++ > NODE_LIMIT) return;

      // First uncovered cell
      let fr = -1, fc = -1;
      outer: for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (grid[r][c] === -1) { fr = r; fc = c; break outer; }

      if (fr === -1) {
        solutions.push(placed.map((rect, i) => ({ ...rect, clueIdx: i })));
        return;
      }

      // Build candidate list: unplaced clues whose non-overlapping rects cover (fr,fc)
      const cands = [];
      for (let ci = 0; ci < clues.length; ci++) {
        if (placed[ci] !== null) continue;
        const feasible = [];
        for (const rect of validRects[ci]) {
          if (rect.r1 > fr || rect.r2 < fr || rect.c1 > fc || rect.c2 < fc) continue;
          let ok = true;
          for (let r = rect.r1; r <= rect.r2 && ok; r++)
            for (let c = rect.c1; c <= rect.c2 && ok; c++)
              if (grid[r][c] !== -1) ok = false;
          if (ok) feasible.push(rect);
        }
        if (feasible.length > 0) cands.push({ ci, feasible });
      }

      // MCV: most constrained (fewest feasible placements) first
      cands.sort((a, b) => a.feasible.length - b.feasible.length);

      for (const { ci, feasible } of cands) {
        for (const rect of feasible) {
          for (let r = rect.r1; r <= rect.r2; r++)
            for (let c = rect.c1; c <= rect.c2; c++)
              grid[r][c] = ci;
          placed[ci] = rect;

          solve();

          for (let r = rect.r1; r <= rect.r2; r++)
            for (let c = rect.c1; c <= rect.c2; c++)
              grid[r][c] = -1;
          placed[ci] = null;

          if (solutions.length >= maxSolutions) return;
        }
      }
    }

    solve();
    return solutions;
  }

  // ── Clue Placement ───────────────────────────────────────────────────────────

  /**
   * For a given cell (r,c) inside a rectangle of the given area, count how
   * many rectangles of that area (fitting in the grid) contain (r,c).
   * Lower = more constraining clue position.
   */
  function constraintScore(r, c, area, rows, cols) {
    let count = 0;
    for (let h = 1; h <= area && h <= rows; h++) {
      if (area % h !== 0) continue;
      const w = area / h;
      if (w > cols) continue;
      const r1cnt = Math.min(r, rows - h) - Math.max(0, r - h + 1) + 1;
      const c1cnt = Math.min(c, cols - w) - Math.max(0, c - w + 1) + 1;
      if (r1cnt > 0 && c1cnt > 0) count += r1cnt * c1cnt;
    }
    return count;
  }

  /**
   * Pick a clue cell for a rectangle.
   * 60% of the time: pick the most constraining cell (lowest score).
   * 40% of the time: pick randomly (for variety).
   * Large rectangles (area > 40) always use random to keep it fast.
   */
  function pickClueCell(rect, rows, cols, rng) {
    const h    = rect.r2 - rect.r1 + 1;
    const w    = rect.c2 - rect.c1 + 1;
    const area = h * w;

    if (area > 40 || rng() < 0.4) {
      return {
        r: rect.r1 + Math.floor(rng() * h),
        c: rect.c1 + Math.floor(rng() * w),
      };
    }

    let best = null, bestScore = Infinity;
    for (let r = rect.r1; r <= rect.r2; r++) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        const s = constraintScore(r, c, area, rows, cols);
        if (s < bestScore) { bestScore = s; best = { r, c }; }
      }
    }
    return best;
  }

  /**
   * Given a partition, find clue positions yielding exactly one solution.
   * Returns [{r, c, val}, ...] or null if maxTries is exhausted.
   */
  function findUniqueCluePlacement(partition, rows, cols, rng, maxTries) {
    rng      = rng      || Math.random;
    maxTries = maxTries || Math.max(500, rows * cols * 4);

    for (let attempt = 0; attempt < maxTries; attempt++) {
      const clues = partition.map(rect => {
        const area = (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1);
        const cell = pickClueCell(rect, rows, cols, rng);
        return { r: cell.r, c: cell.c, val: area };
      });
      if (solvePuzzle(clues, rows, cols, 2).length === 1) return clues;
    }
    return null;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Generate a complete uniquely-solvable Shikaku puzzle.
   *
   * Returns { clues: {"r,c": val, ...}, solution: [{r1,c1,r2,c2}] }
   * Throws if it cannot succeed within maxAttempts outer retries.
   */
  function generatePuzzle(rows, cols, opts) {
    rows = rows || 5;
    cols = cols || 5;
    const maxAttempts = (opts && opts.maxAttempts) || Math.max(100, rows * cols);
    const maxArea     = (opts && opts.maxArea)     || (rows * cols);

    for (let i = 0; i < maxAttempts; i++) {
      let partition;
      try { partition = generatePartition(rows, cols, null, maxArea); }
      catch (e) { continue; }

      const clueList = findUniqueCluePlacement(partition, rows, cols);
      if (!clueList) continue;

      const clues = {};
      clueList.forEach(cl => { clues[`${cl.r},${cl.c}`] = cl.val; });
      return { clues, solution: partition };
    }

    throw new Error(`generatePuzzle: failed after ${maxAttempts} attempts`);
  }

  global.ShikakuEngine = { generatePuzzle, solvePuzzle, generatePartition };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
