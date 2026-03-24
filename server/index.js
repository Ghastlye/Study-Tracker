import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const MODES = ['dark', 'light'];
const THEMES = ['moonstone', 'tangerine', 'raspberry', 'blue', 'green', 'brown'];
const SUBJECT_COLORS = ['slate', 'blue', 'green', 'brown', 'orange', 'pink', 'purple', 'teal', 'red'];
const TEXT_SCALES = ['sm', 'md', 'lg'];
const DENSITIES = ['comfortable', 'compact'];
const TIMER_MODES = ['focus', 'pomodoro'];
const DATE_FORMATS = ['auto', 'dmy', 'mdy', 'ymd'];
const LANGUAGES = ['en', 'en-AU', 'en-US'];

const DEFAULT_PREFERENCES = {
  mode: 'dark',
  theme: 'moonstone',
  textScale: 'md',
  reduceMotion: false,
  density: 'comfortable',
  defaultTimerMode: 'focus',
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  defaultSubjectId: null,
  timezone: 'local',
  dateFormat: 'auto',
  language: 'en',
  keyboardShortcuts: true,
};

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.type('text/plain').send('Study Tracker API is running. Open http://localhost:5173 for the web app.');
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getInputValue(object, camelKey, snakeKey) {
  if (hasOwn(object, camelKey)) {
    return { present: true, value: object[camelKey] };
  }
  if (snakeKey && hasOwn(object, snakeKey)) {
    return { present: true, value: object[snakeKey] };
  }
  return { present: false, value: undefined };
}

function parseBooleanStrict(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfTodayLocal() {
  return startOfDay(new Date());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthDay(date, includeYear = false) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function formatWeekRangeLabel(start, end) {
  const includeYear = start.getFullYear() !== end.getFullYear();
  return `${formatMonthDay(start, includeYear)} - ${formatMonthDay(end, includeYear)}`;
}

function parseCursorDate(cursorInput) {
  if (typeof cursorInput !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cursorInput)) {
    return startOfTodayLocal();
  }

  const [year, month, day] = cursorInput.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return startOfTodayLocal();
  }

  return startOfDay(parsed);
}

function startOfWeekMonday(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(start, diff);
}

function getRangeConfig(rangeInput, cursorInput) {
  const normalizedRange = ['week', 'month', 'year'].includes(rangeInput) ? rangeInput : 'week';
  const cursorDate = parseCursorDate(cursorInput);
  const today = startOfTodayLocal();

  if (normalizedRange === 'week') {
    const start = startOfWeekMonday(cursorDate);
    const end = addDays(start, 6);
    const currentStart = startOfWeekMonday(today);
    const currentEnd = addDays(currentStart, 6);

    return {
      range: 'week',
      start,
      end,
      endExclusive: addDays(end, 1),
      averageDivisor: 7,
      periodLabel: formatWeekRangeLabel(start, end),
      isCurrentPeriod:
        toIsoDateLocal(start) === toIsoDateLocal(currentStart) &&
        toIsoDateLocal(end) === toIsoDateLocal(currentEnd),
    };
  }

  if (normalizedRange === 'month') {
    const start = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const end = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0);
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return {
      range: 'month',
      start,
      end,
      endExclusive: addDays(end, 1),
      averageDivisor: end.getDate(),
      periodLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      isCurrentPeriod:
        toIsoDateLocal(start) === toIsoDateLocal(currentStart) &&
        toIsoDateLocal(end) === toIsoDateLocal(currentEnd),
    };
  }

  const start = new Date(cursorDate.getFullYear(), 0, 1);
  const end = new Date(cursorDate.getFullYear(), 11, 31);
  const currentStart = new Date(today.getFullYear(), 0, 1);
  const currentEnd = new Date(today.getFullYear(), 11, 31);

  return {
    range: 'year',
    start,
    end,
    endExclusive: addDays(end, 1),
    averageDivisor: 365 + (new Date(start.getFullYear(), 1, 29).getMonth() === 1 ? 1 : 0),
    periodLabel: String(start.getFullYear()),
    isCurrentPeriod:
      toIsoDateLocal(start) === toIsoDateLocal(currentStart) &&
      toIsoDateLocal(end) === toIsoDateLocal(currentEnd),
  };
}

function buildWeekBars(start, totalsByDate) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((label, index) => {
    const date = addDays(start, index);
    const iso = toIsoDateLocal(date);
    return {
      label,
      date: iso,
      totalSeconds: totalsByDate.get(iso) || 0,
    };
  });
}

