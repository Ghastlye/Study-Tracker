import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthForm from './components/AuthForm';
import TimerCard from './components/TimerCard';
import StatsCard from './components/StatsCard';
import SubjectStatsCard from './components/SubjectStatsCard';
import SessionList from './components/SessionList';
import SettingsModal from './components/SettingsModal';
import { api, clearToken, setAuthFailureHandler, setToken } from './lib/api';
import { SUBJECT_COLOR_PALETTE } from './lib/subjectVisuals';

const LOCAL_PREFERENCES_KEY = 'study_preferences_v3';
const LOCAL_ACTIVE_TIMER_KEY = 'study_active_timer_v1';
const LOCAL_SESSION_QUEUE_KEY = 'study_session_queue_v1';

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

const THEME_ACCENTS = {
  moonstone: '#6a7f9a',
  tangerine: '#d4733f',
  raspberry: '#c2416e',
  blue: '#2563eb',
  green: '#2f8f5b',
  brown: '#8c5a3c',
};

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return new Date();
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizePreferences(input = {}) {
  const mode = ['dark', 'light'].includes(input.mode) ? input.mode : DEFAULT_PREFERENCES.mode;
  const rawTheme = input.theme === 'organic' ? 'tangerine' : input.theme === 'neutral' ? 'moonstone' : input.theme;
  const theme = ['moonstone', 'tangerine', 'raspberry', 'blue', 'green', 'brown'].includes(rawTheme)
    ? rawTheme
    : DEFAULT_PREFERENCES.theme;
  const textScale = ['sm', 'md', 'lg'].includes(input.textScale)
    ? input.textScale
    : DEFAULT_PREFERENCES.textScale;
  const density = ['comfortable', 'compact'].includes(input.density)
    ? input.density
    : DEFAULT_PREFERENCES.density;
  const defaultTimerMode = ['focus', 'pomodoro'].includes(input.defaultTimerMode)
    ? input.defaultTimerMode
    : DEFAULT_PREFERENCES.defaultTimerMode;

  const workMinutes = Number(input.pomodoroWorkMinutes);
  const breakMinutes = Number(input.pomodoroBreakMinutes);

  const timezone = typeof input.timezone === 'string' && input.timezone.trim() ? input.timezone : 'local';
  const dateFormat = ['auto', 'dmy', 'mdy', 'ymd'].includes(input.dateFormat)
    ? input.dateFormat
    : DEFAULT_PREFERENCES.dateFormat;
  const language = ['en', 'en-AU', 'en-US'].includes(input.language)
    ? input.language
    : DEFAULT_PREFERENCES.language;

  return {
    mode,
    theme,
    textScale,
    reduceMotion: Boolean(input.reduceMotion),
    density,
    defaultTimerMode,
    pomodoroWorkMinutes: Number.isInteger(workMinutes)
      ? Math.min(Math.max(workMinutes, 1), 180)
      : DEFAULT_PREFERENCES.pomodoroWorkMinutes,
    pomodoroBreakMinutes: Number.isInteger(breakMinutes)
      ? Math.min(Math.max(breakMinutes, 1), 120)
      : DEFAULT_PREFERENCES.pomodoroBreakMinutes,
    defaultSubjectId:
      Number.isInteger(Number(input.defaultSubjectId)) && Number(input.defaultSubjectId) > 0
        ? Number(input.defaultSubjectId)
        : null,
    timezone,
    dateFormat,
    language,
    keyboardShortcuts: Boolean(input.keyboardShortcuts ?? DEFAULT_PREFERENCES.keyboardShortcuts),
  };
}

