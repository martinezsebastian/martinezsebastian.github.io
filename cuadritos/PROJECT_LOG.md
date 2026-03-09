# Cuadritos Project Log

## 2026-03-08 — Session 1

### What was built
- Cuadritos landing page (`cuadritos/index.html`) — Spanish-language hub for logic puzzle games
- Shikaku game ported into Cuadritos (`cuadritos/shikaku/index.html`) with back nav and Spanish UI
- Hitori card added to landing page as "Próximamente"
- All deployed to `smartinez.co/cuadritos/` via martinezsebastian.github.io

### Site structure
```
smartinez.co/cuadritos/           ← landing page
smartinez.co/cuadritos/shikaku/   ← Shikaku game (live)
smartinez.co/cuadritos/hitori/    ← Hitori game (built next session)
```

---

## 2026-03-09 — Session 2

### What was built
- **Hitori game** (`cuadritos/hitori/index.html`) — hardcoded 5×5 puzzle, fully playable
  - Click to toggle shade; live error highlighting (red) for rule violations
  - Win check: no row/col duplicates, no adjacent shaded, all unshaded connected
  - Animated win overlay on completion
  - Same paper/ink aesthetic as Shikaku (Playfair Display + DM Mono + Spectral)
  - Spanish UI, back nav to Cuadritos landing page

### Hitori puzzle (verified)
```
3  4  3  2  1
5  1  1  3  2
4  5  2  5  3
2  2  3  1  4
2  1  2  4  5
```
Shaded solution: (0,2), (1,1), (2,3), (3,0), (4,2) — all 4 rules pass.

### Mobile fixes applied
- **Shikaku**: added touchstart/touchmove/touchend drag support; responsive cell sizing
  (`CELL = min(desktopSize, floor((viewport - 48) / COLS))`); mobile layout stacks
  size panel horizontally above board below 560px
- **Hitori**: responsive cell size computed at init; `touch-action: manipulation` on cells;
  `font-size` scales with cell via `clamp()`; win box capped at viewport width

### Landing page
- Hitori card (02) updated from "Próximamente" to live link `./hitori/`

### Deployed
- Commit `e1d2686` pushed to martinezsebastian.github.io master → smartinez.co/cuadritos/

---

## 2026-03-09 — Session 3

### Hitori — error color differentiation
- Split `.cell.error` into two distinct states:
  - **Unshaded + error** (duplicate number): light rose `#EDD5D0`, dark ink text — number still readable
  - **Shaded + error** (adjacent to another shaded): deep red `#6B1414`, light text — clearly distinct from normal black shaded cell
- Added hint line below rules: *"Las celdas marcadas en rojo indican una violación de las reglas."*

### Hitori — puzzle generator + pool system
- **`generate_puzzles.py`**: offline Python generator, configurable N and count
  - Pipeline: (1) random valid shading (no adjacent, connected, 3–7 cells), (2) partial Latin square fill for unshaded cells via backtracking, (3) fill shaded cells with a duplicate number to justify shading, (4) uniqueness-checking solver (backtracking with row/col/adjacency pruning, stops at 2 solutions)
  - Run: `python generate_puzzles.py 5 100` → outputs `puzzles.js`
  - 5×5, 100 puzzles generated in ~2.5s; success rate ~3.4%
- **`generate_puzzles.js`**: identical logic in Node.js (for if/when Node is available)
- **`puzzles.js`**: 100 pre-generated valid 5×5 puzzles (~15 KB), shipped with the game
- **`index.html`** updated:
  - Removed in-browser generator entirely (zero load-time cost)
  - Loads pool from `puzzles.js` via `<script src="puzzles.js">`
  - Session queue: pool indices shuffled on session start, stored in `sessionStorage`; no repeats until all 100 played, then reshuffles
  - N is now read dynamically from the puzzle data (game is size-agnostic, ready for 7×7 or larger pools)

### Shikaku — difficulty tiers
- Replaced old size buttons (3, 5, 7, 15) with new tiers:
  - 3×3 → **Explicación** (tutorial level, unchanged)
  - 5×5 → **Rápido**
  - 9×9 → **Clásico**
  - 13×13 → **Difícil**
  - 17×17 → **Muy difícil**
- Updated `SIZE_CONFIG` with cell sizes and maxArea per tier (26–90px cells, maxArea 4–28)

### Commits
- `83076cc` — Hitori generator + pool system + error color differentiation
- `a5f0f45` — Shikaku size tier update

---
