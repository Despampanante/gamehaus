// Implements the GameModule contract:
//   init(container, savedState), getState(), getScore(), destroy()

const SIZE = 4

const COLORS = {
  0:    { bg: '#cdc1b4', fg: '#776e65' },
  2:    { bg: '#eee4da', fg: '#776e65' },
  4:    { bg: '#ede0c8', fg: '#776e65' },
  8:    { bg: '#f2b179', fg: '#f9f6f2' },
  16:   { bg: '#f59563', fg: '#f9f6f2' },
  32:   { bg: '#f67c5f', fg: '#f9f6f2' },
  64:   { bg: '#f65e3b', fg: '#f9f6f2' },
  128:  { bg: '#edcf72', fg: '#f9f6f2' },
  256:  { bg: '#edcc61', fg: '#f9f6f2' },
  512:  { bg: '#edc850', fg: '#f9f6f2' },
  1024: { bg: '#edc53f', fg: '#f9f6f2' },
  2048: { bg: '#edc22e', fg: '#f9f6f2' },
}

// Rotate grid 90° clockwise
function rotateCW(grid) {
  return grid[0].map((_, c) => grid.map(row => row[c]).reverse())
}

// Slide a single row left, merge equal adjacent tiles, return new row + points earned
function slideLeft(row) {
  const tiles = row.filter(v => v !== 0)
  let points = 0
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] === tiles[i + 1]) {
      tiles[i] *= 2
      points += tiles[i]
      tiles.splice(i + 1, 1)
    }
  }
  while (tiles.length < SIZE) tiles.push(0)
  return { tiles, points }
}