function buildMonthBars(start, end, totalsByDate) {
  const bars = [];
  for (let day = 1; day <= end.getDate(); day += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), day);
    const iso = toIsoDateLocal(date);
    bars.push({
      label: String(day),
      date: iso,
      totalSeconds: totalsByDate.get(iso) || 0,
    });
  }
  return bars;
}

function buildYearBars(start, monthTotalsMap) {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = start.getFullYear();

  return monthLabels.map((label, index) => {
    const month = String(index + 1).padStart(2, '0');
    const monthKey = `${year}-${month}`;
    return {
      label,
      date: `${monthKey}-01`,
      totalSeconds: monthTotalsMap.get(monthKey) || 0,
    };
  });
}

function calculateCurrentStreak(activeDateSet) {
  let streak = 0;
  const cursor = startOfTodayLocal();
  while (activeDateSet.has(toIsoDateLocal(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function normalizeSubjectName(nameInput) {
  return String(nameInput || '').trim().replace(/\s+/g, ' ');
}

function normalizeTheme(themeInput) {
  if (themeInput === 'organic') return 'tangerine';
  if (themeInput === 'neutral') return 'moonstone';
  return themeInput;
}

function normalizeSubjectColor(colorInput) {
  return SUBJECT_COLORS.includes(colorInput) ? colorInput : 'slate';
}

function isValidTimeZone(timezone) {
  if (timezone === 'local') return true;
  if (typeof timezone !== 'string' || timezone.trim() === '') return false;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function makeSessionDedupKey(startedAt, endedAt, durationSeconds, subject) {
  return `${startedAt}|${endedAt}|${durationSeconds}|${normalizeSubjectName(subject).toLowerCase()}`;
}

function createToken(user) {
  const tokenVersion = user.tokenVersion ?? user.token_version ?? 0;
  return jwt.sign({ id: user.id, email: user.email, tokenVersion }, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const claims = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare('SELECT id, email, display_name AS displayName, token_version AS tokenVersion FROM users WHERE id = ?')
      .get(claims.id);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if ((claims.tokenVersion ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function mapPreferenceRow(row) {
  return {
    mode: row.mode,
    theme: normalizeTheme(row.theme),
    textScale: row.text_scale,
    reduceMotion: Boolean(row.reduce_motion),
    density: row.density,
    defaultTimerMode: row.default_timer_mode,
    pomodoroWorkMinutes: row.pomodoro_work_minutes,
    pomodoroBreakMinutes: row.pomodoro_break_minutes,
    defaultSubjectId: row.default_subject_id,
    timezone: row.timezone || 'local',
    dateFormat: row.date_format || 'auto',
    language: row.language || 'en',
    keyboardShortcuts: Boolean(row.keyboard_shortcuts),
  };
}

function ensurePreferencesRow(userId) {
  db.prepare('INSERT INTO user_preferences (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING').run(userId);
}

function getPreferences(userId) {
  ensurePreferencesRow(userId);
  const row = db
    .prepare(
      `SELECT
         mode,
         theme,
         text_scale,
         reduce_motion,
         density,
         default_timer_mode,
         pomodoro_work_minutes,
         pomodoro_break_minutes,
         default_subject_id,
         timezone,
         date_format,
         language,
         keyboard_shortcuts
       FROM user_preferences
       WHERE user_id = ?`
    )
    .get(userId);

  if (!row) {
    return { ...DEFAULT_PREFERENCES };
  }

  return mapPreferenceRow(row);
}

function savePreferences(userId, preferences) {
  db.prepare(
    `INSERT INTO user_preferences (
       user_id,
       mode,
       theme,
       text_scale,
       reduce_motion,
       density,
       default_timer_mode,
       pomodoro_work_minutes,
       pomodoro_break_minutes,
       default_subject_id,
       timezone,
       date_format,
       language,
       keyboard_shortcuts,
       updated_at
     ) VALUES (
       @userId,
       @mode,
       @theme,
       @textScale,
       @reduceMotion,
       @density,
       @defaultTimerMode,
       @pomodoroWorkMinutes,
       @pomodoroBreakMinutes,
       @defaultSubjectId,
       @timezone,
       @dateFormat,
       @language,
       @keyboardShortcuts,
       CURRENT_TIMESTAMP
     )
     ON CONFLICT(user_id) DO UPDATE SET
       mode = excluded.mode,
       theme = excluded.theme,
       text_scale = excluded.text_scale,
       reduce_motion = excluded.reduce_motion,
       density = excluded.density,
       default_timer_mode = excluded.default_timer_mode,
       pomodoro_work_minutes = excluded.pomodoro_work_minutes,
       pomodoro_break_minutes = excluded.pomodoro_break_minutes,
       default_subject_id = excluded.default_subject_id,
       timezone = excluded.timezone,
       date_format = excluded.date_format,
       language = excluded.language,
       keyboard_shortcuts = excluded.keyboard_shortcuts,
       updated_at = CURRENT_TIMESTAMP`
  ).run({
    userId,
    mode: preferences.mode,
    theme: preferences.theme,
    textScale: preferences.textScale,
    reduceMotion: preferences.reduceMotion ? 1 : 0,
    density: preferences.density,
    defaultTimerMode: preferences.defaultTimerMode,
    pomodoroWorkMinutes: preferences.pomodoroWorkMinutes,
    pomodoroBreakMinutes: preferences.pomodoroBreakMinutes,
    defaultSubjectId: preferences.defaultSubjectId,
    timezone: preferences.timezone,
    dateFormat: preferences.dateFormat,
    language: preferences.language,
    keyboardShortcuts: preferences.keyboardShortcuts ? 1 : 0,
  });

  return getPreferences(userId);
}

function buildPreferencePatch(input, { allowDefaultSubjectId = true } = {}) {
  const patch = {};

  const mode = getInputValue(input, 'mode');
  if (mode.present) {
    if (!MODES.includes(mode.value)) {
      throw new Error('Invalid mode');
    }
    patch.mode = mode.value;
  }

  const theme = getInputValue(input, 'theme');
  if (theme.present) {
    const normalizedTheme = normalizeTheme(theme.value);
    if (!THEMES.includes(normalizedTheme)) {
      throw new Error('Invalid theme');
    }
    patch.theme = normalizedTheme;
  }

  const textScale = getInputValue(input, 'textScale', 'text_scale');
  if (textScale.present) {
    if (!TEXT_SCALES.includes(textScale.value)) {
      throw new Error('Invalid text scale');
    }
    patch.textScale = textScale.value;
  }

  const reduceMotion = getInputValue(input, 'reduceMotion', 'reduce_motion');
  if (reduceMotion.present) {
    const boolValue = parseBooleanStrict(reduceMotion.value);
    if (boolValue === null) {
      throw new Error('Invalid reduce motion value');
    }
    patch.reduceMotion = boolValue;
  }

  const density = getInputValue(input, 'density');
  if (density.present) {
    if (!DENSITIES.includes(density.value)) {
      throw new Error('Invalid density');
    }
    patch.density = density.value;
  }

  const timerMode = getInputValue(input, 'defaultTimerMode', 'default_timer_mode');
  if (timerMode.present) {
    if (!TIMER_MODES.includes(timerMode.value)) {
      throw new Error('Invalid default timer mode');
    }
    patch.defaultTimerMode = timerMode.value;
  }

  const workMinutes = getInputValue(input, 'pomodoroWorkMinutes', 'pomodoro_work_minutes');
  if (workMinutes.present) {
    const numeric = Number(workMinutes.value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 180) {
      throw new Error('Pomodoro work minutes must be between 1 and 180');
    }
    patch.pomodoroWorkMinutes = numeric;
  }

  const breakMinutes = getInputValue(input, 'pomodoroBreakMinutes', 'pomodoro_break_minutes');
  if (breakMinutes.present) {
    const numeric = Number(breakMinutes.value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 120) {
      throw new Error('Pomodoro break minutes must be between 1 and 120');
    }
    patch.pomodoroBreakMinutes = numeric;
  }

  const defaultSubjectId = getInputValue(input, 'defaultSubjectId', 'default_subject_id');
  if (defaultSubjectId.present) {
    if (!allowDefaultSubjectId) {
      patch.defaultSubjectId = null;
    } else if (defaultSubjectId.value === null || defaultSubjectId.value === '' || defaultSubjectId.value === undefined) {
      patch.defaultSubjectId = null;
    } else {
      const numeric = Number(defaultSubjectId.value);
      if (!Number.isInteger(numeric) || numeric < 1) {
        throw new Error('Invalid default subject id');
      }
      patch.defaultSubjectId = numeric;
    }
  }

  const timezone = getInputValue(input, 'timezone');
  if (timezone.present) {
    if (!isValidTimeZone(timezone.value)) {
      throw new Error('Invalid timezone');
    }
    patch.timezone = timezone.value;
  }

  const dateFormat = getInputValue(input, 'dateFormat', 'date_format');
  if (dateFormat.present) {
    if (!DATE_FORMATS.includes(dateFormat.value)) {
      throw new Error('Invalid date format');
    }
    patch.dateFormat = dateFormat.value;
  }

  const language = getInputValue(input, 'language');
  if (language.present) {
    if (!LANGUAGES.includes(language.value)) {
      throw new Error('Invalid language');
    }
    patch.language = language.value;
  }

  const keyboardShortcuts = getInputValue(input, 'keyboardShortcuts', 'keyboard_shortcuts');
  if (keyboardShortcuts.present) {
    const boolValue = parseBooleanStrict(keyboardShortcuts.value);
    if (boolValue === null) {
      throw new Error('Invalid keyboard shortcuts value');
    }
    patch.keyboardShortcuts = boolValue;
  }

  return patch;
}

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email and password (min 6 chars) are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(normalizedEmail, hash);
  const user = db
    .prepare('SELECT id, email, display_name AS displayName, token_version AS tokenVersion FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json({
    token: createToken(user),
    user: { id: user.id, email: user.email, displayName: user.displayName || null },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db
    .prepare(
      `SELECT id, email, display_name AS displayName, password_hash AS passwordHash, token_version AS tokenVersion
       FROM users
       WHERE email = ?`
    )
    .get((email || '').toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json({
    token: createToken(user),
    user: { id: user.id, email: user.email, displayName: user.displayName || null },
  });
});

app.get('/api/me', auth, (req, res) => {
  return res.json({
    user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName || null },
  });
});

app.get('/api/account', auth, (req, res) => {
  const user = db
    .prepare('SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ account: user });
});

app.put('/api/account/profile', auth, (req, res) => {
  const displayName = String(req.body?.displayName || '').trim();
  const normalizedDisplayName = displayName.length ? displayName.slice(0, 80) : null;

  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(normalizedDisplayName, req.user.id);
  const account = db
    .prepare('SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?')
    .get(req.user.id);

  return res.json({ account });
});

app.put('/api/account/email', auth, async (req, res) => {
  const { email, currentPassword } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !currentPassword) {
    return res.status(400).json({ error: 'Email and current password are required' });
  }

  const user = db.prepare('SELECT id, password_hash AS passwordHash FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, req.user.id);
  if (emailTaken) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalizedEmail, req.user.id);
  const updated = db
    .prepare('SELECT id, email, display_name AS displayName, token_version AS tokenVersion FROM users WHERE id = ?')
    .get(req.user.id);

  return res.json({
    user: { id: updated.id, email: updated.email, displayName: updated.displayName || null },
    token: createToken(updated),
  });
});

app.put('/api/account/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Current password and new password (min 6 chars) are required' });
  }

  const user = db.prepare('SELECT id, password_hash AS passwordHash FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

  return res.json({ ok: true });
});

app.delete('/api/account', auth, async (req, res) => {
  const { currentPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }

  const user = db.prepare('SELECT id, password_hash AS passwordHash FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  return res.json({ ok: true });
});

app.get('/api/settings', auth, (req, res) => {
  return res.json({ preferences: getPreferences(req.user.id) });
});

app.put('/api/settings', auth, (req, res) => {
  const payload = req.body || {};

  try {
    const current = getPreferences(req.user.id);
    const patch = buildPreferencePatch(payload, { allowDefaultSubjectId: true });
    const next = { ...current, ...patch };

    if (next.defaultSubjectId !== null) {
      const subjectExists = db
        .prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?')
        .get(next.defaultSubjectId, req.user.id);
      if (!subjectExists) {
        return res.status(400).json({ error: 'Default subject does not exist' });
      }
    }

    const saved = savePreferences(req.user.id, next);
    return res.json({ preferences: saved });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid settings payload' });
  }
});

app.post('/api/security/logout-all', auth, async (req, res) => {
  const { currentPassword } = req.body || {};
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }

  const user = db.prepare('SELECT id, password_hash AS passwordHash FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user.id);
  return res.json({ ok: true });
});

app.get('/api/subjects', auth, (req, res) => {
  const subjects = db
    .prepare(
      `SELECT id, name, color, created_at AS createdAt
       FROM subjects
       WHERE user_id = ?
       ORDER BY lower(name) ASC, id ASC`
    )
    .all(req.user.id);

  return res.json({ subjects });
});

app.post('/api/subjects', auth, (req, res) => {
  const name = normalizeSubjectName(req.body?.name);
  if (hasOwn(req.body || {}, 'color') && !SUBJECT_COLORS.includes(req.body?.color)) {
    return res.status(400).json({ error: 'Invalid subject color' });
  }
  const color = hasOwn(req.body || {}, 'color') ? req.body.color : 'slate';
  if (!name || name.length > 60) {
    return res.status(400).json({ error: 'Subject name must be between 1 and 60 characters' });
  }

  try {
    const result = db.prepare('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)').run(req.user.id, name, color);
    const subject = db
      .prepare('SELECT id, name, color, created_at AS createdAt FROM subjects WHERE id = ?')
      .get(result.lastInsertRowid);
    return res.status(201).json({ subject });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Subject already exists' });
    }
    throw error;
  }
});

app.put('/api/subjects/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid subject id' });
  }

  const existing = db
    .prepare('SELECT id, name, color FROM subjects WHERE id = ? AND user_id = ?')
    .get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  const hasName = hasOwn(req.body || {}, 'name');
  const hasColor = hasOwn(req.body || {}, 'color');
  const hasIgnoredIcon = hasOwn(req.body || {}, 'icon');
  if (!hasName && !hasColor) {
    if (hasIgnoredIcon) {
      const subject = db
        .prepare('SELECT id, name, color, created_at AS createdAt FROM subjects WHERE id = ?')
        .get(id);
      return res.json({ subject });
    }
    return res.status(400).json({ error: 'No updates provided' });
  }
  if (hasColor && !SUBJECT_COLORS.includes(req.body?.color)) {
    return res.status(400).json({ error: 'Invalid subject color' });
  }

  const name = hasName ? normalizeSubjectName(req.body?.name) : existing.name;
  const color = hasColor ? req.body.color : normalizeSubjectColor(existing.color);

  if (!name || name.length > 60) {
    return res.status(400).json({ error: 'Subject name must be between 1 and 60 characters' });
  }

  try {
    db.prepare('UPDATE subjects SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(name, color, id, req.user.id);
    const subject = db
      .prepare('SELECT id, name, color, created_at AS createdAt FROM subjects WHERE id = ?')
      .get(id);
    return res.json({ subject });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Subject already exists' });
    }
    throw error;
  }
});

app.delete('/api/subjects/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid subject id' });
  }

  const existing = db.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  db.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').run(id, req.user.id);
  return res.json({ ok: true });
});

