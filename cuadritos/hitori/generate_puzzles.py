#!/usr/bin/env python3
"""Usage: python generate_puzzles.py [size] [count]
Examples:
  python generate_puzzles.py 5 100   → 100 puzzles, 5×5
  python generate_puzzles.py 7 50    →  50 puzzles, 7×7
Output: puzzles.js  (include via <script src="puzzles.js"> in index.html)
"""
import sys, json, random, time
from datetime import date

N     = int(sys.argv[1]) if len(sys.argv) > 1 else 5
COUNT = int(sys.argv[2]) if len(sys.argv) > 2 else 100
NUMS  = list(range(1, N + 1))

MIN_SHADED = max(3, int(N * N * 0.12))
MAX_SHADED = int(N * N * 0.28)

# ── Utilities ──────────────────────────────────────────────────

def unshaded_connected(sh):
    unshaded = [(r, c) for r in range(N) for c in range(N) if (r, c) not in sh]
    if not unshaded:
        return False
    visited, q = set(), [unshaded[0]]
    visited.add(unshaded[0])
    while q:
        r, c = q.pop()
        for dr, dc in ((-1,0),(1,0),(0,-1),(0,1)):
            nr, nc = r+dr, c+dc
            if 0 <= nr < N and 0 <= nc < N and (nr, nc) not in sh and (nr, nc) not in visited:
                visited.add((nr, nc))
                q.append((nr, nc))
    return len(visited) == len(unshaded)

# ── Step 1: random valid shading ──────────────────────────────

def gen_shading():
    cells = [(r, c) for r in range(N) for c in range(N)]
    for _ in range(800):
        random.shuffle(cells)
        sh = set()
        for r, c in cells:
            if len(sh) >= MAX_SHADED:
                break
            adj = any((r+dr, c+dc) in sh for dr, dc in ((-1,0),(1,0),(0,-1),(0,1)))
            if not adj and random.random() < 0.35:
                sh.add((r, c))
        if len(sh) >= MIN_SHADED and unshaded_connected(sh):
            return sh
    return None

# ── Step 2: fill unshaded (partial Latin square) ──────────────

def fill_unshaded(grid, sh):
    cells = [(r, c) for r in range(N) for c in range(N) if (r, c) not in sh]

    def bt(idx):
        if idx == len(cells):
            return True
        r, c = cells[idx]
        nums = NUMS[:]
        random.shuffle(nums)
        for v in nums:
            ok = True
            for cc in range(N):
                if ok and cc != c and (r, cc) not in sh and grid[r][cc] == v:
                    ok = False
            for rr in range(N):
                if ok and rr != r and (rr, c) not in sh and grid[rr][c] == v:
                    ok = False
            if ok:
                grid[r][c] = v
                if bt(idx + 1):
                    return True
                grid[r][c] = 0
        return False

    return bt(0)

# ── Step 3: fill shaded cells with a duplicate number ─────────

def fill_shaded(grid, sh):
    for r, c in sh:
        cands = set()
        for cc in range(N):
            if (r, cc) not in sh and grid[r][cc]:
                cands.add(grid[r][cc])
        for rr in range(N):
            if (rr, c) not in sh and grid[rr][c]:
                cands.add(grid[rr][c])
        if not cands:
            return False
        grid[r][c] = random.choice(list(cands))
    return True

# ── Step 4: solver (stop at `limit` solutions) ────────────────

def solve(puzzle, limit):
    solutions = []
    cur = set()

    def bt(pos):
        if len(solutions) >= limit:
            return
        # End-of-row duplicate check
        if pos > 0 and pos % N == 0:
            row = pos // N - 1
            seen = {}
            for c in range(N):
                if (row, c) in cur:
                    continue
                v = puzzle[row][c]
                if v in seen:
                    return
                seen[v] = c
        if pos == N * N:
            for c in range(N):
                seen = {}
                for r in range(N):
                    if (r, c) in cur:
                        continue
                    v = puzzle[r][c]
                    if v in seen:
                        return
                    seen[v] = r
            if unshaded_connected(cur):
                solutions.append(frozenset(cur))
            return

        r, c = divmod(pos, N)

        # Partial column check for already-decided rows
        if r > 0:
            seen = {}
            for rr in range(r):
                if (rr, c) in cur:
                    continue
                v = puzzle[rr][c]
                if v in seen:
                    return
                seen[v] = rr

        # Option 1: don't shade
        bt(pos + 1)

        # Option 2: shade (no adjacent)
        if len(solutions) < limit:
            adj = any((r+dr, c+dc) in cur for dr, dc in ((-1,0),(1,0),(0,-1),(0,1)))
            if not adj:
                cur.add((r, c))
                bt(pos + 1)
                cur.discard((r, c))

    bt(0)
    return solutions

# ── Main ──────────────────────────────────────────────────────

def try_generate():
    sh = gen_shading()
    if sh is None:
        return None
    grid = [[0]*N for _ in range(N)]
    if not fill_unshaded(grid, sh):
        return None
    if not fill_shaded(grid, sh):
        return None
    sols = solve(grid, 2)
    if len(sols) == 1 and sols[0] == frozenset(sh):
        return {"grid": grid, "shading": [f"{r},{c}" for r, c in sh]}
    return None

def main():
    print(f"Generating {COUNT} Hitori puzzles, size {N}×{N} ...")
    t0 = time.time()
    puzzles, attempts = [], 0
    while len(puzzles) < COUNT:
        attempts += 1
        p = try_generate()
        if p:
            puzzles.append(p)
            print(f"\r  {len(puzzles)}/{COUNT}  ({attempts} attempts)", end="", flush=True)
    elapsed = time.time() - t0
    rate = COUNT / attempts * 100
    print(f"\nDone in {elapsed:.1f}s — success rate {rate:.1f}%")

    out = (
        f"// Generated by generate_puzzles.py — do not edit manually.\n"
        f"// N={N}, count={COUNT}, generated {date.today()}\n"
        f"const HITORI_PUZZLES = {json.dumps(puzzles)};\n"
    )
    with open("puzzles.js", "w") as f:
        f.write(out)
    print("Wrote puzzles.js")

if __name__ == "__main__":
    main()