function readLocalPreferences() {
  try {
    const raw = localStorage.getItem(LOCAL_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function readActiveTimerState() {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVE_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.running !== true || !parsed.sessionStartIso) return null;

    const started = new Date(parsed.sessionStartIso);
    if (Number.isNaN(started.getTime())) return null;

    return {
      running: true,
      sessionStartIso: started.toISOString(),
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      pomodoroEnabled: Boolean(parsed.pomodoroEnabled),
      workMinutes: Number(parsed.workMinutes) || 25,
      breakMinutes: Number(parsed.breakMinutes) || 5,
      isBreak: Boolean(parsed.isBreak),
    };
  } catch {
    return null;
  }
}

function writeActiveTimerState(state) {
  if (!state?.running) {
    localStorage.removeItem(LOCAL_ACTIVE_TIMER_KEY);
    return;
  }
  localStorage.setItem(LOCAL_ACTIVE_TIMER_KEY, JSON.stringify(state));
}

function clearActiveTimerState() {
  localStorage.removeItem(LOCAL_ACTIVE_TIMER_KEY);
}

function readSessionQueue() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.clientSessionKey && item.payload)
      .map((item) => ({
        clientSessionKey: String(item.clientSessionKey),
        payload: item.payload,
        createdAt: item.createdAt || new Date().toISOString(),
        attempts: Number(item.attempts) || 0,
        lastError: typeof item.lastError === 'string' ? item.lastError : '',
        discardable: Boolean(item.discardable),
      }));
  } catch {
    return [];
  }
}

function writeSessionQueue(queue) {
  if (!queue?.length) {
    localStorage.removeItem(LOCAL_SESSION_QUEUE_KEY);
    return;
  }
  localStorage.setItem(LOCAL_SESSION_QUEUE_KEY, JSON.stringify(queue));
}

function createClientSessionKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function applyAppearance(preferences) {
  const root = document.documentElement;
  root.setAttribute('data-mode', preferences.mode);
  root.setAttribute('data-text-scale', preferences.textScale);
  root.setAttribute('data-density', preferences.density);
  root.setAttribute('data-reduce-motion', preferences.reduceMotion ? 'true' : 'false');
  root.style.setProperty('--accent', THEME_ACCENTS[preferences.theme] || THEME_ACCENTS.moonstone);
  root.style.setProperty('--accent-contrast', preferences.mode === 'light' ? '#ffffff' : '#0a0a0a');

  if (preferences.mode === 'light' && preferences.theme === 'tangerine') {
    root.style.setProperty('--bg', '#f5f5f2');
    root.style.setProperty('--surface', '#efeee9');
    root.style.setProperty('--card', '#f9f8f4');
    root.style.setProperty('--text', '#2f2b25');
    root.style.setProperty('--muted', '#7c756a');
    root.style.setProperty('--border', '#ddd8cc');
    return;
  }

  if (preferences.mode === 'light') {
    root.style.setProperty('--bg', '#f7f7f6');
    root.style.setProperty('--surface', '#f1f2f4');
    root.style.setProperty('--card', '#fbfbfc');
    root.style.setProperty('--text', '#1f2937');
    root.style.setProperty('--muted', '#6b7280');
    root.style.setProperty('--border', '#d7dbe0');
    return;
  }

  root.style.setProperty('--bg', '#111214');
  root.style.setProperty('--surface', '#171a1f');
  root.style.setProperty('--card', '#1d2026');
  root.style.setProperty('--text', '#eceff3');
  root.style.setProperty('--muted', '#9ba3af');
  root.style.setProperty('--border', '#2e3440');
}

function emptyStats() {
  return {
    range: 'week',
    periodStart: null,
    periodEnd: null,
    periodLabel: 'Current period',
    isCurrentPeriod: true,
    todayTotalSeconds: 0,
    rangeTotalSeconds: 0,
    dailyAverageSeconds: 0,
    bestDay: { date: null, totalSeconds: 0 },
    currentStreakDays: 0,
    bars: [],
    barSubjectTotals: [],
    subjectBreakdown: [],
    subjectTotals: [],
  };
}

function getDateLocale(preferences) {
  if (preferences.dateFormat === 'dmy') return 'en-GB';
  if (preferences.dateFormat === 'mdy') return 'en-US';
  if (preferences.dateFormat === 'ymd') return 'sv-SE';
  return preferences.language === 'en' ? undefined : preferences.language;
}

