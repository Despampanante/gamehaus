import { Database } from 'bun:sqlite'

const db = new Database(process.env.DB_PATH ?? 'gamehaus.db')

db.exec('PRAGMA journal_mode=WAL')
db.exec('PRAGMA foreign_keys=ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_states (
    user_id    INTEGER NOT NULL REFERENCES users(id),
    game_id    TEXT    NOT NULL,
    state      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    game_id    TEXT    NOT NULL,
    score      INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_scores_game
    ON scores(game_id, score DESC);
`)

export default db
