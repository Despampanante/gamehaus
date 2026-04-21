// Implements the GameModule contract:
//   init(container, savedState), getState(), getScore(), destroy()

const SIZE = 4
const CELL = 100   // px per tile
const GAP  = 10    // px between tiles
const PAD  = 10    // px board padding
const STEP = CELL + GAP
const BOARD = SIZE * CELL + (SIZE + 1) * GAP + PAD * 2   // 470px

const SLIDE_MS = 100
const SPAWN_MS = 120
const POP_MS   = 120

const COLORS = {
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

const BTN = 'background:#8f7a66;color:#f9f6f2;border:none;border-radius:4px;' +
            'padding:.4rem 1rem;font-size:.9rem;cursor:pointer;'

const wait = ms => new Promise(r => setTimeout(r, ms))

function rotateCW(grid) {
  return grid[0].map((_, c) => grid.map(row => row[c]).reverse())
}

// Slide a row of {id,value}|null leftward, merging equal pairs.
// Returns new row + points earned + list of {winner,loser} id pairs.
function slideRow(row) {
  const tiles = row.filter(Boolean)
  let points = 0
  const merges = []
  let i = 0
  while (i < tiles.length - 1) {
    if (tiles[i].value === tiles[i + 1].value) {
      merges.push({ winner: tiles[i].id, loser: tiles[i + 1].id })
      tiles[i] = { id: tiles[i].id, value: tiles[i].value * 2 }
      points += tiles[i].value
      tiles.splice(i + 1, 1)
    }
    i++
  }
  while (tiles.length < SIZE) tiles.push(null)
  return { tiles, points, merges }
}

class Game2048 {
  constructor() {
    // _grid[r][c] = {id, value} | null
    this._grid    = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
    this._score   = 0
    this._best    = 0
    this._over    = false
    this._won     = false
    this._rotation = 0
    this._nextId  = 1
    this._busy    = false   // block input during animation
    this._container = null
    this._boardEl   = null
    this._tileEls   = new Map()  // id -> DOM element
    this._onKey          = null
    this._onTouchStart   = null
    this._onTouchEnd     = null
    this._tx = 0
    this._ty = 0
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  init(container, savedState) {
    this._container = container

    if (savedState?.grid) {
      this._grid = savedState.grid.map(row =>
        row.map(v => v ? { id: this._nextId++, value: v } : null)
      )
      this._score    = savedState.score    ?? 0
      this._best     = savedState.best     ?? 0
      this._over     = savedState.over     ?? false
      this._won      = savedState.won      ?? false
      this._rotation = savedState.rotation ?? 0
    } else {
      this._spawn()
      this._spawn()
    }

    this._buildDOM()
    this._attachListeners()
  }

  getState() {
    return {
      grid:     this._grid.map(row => row.map(t => t?.value ?? 0)),
      score:    this._score,
      best:     this._best,
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

  // ── Game logic ────────────────────────────────────────────────────────────────

  _spawn() {
    const empty = []
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!this._grid[r][c]) empty.push([r, c])
    if (!empty.length) return null
    const [r, c] = empty[Math.floor(Math.random() * empty.length)]
    const tile = { id: this._nextId++, value: Math.random() < 0.9 ? 2 : 4 }
    this._grid[r][c] = tile
    return { tile, r, c }
  }

  _remapDir(dir) {
    const cw    = ['up', 'right', 'down', 'left']
    const steps = this._rotation / 90
    return cw[(cw.indexOf(dir) + (4 - steps)) % 4]
  }

  async _move(dir) {
    if (this._over || this._busy) return

    const rotations   = { left: 0, up: 3, right: 2, down: 1 }
    const unrotations = { left: 0, up: 1, right: 2, down: 3 }

    // Snapshot old positions for animation
    const oldPos = new Map()
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (this._grid[r][c]) oldPos.set(this._grid[r][c].id, { r, c })

    // Rotate grid to normalise direction → leftward slide
    let g = this._grid.map(r => [...r])
    for (let i = 0; i < rotations[dir]; i++) g = rotateCW(g)

    let moved = false
    let earned = 0
    const allMerges = []

    for (let r = 0; r < SIZE; r++) {
      const { tiles, points, merges } = slideRow(g[r])
      if (tiles.some((t, i) => t?.id !== g[r][i]?.id)) moved = true
      g[r] = tiles
      earned += points
      allMerges.push(...merges)
    }

    if (!moved) return

    for (let i = 0; i < unrotations[dir]; i++) g = rotateCW(g)
    this._grid   = g
    this._score += earned
    if (this._score > this._best) this._best = this._score
    if (g.some(row => row.some(t => t?.value === 2048))) this._won = true

    // New positions
    const newPos = new Map()
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (this._grid[r][c]) newPos.set(this._grid[r][c].id, { r, c })

    this._busy = true
    this._updateScore()

    // Slide loser tiles toward their winner's destination
    for (const { winner, loser } of allMerges) {
      const dest = newPos.get(winner)
      if (dest) this._placeTile(loser, dest.r, dest.c)
    }
    // Slide surviving tiles to new positions
    for (const [id, pos] of newPos) {
      this._placeTile(id, pos.r, pos.c)
    }

    await wait(SLIDE_MS)

    // Remove loser elements, update winner value, pop animation
    for (const { winner, loser } of allMerges) {
      this._tileEls.get(loser)?.remove()
      this._tileEls.delete(loser)
      const winEl = this._tileEls.get(winner)
      if (winEl) {
        const tile = this._grid.flat().find(t => t?.id === winner)
        if (tile) this._styleTile(winEl, tile.value)
        winEl.style.transform = 'scale(1.15)'
        await wait(POP_MS / 2)
        winEl.style.transform = 'scale(1)'
      }
    }

    this._checkOver()
    const spawned = this._spawn()
    if (spawned) this._addTileEl(spawned.tile, spawned.r, spawned.c, true)

    this._updateOverlay()
    this._busy = false
  }

  _checkOver() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (!this._grid[r][c]) return
        if (c < SIZE - 1 && this._grid[r][c].value === this._grid[r][c + 1]?.value) return
        if (r < SIZE - 1 && this._grid[r][c].value === this._grid[r + 1][c]?.value) return
      }
    this._over = true
  }

  _newGame() {
    for (const el of this._tileEls.values()) el.remove()
    this._tileEls.clear()
    this._grid  = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
    this._score = 0
    this._over  = false
    this._won   = false
    this._spawn()
    this._spawn()
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (this._grid[r][c]) this._addTileEl(this._grid[r][c], r, c, false)
    this._updateScore()
    this._updateOverlay()
  }

  // ── DOM ───────────────────────────────────────────────────────────────────────

  _buildDOM() {
    // Background cells HTML
    const cells = Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) =>
        `<div style="position:absolute;` +
        `left:${PAD + c * STEP}px;top:${PAD + r * STEP}px;` +
        `width:${CELL}px;height:${CELL}px;background:#cdc1b4;border-radius:4px;"></div>`
      ).join('')
    ).join('')

    this._container.innerHTML =
      `<div style="max-width:${BOARD}px;margin:0 auto;padding:.5rem;font-family:system-ui,sans-serif;">` +
        `<div class="g-hud" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;">` +
          `<div class="g-score" style="background:#bbada0;color:#f9f6f2;border-radius:4px;padding:.4rem .9rem;text-align:center;">` +
            `<div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;">Score</div>` +
            `<div class="g-score-val" style="font-size:1.2rem;font-weight:700;">${this._score.toLocaleString()}</div>` +
          `</div>` +
          `<div class="g-best" style="background:#bbada0;color:#f9f6f2;border-radius:4px;padding:.4rem .9rem;text-align:center;">` +
            `<div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;">Best</div>` +
            `<div class="g-best-val" style="font-size:1.2rem;font-weight:700;">${this._best.toLocaleString()}</div>` +
          `</div>` +
          `<button class="g-rotate" style="${BTN};margin-left:auto;" title="Rotate board 90°">↻</button>` +
          `<button class="g-new" style="${BTN}">New Game</button>` +
        `</div>` +
        `<div class="g-board" style="` +
            `position:relative;width:${BOARD}px;height:${BOARD}px;` +
            `background:#bbada0;border-radius:6px;` +
            `transform:rotate(${this._rotation}deg);transition:transform .3s ease;` +
        `">${cells}<div class="g-overlay" style="display:none;position:absolute;inset:0;` +
            `flex-direction:column;align-items:center;justify-content:center;` +
            `border-radius:6px;gap:.75rem;"></div></div>` +
        `<p style="font-size:.75rem;opacity:.5;margin:.6rem 0 0;text-align:center;">` +
          `Arrow keys or swipe to move</p>` +
      `</div>`

    this._boardEl = this._container.querySelector('.g-board')

    // Place existing tiles (no spawn animation — initial render)
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (this._grid[r][c]) this._addTileEl(this._grid[r][c], r, c, false)

    this._container.querySelector('.g-rotate')
      .addEventListener('click', () => {
        this._rotation = (this._rotation + 90) % 360
        this._boardEl.style.transform = `rotate(${this._rotation}deg)`
      })

    this._container.querySelector('.g-new')
      .addEventListener('click', () => { this._won = false; this._newGame() })

    this._updateOverlay()
  }

  _addTileEl(tile, r, c, animate) {
    const el = document.createElement('div')
    el.style.cssText =
      `position:absolute;width:${CELL}px;height:${CELL}px;border-radius:4px;` +
      `display:flex;align-items:center;justify-content:center;font-weight:700;` +
      `left:${PAD + c * STEP}px;top:${PAD + r * STEP}px;` +
      `transition:left ${SLIDE_MS}ms ease,top ${SLIDE_MS}ms ease,transform ${POP_MS}ms ease;` +
      `transform:scale(${animate ? 0 : 1});`
    this._styleTile(el, tile.value)
    this._boardEl.appendChild(el)
    this._tileEls.set(tile.id, el)

    if (animate) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transform = 'scale(1)'
      }))
    }
  }

  _styleTile(el, value) {
    const { bg, fg } = COLORS[value] ?? { bg: '#3c3a32', fg: '#f9f6f2' }
    const fs = value >= 1024 ? '1.4rem' : value >= 128 ? '1.75rem' : '2rem'
    el.style.background = bg
    el.style.color = fg
    el.style.fontSize = fs
    el.textContent = value
  }

  _placeTile(id, r, c) {
    const el = this._tileEls.get(id)
    if (!el) return
    el.style.left = `${PAD + c * STEP}px`
    el.style.top  = `${PAD + r * STEP}px`
  }

  _updateScore() {
    const s = this._container.querySelector('.g-score-val')
    const b = this._container.querySelector('.g-best-val')
    if (s) s.textContent = this._score.toLocaleString()
    if (b) b.textContent = this._best.toLocaleString()
  }

  _updateOverlay() {
    const el = this._container.querySelector('.g-overlay')
    if (!el) return
    if (this._over) {
      el.innerHTML =
        `<div style="font-size:1.5rem;font-weight:700;color:#776e65;">Game over!</div>` +
        `<button class="g-new" style="${BTN}">New Game</button>`
      el.style.cssText += ';display:flex;background:rgba(238,228,218,.75);'
      el.querySelector('.g-new').addEventListener('click', () => { this._won = false; this._newGame() })
    } else if (this._won) {
      el.innerHTML =
        `<div style="font-size:1.5rem;font-weight:700;color:#f9f6f2;">You reached 2048!</div>` +
        `<button class="g-new" style="${BTN}">Keep going</button>`
      el.style.cssText += ';display:flex;background:rgba(237,207,114,.75);'
      el.querySelector('.g-new').addEventListener('click', () => { this._won = false; el.style.display = 'none'; this._newGame() })
    } else {
      el.style.display = 'none'
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

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
      e.preventDefault()
      if (Math.abs(dx) > Math.abs(dy))
        this._move(this._remapDir(dx > 0 ? 'right' : 'left'))
      else
        this._move(this._remapDir(dy > 0 ? 'down' : 'up'))
    }
    this._container.addEventListener('touchstart', this._onTouchStart, { passive: true })
    this._container.addEventListener('touchend',   this._onTouchEnd,   { passive: false })
  }
}

export default new Game2048()