function toUserErrorMessage(error, fallback = 'Request failed') {
  if (error?.code === 'NETWORK') {
    return 'Cannot reach server at localhost:4000';
  }
  if (error?.code === 'AUTH' || error?.status === 401) {
    return 'Session expired. Please log in again';
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function App() {
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [busySettings, setBusySettings] = useState(false);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [queueMeta, setQueueMeta] = useState({ pending: 0, discardable: 0 });
  const [importSummary, setImportSummary] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState('general');

  const [preferences, setPreferences] = useState(readLocalPreferences);

  const [running, setRunning] = useState(false);
  const [sessionStart, setSessionStart] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [subject, setSubject] = useState('');
  const [startPulseKey, setStartPulseKey] = useState(0);

  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [isBreak, setIsBreak] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [statsRange, setStatsRange] = useState('week');
  const [statsCursor, setStatsCursor] = useState(() => formatLocalDate(new Date()));
  const [stats, setStats] = useState(emptyStats);
  const queueFlushInFlightRef = useRef(false);

  const setQueueFromStorage = useCallback(() => {
    const queue = readSessionQueue();
    const discardable = queue.filter((item) => item.discardable).length;
    setQueueMeta({ pending: queue.length, discardable });
    return queue;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearActiveTimerState();
    writeSessionQueue([]);
    setUser(null);
    setAccount(null);
    setSubjects([]);
    setSessions([]);
    setStats(emptyStats());
    setSessionStart(null);
    setElapsedSeconds(0);
    setRunning(false);
    setSyncStatus('');
    setQueueMeta({ pending: 0, discardable: 0 });
    setIsSettingsOpen(false);
  }, []);

  const handleError = useCallback((incomingError, fallbackMessage) => {
    setError(toUserErrorMessage(incomingError, fallbackMessage));
  }, []);

  const refreshCollections = useCallback(async () => {
    const [subjectData, sessionData] = await Promise.all([api.listSubjects(), api.listSessions()]);
    setSubjects(subjectData.subjects);
    setSessions(sessionData.sessions);
  }, []);

  const refreshStatsData = useCallback(
    async (rangeOverride, cursorOverride) => {
      const range = rangeOverride || statsRange;
      const cursor = cursorOverride || statsCursor;
      const statsData = await api.stats(range, cursor);
      setStats(statsData);
    },
    [statsRange, statsCursor]
  );

  const flushSessionQueue = useCallback(
    async ({ manual = false } = {}) => {
      if (!user || queueFlushInFlightRef.current) return;
      const initialQueue = setQueueFromStorage();
      if (!initialQueue.length) {
        if (manual) setSyncStatus('');
        return;
      }

      queueFlushInFlightRef.current = true;
      const remaining = [];
      let savedCount = 0;

      try {
        for (const item of initialQueue) {
          try {
            await api.createSession(item.payload);
            savedCount += 1;
          } catch (queueError) {
            if (queueError?.code === 'AUTH' || queueError?.status === 401) {
              setError('Session expired. Please log in again');
              logout();
              return;
            }

            const recoverable =
              queueError?.code === 'NETWORK' ||
              (queueError?.code === 'HTTP' && Boolean(queueError?.recoverable));

            remaining.push({
              ...item,
              attempts: (Number(item.attempts) || 0) + 1,
              lastError: toUserErrorMessage(queueError),
              discardable: !recoverable,
            });
          }
        }

        writeSessionQueue(remaining);
        const discardable = remaining.filter((item) => item.discardable).length;
        setQueueMeta({ pending: remaining.length, discardable });

        if (savedCount > 0) {
          await Promise.all([refreshCollections(), refreshStatsData()]);
        }

        if (!remaining.length) {
          setSyncStatus(savedCount > 0 ? 'Saved sessions synced.' : '');
          return;
        }

        if (discardable > 0) {
          setSyncStatus('Some saved sessions could not sync.');
        } else {
          setSyncStatus('Saved locally. Syncing when connection returns');
        }
      } finally {
        queueFlushInFlightRef.current = false;
      }
    },
    [logout, refreshCollections, refreshStatsData, setQueueFromStorage, user]
  );

  const discardFailedQueueItems = useCallback(() => {
    const kept = readSessionQueue().filter((item) => !item.discardable);
    writeSessionQueue(kept);
    const discardable = kept.filter((item) => item.discardable).length;
    setQueueMeta({ pending: kept.length, discardable });
    if (!kept.length) {
      setSyncStatus('');
      return;
    }
    setSyncStatus('Saved locally. Syncing when connection returns');
  }, []);

  useEffect(() => {
    applyAppearance(preferences);
    localStorage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
    localStorage.setItem('study_mode', preferences.mode);
    localStorage.setItem('study_theme', preferences.theme);
  }, [preferences]);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setError('Session expired. Please log in again');
      logout();
    });
    return () => setAuthFailureHandler(null);
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await api.me();
        setUser(me.user);
      } catch {
        clearToken();
      }
    };
    init();
  }, []);

  const loadSettingsAndAccount = useCallback(async () => {
    const [settingsResult, accountResult] = await Promise.all([
      api.settings().catch(() => null),
      api.account().catch(() => null),
    ]);

    if (settingsResult?.preferences) {
      setPreferences(normalizePreferences(settingsResult.preferences));
    }

    if (accountResult?.account) {
      setAccount(accountResult.account);
    }
  }, []);

  useEffect(() => {
    const queue = setQueueFromStorage();
    if (!queue.length) return;
    setSyncStatus('Saved locally. Syncing when connection returns');
  }, [setQueueFromStorage]);

  useEffect(() => {
    if (syncStatus !== 'Saved sessions synced.') return undefined;
    const id = window.setTimeout(() => setSyncStatus(''), 2200);
    return () => window.clearTimeout(id);
  }, [syncStatus]);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadSettingsAndAccount(), refreshCollections()])
      .then(() => flushSessionQueue())
      .catch((e) => handleError(e));
  }, [user, loadSettingsAndAccount, refreshCollections, flushSessionQueue, handleError]);

  useEffect(() => {
    if (!user) return;
    refreshStatsData().catch((e) => handleError(e));
  }, [user, statsRange, statsCursor, refreshStatsData, handleError]);

  useEffect(() => {
    if (!user) return;
    const restored = readActiveTimerState();
    if (!restored) return;

    const startedAt = new Date(restored.sessionStartIso);
    setSessionStart(startedAt);
    setRunning(true);
    setSubject(restored.subject || '');
    setPomodoroEnabled(restored.pomodoroEnabled);
    setWorkMinutes(Math.min(Math.max(Number(restored.workMinutes) || 25, 1), 180));
    setBreakMinutes(Math.min(Math.max(Number(restored.breakMinutes) || 5, 1), 120));
    setIsBreak(Boolean(restored.isBreak));
    setElapsedSeconds(Math.max(Math.floor((Date.now() - startedAt.getTime()) / 1000), 0));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const onOnline = () => {
      flushSessionQueue().catch((e) => handleError(e));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user, flushSessionQueue, handleError]);

  useEffect(() => {
    if (!user) return undefined;
    const id = window.setInterval(() => {
      const queue = readSessionQueue();
      if (!queue.length) return;
      flushSessionQueue().catch((e) => handleError(e));
    }, 20000);
    return () => window.clearInterval(id);
  }, [user, flushSessionQueue, handleError]);

  useEffect(() => {
    if (!running) {
      setPomodoroEnabled(preferences.defaultTimerMode === 'pomodoro');
      setWorkMinutes(preferences.pomodoroWorkMinutes);
      setBreakMinutes(preferences.pomodoroBreakMinutes);
    }
  }, [preferences.defaultTimerMode, preferences.pomodoroWorkMinutes, preferences.pomodoroBreakMinutes, running]);

  useEffect(() => {
    if (subject && !subjects.some((item) => item.name === subject)) {
      setSubject('');
      return;
    }

    if (subject) return;
    if (!preferences.defaultSubjectId) return;

    const defaultSubject = subjects.find((item) => item.id === preferences.defaultSubjectId);
    if (defaultSubject) {
      setSubject(defaultSubject.name);
    }
  }, [preferences.defaultSubjectId, subjects, subject]);

  useEffect(() => {
    if (!running) return undefined;

    const id = setInterval(() => {
      if (!sessionStart) return;
      const seconds = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
      setElapsedSeconds(seconds);

      if (pomodoroEnabled) {
        const segmentSeconds = (isBreak ? breakMinutes : workMinutes) * 60;
        if (seconds >= segmentSeconds) {
          setIsBreak((prev) => !prev);
          setSessionStart(new Date());
          setElapsedSeconds(0);
        }
      }
    }, 1000);

    return () => clearInterval(id);
  }, [running, sessionStart, pomodoroEnabled, workMinutes, breakMinutes, isBreak]);

  useEffect(() => {
    if (!running || !sessionStart) {
      clearActiveTimerState();
      return;
    }
    writeActiveTimerState({
      running: true,
      sessionStartIso: sessionStart.toISOString(),
      subject,
      pomodoroEnabled,
      workMinutes,
      breakMinutes,
      isBreak,
    });
  }, [running, sessionStart, subject, pomodoroEnabled, workMinutes, breakMinutes, isBreak]);

  const cycleLabel = useMemo(() => {
    if (!pomodoroEnabled) return 'Focus Session';
    return isBreak ? 'Break' : 'Focus';
  }, [pomodoroEnabled, isBreak]);

  const start = useCallback(() => {
    setError('');
    setSessionStart(new Date());
    setElapsedSeconds(0);
    setIsBreak(false);
    setRunning(true);
    setStartPulseKey((prev) => prev + 1);
  }, []);

  const stop = useCallback(async () => {
    if (!sessionStart || elapsedSeconds < 1) {
      setRunning(false);
      setSessionStart(null);
      setElapsedSeconds(0);
      clearActiveTimerState();
      return;
    }

    setRunning(false);
    const payload = {
      subject,
      durationSeconds: elapsedSeconds,
      startedAt: sessionStart.toISOString(),
      endedAt: new Date().toISOString(),
      clientSessionKey: createClientSessionKey(),
    };

    try {
      await api.createSession(payload);
      setSubject('');
      setElapsedSeconds(0);
      setSessionStart(null);
      clearActiveTimerState();
      await Promise.all([refreshCollections(), refreshStatsData()]);
    } catch (e) {
      const recoverable = e?.code === 'NETWORK' || (e?.code === 'HTTP' && Boolean(e?.recoverable));
      if (recoverable) {
        const queue = readSessionQueue();
        queue.push({
          clientSessionKey: payload.clientSessionKey,
          payload,
          createdAt: new Date().toISOString(),
          attempts: 0,
          lastError: '',
          discardable: false,
        });
        writeSessionQueue(queue);
        setQueueMeta({ pending: queue.length, discardable: 0 });
        setSyncStatus('Saved locally. Syncing when connection returns');
        setError('');
        setSubject('');
        setElapsedSeconds(0);
        setSessionStart(null);
        clearActiveTimerState();
        return;
      }
      handleError(e, 'Failed to save session');
    }
  }, [elapsedSeconds, handleError, refreshCollections, refreshStatsData, sessionStart, subject]);

  useEffect(() => {
    if (!user || !preferences.keyboardShortcuts) return undefined;

    const onKeyDown = (event) => {
      const target = event.target;
      const tagName = target?.tagName;
      const isTypingTarget =
        target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tagName);

      if (isTypingTarget) return;

      if (event.key === ',') {
        event.preventDefault();
        setSettingsSection('general');
        setIsSettingsOpen(true);
        return;
      }

      if (isSettingsOpen) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (running) {
          stop();
        } else {
          start();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user, preferences.keyboardShortcuts, isSettingsOpen, running, start, stop]);

  const handleAuth = async (email, password) => {
    setLoadingAuth(true);
    setError('');
    try {
      const result = authMode === 'login' ? await api.login(email, password) : await api.register(email, password);
      setToken(result.token);
      setUser(result.user);
    } catch (e) {
      handleError(e, 'Authentication failed');
    } finally {
      setLoadingAuth(false);
    }
  };

  const updatePreferences = async (patch) => {
    setPreferences((prev) => normalizePreferences({ ...prev, ...patch }));
    setBusySettings(true);
    setError('');
    try {
      const result = await api.updateSettings(patch);
      if (result?.preferences) {
        setPreferences(normalizePreferences(result.preferences));
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const saveSession = async (id, payload) => {
    try {
      await api.updateSession(id, payload);
      await Promise.all([refreshCollections(), refreshStatsData()]);
    } catch (e) {
      handleError(e);
    }
  };

  const createSubject = async ({ name, color }) => {
    setBusySettings(true);
    setError('');
    try {
      await api.createSubject({ name, color });
      await Promise.all([refreshCollections(), refreshStatsData()]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const updateSubject = async (id, payload) => {
    const name = payload?.name?.trim();
    if (!name) {
      setError('Subject name cannot be empty');
      return;
    }

    setBusySettings(true);
    setError('');
    try {
      await api.updateSubject(id, { name, color: payload.color });
      await Promise.all([refreshCollections(), refreshStatsData()]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const deleteSubject = async (id) => {
    setBusySettings(true);
    setError('');
    try {
      await api.deleteSubject(id);
      setPreferences((prev) => (prev.defaultSubjectId === id ? { ...prev, defaultSubjectId: null } : prev));
      await Promise.all([refreshCollections(), refreshStatsData()]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const updateProfile = async (displayName) => {
    setBusySettings(true);
    setError('');
    try {
      const result = await api.updateProfile(displayName);
      if (result?.account) {
        setAccount(result.account);
        setUser((prev) => (prev ? { ...prev, displayName: result.account.displayName || null } : prev));
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const updateEmail = async (email, currentPassword) => {
    setBusySettings(true);
    setError('');
    try {
      const result = await api.updateEmail(email, currentPassword);
      setToken(result.token);
      setUser(result.user);
      setAccount((prev) => ({ ...(prev || {}), email: result.user.email }));
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const updatePassword = async (currentPassword, newPassword) => {
    setBusySettings(true);
    setError('');
    try {
      await api.updatePassword(currentPassword, newPassword);
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const logoutAllSessions = async (currentPassword) => {
    setBusySettings(true);
    setError('');
    try {
      await api.logoutAllSessions(currentPassword);
      logout();
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const deleteAccount = async (currentPassword) => {
    setBusySettings(true);
    setError('');
    try {
      await api.deleteAccount(currentPassword);
      logout();
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const exportData = async () => {
    setBusySettings(true);
    setError('');
    try {
      const blob = await api.exportData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `study-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const importData = async (file) => {
    setBusySettings(true);
    setError('');
    setImportSummary('');
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const result = await api.importData(payload);
      setImportSummary(
        `Imported ${result.imported.sessions} sessions and ${result.imported.subjects} subjects. ` +
          `Skipped ${result.skipped.sessions} sessions and ${result.skipped.subjects} subjects.`
      );
      await Promise.all([refreshCollections(), refreshStatsData(), loadSettingsAndAccount()]);
    } catch (e) {
      handleError(e, 'Failed to import data');
    } finally {
      setBusySettings(false);
    }
  };

  const resetData = async () => {
    setBusySettings(true);
    setError('');
    setImportSummary('');
    try {
      await api.resetData();
      const todayCursor = formatLocalDate(new Date());
      setStatsCursor(todayCursor);
      setSubject('');
      clearActiveTimerState();
      writeSessionQueue([]);
      setQueueMeta({ pending: 0, discardable: 0 });
      setSyncStatus('');
      setImportSummary('All study data has been reset.');
      await Promise.all([refreshCollections(), refreshStatsData(undefined, todayCursor), loadSettingsAndAccount()]);
    } catch (e) {
      handleError(e);
    } finally {
      setBusySettings(false);
    }
  };

  const shiftPeriod = (direction) => {
    setStatsCursor((prevCursor) => {
      const base = parseLocalDate(prevCursor);
      if (statsRange === 'week') {
        base.setDate(base.getDate() + direction * 7);
      } else if (statsRange === 'month') {
        base.setMonth(base.getMonth() + direction);
      } else {
        base.setFullYear(base.getFullYear() + direction);
      }
      return formatLocalDate(base);
    });
  };

  const formatDateTime = useMemo(() => {
    const locale = getDateLocale(preferences);
    const options = {
      year: 'numeric',
      month: preferences.dateFormat === 'auto' ? 'short' : '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      ...(preferences.timezone !== 'local' ? { timeZone: preferences.timezone } : {}),
    };

    return (input) => {
      const date = new Date(input);
      if (Number.isNaN(date.getTime())) return '-';
      return new Intl.DateTimeFormat(locale, options).format(date);
    };
  }, [preferences]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-[var(--text)]">
        <div className="space-y-4">
          <AuthForm onSubmit={handleAuth} mode={authMode} loading={loadingAuth} />
          <button
            className="text-sm text-[var(--muted)] underline underline-offset-4"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Need an account?' : 'Already have an account?'}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Study Tracker</h1>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {syncStatus && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
            <span>
              {syncStatus}
              {queueMeta.pending > 0 ? ` (${queueMeta.pending} queued)` : ''}
            </span>
            {queueMeta.pending > 0 && (
              <button
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text)] hover:border-[var(--accent)]"
                onClick={() => flushSessionQueue({ manual: true }).catch((e) => handleError(e))}
              >
                Retry now
              </button>
            )}
            {queueMeta.discardable > 0 && (
              <button
                className="rounded border border-red-400/50 px-2 py-0.5 text-xs text-red-400 hover:border-red-400"
                onClick={discardFailedQueueItems}
              >
                Discard failed
              </button>
            )}
          </div>
        )}

        <TimerCard
          running={running}
          elapsedSeconds={elapsedSeconds}
          onStart={start}
          onStop={stop}
          subjects={subjects}
          subject={subject}
          setSubject={setSubject}
          pomodoroEnabled={pomodoroEnabled}
          setPomodoroEnabled={setPomodoroEnabled}
          workMinutes={workMinutes}
          breakMinutes={breakMinutes}
          setWorkMinutes={setWorkMinutes}
          setBreakMinutes={setBreakMinutes}
          cycleLabel={cycleLabel}
          startPulseKey={startPulseKey}
          colorPalette={SUBJECT_COLOR_PALETTE}
        />

        <StatsCard
          stats={stats}
          statsRange={statsRange}
          onRangeChange={setStatsRange}
          onPreviousPeriod={() => shiftPeriod(-1)}
          onNextPeriod={() => {
            if (!stats.isCurrentPeriod) shiftPeriod(1);
          }}
          onResetToToday={() => setStatsCursor(formatLocalDate(new Date()))}
          colorPalette={SUBJECT_COLOR_PALETTE}
        />

        <SubjectStatsCard stats={stats} colorPalette={SUBJECT_COLOR_PALETTE} />

        <SessionList sessions={sessions} onSave={saveSession} formatDateTime={formatDateTime} />
      </div>

      <button
        className={`fixed bottom-5 left-5 flex h-11 w-11 items-center justify-center rounded-full border bg-[var(--card)] text-[var(--text)] shadow-sm transition ${
          isSettingsOpen
            ? 'border-[var(--accent)]'
            : 'border-[var(--border)] hover:border-[var(--accent)]'
        }`}
        onClick={() => {
          setSettingsSection('general');
          setIsSettingsOpen((prev) => !prev);
        }}
        aria-label={isSettingsOpen ? 'Close settings' : 'Open settings'}
        title={isSettingsOpen ? 'Close settings' : 'Open settings'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M4.5 20C4.5 16.9624 7.41015 14.5 12 14.5C16.5899 14.5 19.5 16.9624 19.5 20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeSection={settingsSection}
        onSectionChange={setSettingsSection}
        preferences={preferences}
        account={account || user}
        subjects={subjects}
        busy={busySettings}
        importSummary={importSummary}
        onSaveGeneralPreferences={updatePreferences}
        onUpdatePreferences={updatePreferences}
        onUpdateProfile={updateProfile}
        onUpdateEmail={updateEmail}
        onUpdatePassword={updatePassword}
        onLogoutAllSessions={logoutAllSessions}
        onDeleteAccount={deleteAccount}
        onLogout={logout}
        onCreateSubject={createSubject}
        onUpdateSubject={updateSubject}
        onDeleteSubject={deleteSubject}
        onExportData={exportData}
        onImportData={importData}
        onResetData={resetData}
      />
    </main>
  );
}
