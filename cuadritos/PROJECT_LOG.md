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
