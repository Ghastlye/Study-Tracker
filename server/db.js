import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configuredDbPath = String(process.env.DATABASE_PATH || '').trim();
const dbPath = configuredDbPath
  ? path.isAbsolute(configuredDbPath)
    ? configuredDbPath
    : path.resolve(__dirname, configuredDbPath)
  : path.join(__dirname, 'study-tracker.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT DEFAULT '',
    duration_seconds INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    client_session_key TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'slate',
    icon TEXT NOT NULL DEFAULT 'book',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'dark',
    theme TEXT NOT NULL DEFAULT 'moonstone',
    text_scale TEXT NOT NULL DEFAULT 'md',
    reduce_motion INTEGER NOT NULL DEFAULT 0,
    density TEXT NOT NULL DEFAULT 'comfortable',
    default_timer_mode TEXT NOT NULL DEFAULT 'focus',
    pomodoro_work_minutes INTEGER NOT NULL DEFAULT 25,
    pomodoro_break_minutes INTEGER NOT NULL DEFAULT 5,
    default_subject_id INTEGER NULL,
    timezone TEXT NOT NULL DEFAULT 'local',
    date_format TEXT NOT NULL DEFAULT 'auto',
    language TEXT NOT NULL DEFAULT 'en',
    keyboard_shortcuts INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (default_subject_id) REFERENCES subjects(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_started_at
  ON sessions(user_id, started_at);

  CREATE INDEX IF NOT EXISTS idx_subjects_user_name
  ON subjects(user_id, name);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_user_lower_name
  ON subjects(user_id, lower(name));
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
if (!userColumns.some((column) => column.name === 'token_version')) {
  db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
}
if (!userColumns.some((column) => column.name === 'display_name')) {
  db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
}

const subjectColumns = db.prepare('PRAGMA table_info(subjects)').all();
if (!subjectColumns.some((column) => column.name === 'color')) {
  db.exec("ALTER TABLE subjects ADD COLUMN color TEXT NOT NULL DEFAULT 'slate'");
}
if (!subjectColumns.some((column) => column.name === 'icon')) {
  db.exec("ALTER TABLE subjects ADD COLUMN icon TEXT NOT NULL DEFAULT 'book'");
}

const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all();
if (!sessionColumns.some((column) => column.name === 'client_session_key')) {
  db.exec('ALTER TABLE sessions ADD COLUMN client_session_key TEXT');
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_user_client_key
  ON sessions(user_id, client_session_key)
  WHERE client_session_key IS NOT NULL
`);

const preferenceColumns = db.prepare('PRAGMA table_info(user_preferences)').all();
if (!preferenceColumns.some((column) => column.name === 'timezone')) {
  db.exec("ALTER TABLE user_preferences ADD COLUMN timezone TEXT NOT NULL DEFAULT 'local'");
}
if (!preferenceColumns.some((column) => column.name === 'date_format')) {
  db.exec("ALTER TABLE user_preferences ADD COLUMN date_format TEXT NOT NULL DEFAULT 'auto'");
}
if (!preferenceColumns.some((column) => column.name === 'language')) {
  db.exec("ALTER TABLE user_preferences ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
}
if (!preferenceColumns.some((column) => column.name === 'keyboard_shortcuts')) {
  db.exec("ALTER TABLE user_preferences ADD COLUMN keyboard_shortcuts INTEGER NOT NULL DEFAULT 1");
}

export default db;