class Game2048 {
  constructor() {
    this._grid  = Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
    this._score = 0
    this._best  = 0
    this._over  = false
    this._won   = false
    this._rotation = 0   // visual rotation in degrees: 0 | 90 | 180 | 270
    this._container = null
    this._onKey     = null
    this._onTouchStart = null
    this._onTouchEnd   = null
    this._tx = 0
    this._ty = 0
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  init(container, savedState) {
    this._container = container

    if (savedState?.grid) {
      this._grid  = savedState.grid.map(r => [...r])
      this._score = savedState.score ?? 0
      this._best  = savedState.best  ?? 0
      this._over     = savedState.over     ?? false
      this._won      = savedState.won      ?? false
      this._rotation = savedState.rotation ?? 0
    } else {
      this._spawnTile()
      this._spawnTile()
    }

    this._render()
    this._attachListeners()
  }

  getState() {
    return {
      grid:  this._grid.map(r => [...r]),
      score: this._score,
      best:  this._best,
      over:     this._over,
      won:      this._won,
      rotation: this._rotation,
    }
  }

  getScore() { return this._score }

  destroy() {
    document.removeEventListener('keydown', this._onKey)
    this._container?.removeEventListener('touchstart', this._onTouchStart)
    this._container?.removeEventListener('touchend',   this._onTouchEnd)
  }

  // ── Game logic ──────────────────────────────────────────────────────────────

  _spawnTile() {
    const empty = []
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (this._grid[r][c] === 0) empty.push([r, c])
    if (!empty.length) return
    const [r, c] = empty[Math.floor(Math.random() * empty.length)]
    this._grid[r][c] = Math.random() < 0.9 ? 2 : 4
  }

  // Translate a screen-space direction into game-space, accounting for visual rotation.
  // e.g. if the board is rotated 90° CW, pressing "up" should slide tiles toward what
  // was originally the left edge — so we map up → left.
  _remapDir(dir) {
    const cw = ['up', 'right', 'down', 'left']
    const steps = this._rotation / 90
    return cw[(cw.indexOf(dir) + (4 - steps)) % 4]
  }

  _rotateBoard() {
    this._rotation = (this._rotation + 90) % 360
    this._render()
  }

  _move(dir) {
    if (this._over) return

    // Normalise to left-slide by rotating, then un-rotate after
    const rotations = { left: 0, up: 3, right: 2, down: 1 }
    const unrotations = { left: 0, up: 1, right: 2, down: 3 }

    let g = this._grid.map(r => [...r])
    for (let i = 0; i < rotations[dir]; i++) g = rotateCW(g)

    let moved = false
    let earned = 0
    for (let r = 0; r < SIZE; r++) {
      const { tiles, points } = slideLeft(g[r])
      if (tiles.some((v, i) => v !== g[r][i])) moved = true
      g[r] = tiles
      earned += points
    }

    if (!moved) return

    for (let i = 0; i < unrotations[dir]; i++) g = rotateCW(g)

    this._grid   = g
    this._score += earned
    if (this._score > this._best) this._best = this._score

    if (g.some(row => row.includes(2048))) this._won = true

    this._spawnTile()
    this._checkOver()
    this._render()
  }

  _checkOver() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (this._grid[r][c] === 0) return
        if (c < SIZE - 1 && this._grid[r][c] === this._grid[r][c + 1]) return
        if (r < SIZE - 1 && this._grid[r][c] === this._grid[r + 1][c]) return
      }
    this._over = true
  }

  _newGame() {
    this._grid  = Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
    this._score = 0
    this._over  = false
    this._won   = false
    this._spawnTile()
    this._spawnTile()
    this._render()
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  _attachListeners() {
    this._onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      if (map[e.key]) { e.preventDefault(); this._move(this._remapDir(map[e.key])) }
    }
    document.addEventListener('keydown', this._onKey)

    this._onTouchStart = (e) => {
      this._tx = e.touches[0].clientX
      this._ty = e.touches[0].clientY
    }
    this._onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - this._tx
      const dy = e.changedTouches[0].clientY - this._ty
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
      if (Math.abs(dx) > Math.abs(dy))
        this._move(this._remapDir(dx > 0 ? 'right' : 'left'))
      else
        this._move(this._remapDir(dy > 0 ? 'down' : 'up'))
    }
    this._container.addEventListener('touchstart', this._onTouchStart, { passive: true })
    this._container.addEventListener('touchend',   this._onTouchEnd,   { passive: true })
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  _tileHTML(v) {
    const { bg, fg } = COLORS[v] ?? { bg: '#3c3a32', fg: '#f9f6f2' }
    const fs = v >= 1024 ? '1.4rem' : v >= 128 ? '1.75rem' : '2rem'
    return `<div style="background:${bg};color:${fg};display:flex;align-items:center;` +
           `justify-content:center;font-size:${fs};font-weight:700;border-radius:4px;` +
           `aspect-ratio:1;transition:background 0.1s;">${v || ''}</div>`
  }

  _render() {
    const scoreBox = (label, val) =>
      `<div style="background:#bbada0;color:#f9f6f2;border-radius:4px;padding:0.4rem 0.9rem;text-align:center;">` +
      `<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.05em;">${label}</div>` +
      `<div style="font-size:1.2rem;font-weight:700;">${val.toLocaleString()}</div></div>`

    const overlay = this._over
      ? `<div style="position:absolute;inset:0;background:rgba(238,228,218,.75);display:flex;` +
        `flex-direction:column;align-items:center;justify-content:center;border-radius:6px;gap:.75rem;">` +
        `<div style="font-size:1.5rem;font-weight:700;color:#776e65;">Game over!</div>` +
        `<button id="g-new" style="${BTN_STYLE}">New Game</button></div>`
      : this._won
      ? `<div style="position:absolute;inset:0;background:rgba(237,207,114,.75);display:flex;` +
        `flex-direction:column;align-items:center;justify-content:center;border-radius:6px;gap:.75rem;">` +
        `<div style="font-size:1.5rem;font-weight:700;color:#f9f6f2;">You reached 2048!</div>` +
        `<button id="g-new" style="${BTN_STYLE}">Keep going</button></div>`
      : ''

    this._container.innerHTML =
      `<div style="max-width:420px;margin:0 auto;padding:.5rem;font-family:system-ui,sans-serif;">` +
        `<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;">` +
          scoreBox('Score', this._score) +
          scoreBox('Best',  this._best) +
          `<button id="g-rotate" style="${BTN_STYLE};margin-left:auto;" title="Rotate board 90°">↻</button>` +
          `<button id="g-new" style="${BTN_STYLE}">New Game</button>` +
        `</div>` +
        `<div style="transform:rotate(${this._rotation}deg);transition:transform .3s ease;` +
             `position:relative;background:#bbada0;border-radius:6px;padding:.5rem;` +
             `display:grid;grid-template-columns:repeat(${SIZE},1fr);gap:.5rem;">` +
          this._grid.flat().map(v => this._tileHTML(v)).join('') +
          overlay +
        `</div>` +
        `<p style="font-size:.75rem;opacity:.5;margin:.6rem 0 0;text-align:center;">` +
          `Arrow keys or swipe to move</p>` +
      `</div>`

    this._container.querySelector('#g-rotate')
      ?.addEventListener('click', () => this._rotateBoard())

    this._container.querySelectorAll('#g-new').forEach(btn => {
      btn.addEventListener('click', () => {
        this._won = false
        this._newGame()
      })
    })
  }
}

const BTN_STYLE =
  'background:#8f7a66;color:#f9f6f2;border:none;border-radius:4px;' +
  'padding:.4rem 1rem;font-size:.9rem;cursor:pointer;'

export default new Game2048()