app.get('/api/data/export', auth, (req, res) => {
  const sessions = db
    .prepare(
      `SELECT id, subject, duration_seconds AS durationSeconds, started_at AS startedAt, ended_at AS endedAt
       FROM sessions
       WHERE user_id = ?
       ORDER BY started_at DESC, id DESC`
    )
    .all(req.user.id);

  const subjects = db
    .prepare(
      `SELECT id, name, color, created_at AS createdAt
       FROM subjects
       WHERE user_id = ?
       ORDER BY lower(name) ASC, id ASC`
    )
    .all(req.user.id);

  const preferences = getPreferences(req.user.id);

  return res.json({
    exportedAt: new Date().toISOString(),
    sessions,
    subjects,
    preferences,
  });
});

app.post('/api/data/import', auth, (req, res) => {
  const payload = req.body || {};
  const subjectInput = Array.isArray(payload.subjects) ? payload.subjects : [];
  const sessionInput = Array.isArray(payload.sessions) ? payload.sessions : [];
  const preferenceInput = payload.preferences && typeof payload.preferences === 'object' ? payload.preferences : null;

  const result = {
    imported: { sessions: 0, subjects: 0 },
    skipped: { sessions: 0, subjects: 0 },
    errors: 0,
  };

  const importTransaction = db.transaction(() => {
    const existingSubjects = db
      .prepare('SELECT lower(name) AS key FROM subjects WHERE user_id = ?')
      .all(req.user.id)
      .map((row) => row.key);
    const subjectKeySet = new Set(existingSubjects);

    const existingSessions = db
      .prepare(
        `SELECT started_at AS startedAt, ended_at AS endedAt, duration_seconds AS durationSeconds,
                lower(trim(COALESCE(subject, ''))) AS subjectKey
         FROM sessions
         WHERE user_id = ?`
      )
      .all(req.user.id);
    const sessionKeySet = new Set(
      existingSessions.map((row) => `${row.startedAt}|${row.endedAt}|${row.durationSeconds}|${row.subjectKey}`)
    );

    for (const item of subjectInput) {
      const rawName = typeof item === 'string' ? item : item?.name;
      const name = normalizeSubjectName(rawName);
      const color = normalizeSubjectColor(item?.color);

      if (!name || name.length > 60) {
        result.errors += 1;
        continue;
      }

      const subjectKey = name.toLowerCase();
      if (subjectKeySet.has(subjectKey)) {
        result.skipped.subjects += 1;
        continue;
      }

      db.prepare('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)').run(req.user.id, name, color);
      subjectKeySet.add(subjectKey);
      result.imported.subjects += 1;
    }

    for (const item of sessionInput) {
      const rawStartedAt = item?.startedAt ?? item?.started_at;
      const rawEndedAt = item?.endedAt ?? item?.ended_at;
      const rawDurationSeconds = item?.durationSeconds ?? item?.duration_seconds;
      const rawSubject = item?.subject ?? '';

      const startedAtDate = new Date(rawStartedAt);
      const endedAtDate = new Date(rawEndedAt);
      const durationSeconds = Number(rawDurationSeconds);
      const subject = normalizeSubjectName(rawSubject);

      if (
        Number.isNaN(startedAtDate.getTime()) ||
        Number.isNaN(endedAtDate.getTime()) ||
        !Number.isInteger(durationSeconds) ||
        durationSeconds < 1 ||
        endedAtDate < startedAtDate
      ) {
        result.errors += 1;
        continue;
      }

      const startedAt = startedAtDate.toISOString();
      const endedAt = endedAtDate.toISOString();
      const sessionKey = makeSessionDedupKey(startedAt, endedAt, durationSeconds, subject);

      if (sessionKeySet.has(sessionKey)) {
        result.skipped.sessions += 1;
        continue;
      }

      db.prepare(
        `INSERT INTO sessions (user_id, subject, duration_seconds, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(req.user.id, subject, durationSeconds, startedAt, endedAt);

      sessionKeySet.add(sessionKey);
      result.imported.sessions += 1;
    }

    if (preferenceInput) {
      try {
        const current = getPreferences(req.user.id);
        const patch = buildPreferencePatch(preferenceInput, { allowDefaultSubjectId: false });
        const merged = { ...current, ...patch };

        if (hasOwn(patch, 'defaultSubjectId')) {
          merged.defaultSubjectId = null;
        }

        savePreferences(req.user.id, merged);
      } catch {
        result.errors += 1;
      }
    }
  });

  importTransaction();

  return res.json(result);
});

app.delete('/api/data/reset', auth, (req, res) => {
  const resetTransaction = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM subjects WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(req.user.id);
  });

  resetTransaction();
  return res.json({ ok: true });
});

app.get('/api/sessions', auth, (req, res) => {
  const sessions = db
    .prepare(
      `SELECT id, subject, duration_seconds AS durationSeconds, started_at AS startedAt, ended_at AS endedAt
       FROM sessions
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT 100`
    )
    .all(req.user.id);

  return res.json({ sessions });
});

app.post('/api/sessions', auth, (req, res) => {
  const { subject = '', durationSeconds, startedAt, endedAt } = req.body;
  const keyInput = req.body?.clientSessionKey;
  const clientSessionKey =
    keyInput === undefined || keyInput === null ? null : String(keyInput).trim();

  if (!durationSeconds || durationSeconds < 1 || !startedAt || !endedAt) {
    return res.status(400).json({ error: 'Invalid session data' });
  }
  if (clientSessionKey !== null && (!clientSessionKey || clientSessionKey.length > 128)) {
    return res.status(400).json({ error: 'Invalid client session key' });
  }

  if (clientSessionKey) {
    const existing = db
      .prepare(
        `SELECT id, subject, duration_seconds AS durationSeconds, started_at AS startedAt, ended_at AS endedAt
         FROM sessions
         WHERE user_id = ? AND client_session_key = ?`
      )
      .get(req.user.id, clientSessionKey);
    if (existing) {
      return res.status(200).json({ session: existing });
    }
  }

  let result;
  try {
    result = db
      .prepare(
        `INSERT INTO sessions (user_id, subject, duration_seconds, started_at, ended_at, client_session_key)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, String(subject).trim(), Math.floor(durationSeconds), startedAt, endedAt, clientSessionKey);
  } catch (error) {
    if (clientSessionKey && String(error.message || '').includes('UNIQUE')) {
      const existing = db
        .prepare(
          `SELECT id, subject, duration_seconds AS durationSeconds, started_at AS startedAt, ended_at AS endedAt
           FROM sessions
           WHERE user_id = ? AND client_session_key = ?`
        )
        .get(req.user.id, clientSessionKey);
      if (existing) {
        return res.status(200).json({ session: existing });
      }
    }
    throw error;
  }

  const created = db
    .prepare(
      `SELECT id, subject, duration_seconds AS durationSeconds, started_at AS startedAt, ended_at AS endedAt
       FROM sessions
       WHERE id = ?`
    )
    .get(result.lastInsertRowid);

  return res.status(201).json({ session: created });
});

app.put('/api/sessions/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const { subject, durationSeconds, startedAt, endedAt } = req.body;

  const existing = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!durationSeconds || durationSeconds < 1 || !startedAt || !endedAt) {
    return res.status(400).json({ error: 'Invalid session data' });
  }

  db.prepare(
    `UPDATE sessions
     SET subject = ?, duration_seconds = ?, started_at = ?, ended_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(String(subject || '').trim(), Math.floor(durationSeconds), startedAt, endedAt, id, req.user.id);

  const updated = db
    .prepare(
      `SELECT id, subject, duration_seconds AS durationSeconds, started_at AS startedAt, ended_at AS endedAt
       FROM sessions
       WHERE id = ?`
    )
    .get(id);

  return res.json({ session: updated });
});

app.get('/api/stats', auth, (req, res) => {
  const config = getRangeConfig(req.query.range, req.query.cursor);
  const startIso = config.start.toISOString();
  const endExclusiveIso = config.endExclusive.toISOString();

  const todayStart = startOfTodayLocal();
  const tomorrowStart = addDays(todayStart, 1);
  const today = db
    .prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE user_id = ? AND started_at >= ? AND started_at < ?`
    )
    .get(req.user.id, todayStart.toISOString(), tomorrowStart.toISOString());

  const rangeTotal = db
    .prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE user_id = ? AND started_at >= ? AND started_at < ?`
    )
    .get(req.user.id, startIso, endExclusiveIso);

  const dayTotals = db
    .prepare(
      `SELECT date(datetime(started_at, 'localtime')) AS date, COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE user_id = ? AND started_at >= ? AND started_at < ?
       GROUP BY date
       ORDER BY date ASC`
    )
    .all(req.user.id, startIso, endExclusiveIso);
  const dayTotalsMap = new Map(dayTotals.map((row) => [row.date, row.total]));

  const bestDayRow = dayTotals.reduce(
    (best, row) => (row.total > best.total ? row : best),
    { date: null, total: 0 }
  );

  const monthRows = db
    .prepare(
      `SELECT strftime('%Y-%m', datetime(started_at, 'localtime')) AS monthKey, COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE user_id = ? AND started_at >= ? AND started_at < ?
       GROUP BY monthKey
       ORDER BY monthKey ASC`
    )
    .all(req.user.id, startIso, endExclusiveIso);
  const monthTotalsMap = new Map(monthRows.map((row) => [row.monthKey, row.total]));

  const bars =
    config.range === 'week'
      ? buildWeekBars(config.start, dayTotalsMap)
      : config.range === 'month'
        ? buildMonthBars(config.start, config.end, dayTotalsMap)
        : buildYearBars(config.start, monthTotalsMap);

  const activeDates = db
    .prepare(
      `SELECT date(datetime(started_at, 'localtime')) AS date
       FROM sessions
       WHERE user_id = ? AND started_at < ?
       GROUP BY date
       HAVING SUM(duration_seconds) > 0
       ORDER BY date DESC`
    )
    .all(req.user.id, tomorrowStart.toISOString());
  const activeDateSet = new Set(activeDates.map((row) => row.date));

  const savedSubjects = db
    .prepare(
      `SELECT id, name, color
       FROM subjects
       WHERE user_id = ?`
    )
    .all(req.user.id);
  const subjectLookup = new Map(
    savedSubjects.map((subject) => [normalizeSubjectName(subject.name).toLowerCase(), subject])
  );

  const subjectRows = db
    .prepare(
      `SELECT
         CASE
           WHEN trim(COALESCE(subject, '')) = '' THEN 'general'
           ELSE lower(trim(subject))
         END AS subjectKey,
         CASE
           WHEN trim(COALESCE(subject, '')) = '' THEN 'General'
           ELSE MIN(trim(subject))
         END AS subjectLabel,
         COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE user_id = ? AND started_at >= ? AND started_at < ?
       GROUP BY subjectKey
       ORDER BY total DESC, subjectLabel ASC`
    )
    .all(req.user.id, startIso, endExclusiveIso);

  const bucketExpression =
    config.range === 'year'
      ? `strftime('%Y-%m', datetime(started_at, 'localtime'))`
      : `date(datetime(started_at, 'localtime'))`;

  const bucketSubjectRows = db
    .prepare(
      `SELECT
         ${bucketExpression} AS bucketKey,
         CASE
           WHEN trim(COALESCE(subject, '')) = '' THEN 'general'
           ELSE lower(trim(subject))
         END AS subjectKey,
         CASE
           WHEN trim(COALESCE(subject, '')) = '' THEN 'General'
           ELSE MIN(trim(subject))
         END AS subjectLabel,
         COALESCE(SUM(duration_seconds), 0) AS total
       FROM sessions
       WHERE user_id = ? AND started_at >= ? AND started_at < ?
       GROUP BY bucketKey, subjectKey
       ORDER BY bucketKey ASC, total DESC, subjectLabel ASC`
    )
    .all(req.user.id, startIso, endExclusiveIso);

  const topSubjects = subjectRows.slice(0, 5).map((row) => ({
    normalizedSubject: row.subjectLabel,
    total: row.total,
  }));
  const otherTotal = subjectRows.slice(5).reduce((sum, row) => sum + row.total, 0);
  const subjectWithOther = otherTotal > 0 ? [...topSubjects, { normalizedSubject: 'Other', total: otherTotal }] : topSubjects;
  const denominator = rangeTotal.total || 1;
  const subjectTotals = subjectRows.map((row) => {
    const match = row.subjectKey === 'general' ? null : subjectLookup.get(row.subjectKey);
    return {
      subjectId: match?.id ?? null,
      subject: match?.name || row.subjectLabel,
      color: normalizeSubjectColor(match?.color),
      totalSeconds: row.total,
      percent: Number(((row.total / denominator) * 100).toFixed(1)),
    };
  });

  const barSubjectMap = new Map();
  for (const row of bucketSubjectRows) {
    const match = row.subjectKey === 'general' ? null : subjectLookup.get(row.subjectKey);
    const entry = {
      subjectId: match?.id ?? null,
      subject: match?.name || row.subjectLabel,
      color: normalizeSubjectColor(match?.color),
      totalSeconds: row.total,
    };
    const existing = barSubjectMap.get(row.bucketKey);
    if (existing) {
      existing.push(entry);
    } else {
      barSubjectMap.set(row.bucketKey, [entry]);
    }
  }

  const barSubjectTotals = bars.map((bar) => {
    const bucketKey = config.range === 'year' ? String(bar.date).slice(0, 7) : bar.date;
    const segments = (barSubjectMap.get(bucketKey) || []).filter((item) => item.totalSeconds > 0);
    return {
      label: bar.label,
      date: bar.date,
      totalSeconds: bar.totalSeconds,
      segments,
    };
  });

  return res.json({
    range: config.range,
    periodStart: toIsoDateLocal(config.start),
    periodEnd: toIsoDateLocal(config.end),
    periodLabel: config.periodLabel,
    isCurrentPeriod: config.isCurrentPeriod,
    todayTotalSeconds: today.total,
    rangeTotalSeconds: rangeTotal.total,
    dailyAverageSeconds: Math.floor(rangeTotal.total / config.averageDivisor),
    bestDay: { date: bestDayRow.date, totalSeconds: bestDayRow.total },
    currentStreakDays: calculateCurrentStreak(activeDateSet),
    bars,
    subjectBreakdown: subjectWithOther.map((row) => ({
      subject: row.normalizedSubject,
      totalSeconds: row.total,
      percent: Number(((row.total / denominator) * 100).toFixed(1)),
    })),
    subjectTotals,
    barSubjectTotals,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
