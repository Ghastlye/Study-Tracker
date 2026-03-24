import { useEffect, useMemo, useRef, useState } from 'react';
import Dropdown from './Dropdown';

const THEME_OPTIONS = [
  { key: 'moonstone', name: 'Moonstone', accent: '#6a7f9a' },
  { key: 'tangerine', name: 'Tangerine', accent: '#d4733f' },
  { key: 'raspberry', name: 'Raspberry', accent: '#c2416e' },
  { key: 'blue', name: 'Blue', accent: '#2563eb' },
  { key: 'green', name: 'Green', accent: '#2f8f5b' },
  { key: 'brown', name: 'Brown', accent: '#8c5a3c' },
];

const SUBJECT_COLOR_OPTIONS = [
  { key: 'slate', label: 'Slate', hex: '#64748b' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
  { key: 'green', label: 'Green', hex: '#22c55e' },
  { key: 'brown', label: 'Brown', hex: '#a16207' },
  { key: 'orange', label: 'Orange', hex: '#f97316' },
  { key: 'pink', label: 'Pink', hex: '#ec4899' },
  { key: 'purple', label: 'Purple', hex: '#a855f7' },
  { key: 'teal', label: 'Teal', hex: '#14b8a6' },
  { key: 'red', label: 'Red', hex: '#ef4444' },
];

const SUBJECT_COLOR_HEX_BY_KEY = SUBJECT_COLOR_OPTIONS.reduce((acc, item) => {
  acc[item.key] = item.hex;
  return acc;
}, {});

function getSubjectColorHex(colorKey) {
  return SUBJECT_COLOR_HEX_BY_KEY[colorKey] || SUBJECT_COLOR_HEX_BY_KEY.slate;
}

const SECTIONS = [
  { key: 'general', label: 'General' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'theme', label: 'Theme' },
  { key: 'account', label: 'Account' },
  { key: 'data', label: 'Data' },
  { key: 'security', label: 'Security' },
];

const TIMEZONE_OPTIONS_BASE = [
  { value: 'local', label: 'Local system timezone' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'Europe/London', label: 'Europe/London' },
];

function SectionButton({ section, activeSection, onClick }) {
  const active = activeSection === section.key;
  return (
    <button
      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? 'bg-[var(--surface)] text-[var(--text)]'
          : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
      }`}
      onClick={() => onClick(section.key)}
    >
      {section.label}
    </button>
  );
}

function GeneralPanel({ preferences, subjects, busy, onSaveGeneralPreferences }) {
  const [form, setForm] = useState({
    defaultTimerMode: preferences.defaultTimerMode,
    pomodoroWorkMinutes: preferences.pomodoroWorkMinutes,
    pomodoroBreakMinutes: preferences.pomodoroBreakMinutes,
    defaultSubjectId: preferences.defaultSubjectId,
    timezone: preferences.timezone,
    dateFormat: preferences.dateFormat,
    language: preferences.language,
    keyboardShortcuts: preferences.keyboardShortcuts,
  });

  useEffect(() => {
    setForm({
      defaultTimerMode: preferences.defaultTimerMode,
      pomodoroWorkMinutes: preferences.pomodoroWorkMinutes,
      pomodoroBreakMinutes: preferences.pomodoroBreakMinutes,
      defaultSubjectId: preferences.defaultSubjectId,
      timezone: preferences.timezone,
      dateFormat: preferences.dateFormat,
      language: preferences.language,
      keyboardShortcuts: preferences.keyboardShortcuts,
    });
  }, [preferences]);

  const timezoneOptions = useMemo(() => {
    const existing = new Set(TIMEZONE_OPTIONS_BASE.map((item) => item.value));
    const merged = [...TIMEZONE_OPTIONS_BASE];
    if (form.timezone && !existing.has(form.timezone)) {
      merged.push({ value: form.timezone, label: form.timezone });
    }
    return merged;
  }, [form.timezone]);

  const subjectOptions = [
    { value: null, label: 'None' },
    ...subjects.map((subject) => ({
      value: subject.id,
      label: subject.name,
      color: getSubjectColorHex(subject.color || 'slate'),
    })),
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text)]">General</h2>

      <form
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveGeneralPreferences({
            defaultTimerMode: form.defaultTimerMode,
            pomodoroWorkMinutes: Number(form.pomodoroWorkMinutes),
            pomodoroBreakMinutes: Number(form.pomodoroBreakMinutes),
            defaultSubjectId: form.defaultSubjectId,
            timezone: form.timezone,
            dateFormat: form.dateFormat,
            language: form.language,
            keyboardShortcuts: form.keyboardShortcuts,
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Default timer mode</span>
            <Dropdown
              options={[
                { value: 'focus', label: 'Focus' },
                { value: 'pomodoro', label: 'Pomodoro' },
              ]}
              value={form.defaultTimerMode}
              onChange={(value) => setForm((prev) => ({ ...prev, defaultTimerMode: value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Default subject</span>
            <Dropdown
              options={subjectOptions}
              value={form.defaultSubjectId}
              onChange={(value) => setForm((prev) => ({ ...prev, defaultSubjectId: value }))}
              showColorSwatch
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Pomodoro work (minutes)</span>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
              type="number"
              min={1}
              max={180}
              value={form.pomodoroWorkMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, pomodoroWorkMinutes: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Pomodoro break (minutes)</span>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
              type="number"
              min={1}
              max={120}
              value={form.pomodoroBreakMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, pomodoroBreakMinutes: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Timezone</span>
            <Dropdown
              options={timezoneOptions}
              value={form.timezone}
              onChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Date format</span>
            <Dropdown
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'dmy', label: 'DD/MM/YYYY' },
                { value: 'mdy', label: 'MM/DD/YYYY' },
                { value: 'ymd', label: 'YYYY-MM-DD' },
              ]}
              value={form.dateFormat}
              onChange={(value) => setForm((prev) => ({ ...prev, dateFormat: value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[var(--muted)]">Language</span>
            <Dropdown
              options={[
                { value: 'en', label: 'English (Auto)' },
                { value: 'en-AU', label: 'English (AU)' },
                { value: 'en-US', label: 'English (US)' },
              ]}
              value={form.language}
              onChange={(value) => setForm((prev) => ({ ...prev, language: value }))}
            />
          </label>

          <label className="flex items-center gap-2 pt-6 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={form.keyboardShortcuts}
              onChange={(event) => setForm((prev) => ({ ...prev, keyboardShortcuts: event.target.checked }))}
            />
            Enable keyboard shortcuts
          </label>
        </div>

        <button
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-contrast)] disabled:opacity-50"
          disabled={busy}
        >
          Save general settings
        </button>
      </form>
    </div>
  );
}

function SubjectsPanel({ subjects, busy, onCreateSubject, onUpdateSubject, onDeleteSubject }) {
  const [newSubject, setNewSubject] = useState('');
  const [newColor, setNewColor] = useState('slate');
  const [menuSubjectId, setMenuSubjectId] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (event.target.closest('[data-subject-menu-button="true"]')) {
        return;
      }
      if (!menuRef.current?.contains(event.target)) {
        setMenuSubjectId(null);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const colorOptions = SUBJECT_COLOR_OPTIONS.map((item) => ({
    value: item.key,
    label: item.label,
    color: item.hex,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text)]">Subjects</h2>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newSubject.trim();
          if (!name) return;
          onCreateSubject({ name, color: newColor });
          setNewSubject('');
          setNewColor('slate');
        }}
      >
        <input
          className="min-w-[200px] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          placeholder="Add a subject"
          value={newSubject}
          onChange={(event) => setNewSubject(event.target.value)}
          maxLength={60}
        />
        <Dropdown
          className="w-[160px]"
          options={colorOptions}
          value={newColor}
          onChange={(value) => setNewColor(value)}
          showColorSwatch
        />
        <button
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-contrast)] disabled:opacity-50"
          disabled={busy}
        >
          Add
        </button>
      </form>

      <div className="space-y-2">
        {subjects.length === 0 && <p className="text-sm text-[var(--muted)]">No saved subjects yet.</p>}
        {subjects.map((subject) => (
          <div key={subject.id} className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: getSubjectColorHex(subject.color || 'slate') }}
                />
                <span className="text-sm text-[var(--text)]">{subject.name}</span>
              </div>
              <button
                className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--text)]"
                onClick={() => setMenuSubjectId((prev) => (prev === subject.id ? null : subject.id))}
                data-subject-menu-button="true"
                aria-label={`Subject actions for ${subject.name}`}
                title="Actions"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="10" cy="4" r="1.4" fill="currentColor" />
                  <circle cx="10" cy="10" r="1.4" fill="currentColor" />
                  <circle cx="10" cy="16" r="1.4" fill="currentColor" />
                </svg>
              </button>
            </div>

            {menuSubjectId === subject.id && (
              <div
                ref={menuRef}
                className="absolute right-2 top-10 z-30 w-44 rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
              >
                <button
                  className="w-full rounded-md px-2.5 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--surface)]"
                  onClick={() => {
                    setEditingSubject({
                      id: subject.id,
                      name: subject.name,
                      color: subject.color || 'slate',
                    });
                    setMenuSubjectId(null);
                  }}
                >
                  Edit subject
                </button>
                <button
                  className="w-full rounded-md px-2.5 py-2 text-left text-sm text-red-400 transition hover:bg-[var(--surface)]"
                  onClick={() => {
                    setMenuSubjectId(null);
                    onDeleteSubject(subject.id);
                  }}
                >
                  Delete subject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingSubject(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-base font-semibold text-[var(--text)]">Edit subject</h3>
            <div className="mt-3 space-y-3">
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                value={editingSubject.name}
                onChange={(event) => setEditingSubject((prev) => ({ ...prev, name: event.target.value }))}
                maxLength={60}
              />
              <Dropdown
                options={colorOptions}
                value={editingSubject.color}
                onChange={(value) => setEditingSubject((prev) => ({ ...prev, color: value }))}
                showColorSwatch
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                onClick={() => setEditingSubject(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-contrast)]"
                onClick={() => {
                  onUpdateSubject(editingSubject.id, {
                    name: editingSubject.name,
                    color: editingSubject.color,
                  });
                  setEditingSubject(null);
                }}
                disabled={busy}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemePanel({ preferences, busy, onUpdatePreferences }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text)]">Theme</h2>

      <div className="space-y-2">
        <p className="text-sm text-[var(--muted)]">Appearance</p>
        <div className="flex flex-wrap gap-2">
          {['dark', 'light'].map((mode) => (
            <button
              key={mode}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                preferences.mode === mode
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
              }`}
              onClick={() => onUpdatePreferences({ mode })}
              disabled={busy}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-[var(--muted)]">Accent theme</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.key}
              className={`rounded-xl border p-3 text-left ${
                preferences.theme === theme.key
                  ? 'border-[var(--accent)] bg-[var(--surface)]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
              onClick={() => onUpdatePreferences({ theme: theme.key })}
              disabled={busy}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text)]">{theme.name}</span>
                <span className="h-3 w-12 rounded-full" style={{ backgroundColor: theme.accent }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-[var(--muted)]">Text size</span>
          <Dropdown
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
            ]}
            value={preferences.textScale}
            onChange={(value) => onUpdatePreferences({ textScale: value })}
            disabled={busy}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-[var(--muted)]">Density</span>
          <Dropdown
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
            value={preferences.density}
            onChange={(value) => onUpdatePreferences({ density: value })}
            disabled={busy}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={preferences.reduceMotion}
          onChange={(event) => onUpdatePreferences({ reduceMotion: event.target.checked })}
          disabled={busy}
        />
        Reduce motion
      </label>
    </div>
  );
}

function AccountPanel({ account, busy, onUpdateProfile, onUpdateEmail }) {
  const [displayName, setDisplayName] = useState(account?.displayName || '');
  const [email, setEmail] = useState(account?.email || '');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setDisplayName(account?.displayName || '');
    setEmail(account?.email || '');
  }, [account]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text)]">Account</h2>

      <div className="space-y-1 text-sm text-[var(--muted)]">
        <p>
          Email: <span className="text-[var(--text)]">{account?.email || '-'}</span>
        </p>
        <p>
          Member since:{' '}
          <span className="text-[var(--text)]">{account?.createdAt ? new Date(account.createdAt).toLocaleDateString() : '-'}</span>
        </p>
      </div>

      <form
        className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdateProfile(displayName.trim());
        }}
      >
        <h3 className="text-sm font-medium text-[var(--text)]">Profile</h3>
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          placeholder="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
        />
        <button className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-contrast)] disabled:opacity-50" disabled={busy}>
          Save profile
        </button>
      </form>

      <form
        className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdateEmail(email, password);
          setPassword('');
        }}
      >
        <h3 className="text-sm font-medium text-[var(--text)]">Change email</h3>
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          type="password"
          placeholder="Current password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-contrast)] disabled:opacity-50" disabled={busy}>
          Save email
        </button>
      </form>
    </div>
  );
}

function DataPanel({ busy, importSummary, onExportData, onImportData, onResetData }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text)]">Data</h2>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]">
        <h3 className="text-sm font-medium text-[var(--text)]">Export data</h3>
        <p className="text-sm text-[var(--muted)]">Download sessions, subjects, and settings as JSON.</p>
        <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-contrast)]" onClick={onExportData}>
          Export JSON
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]">
        <h3 className="text-sm font-medium text-[var(--text)]">Import data</h3>
        <p className="text-sm text-[var(--muted)]">Merge import with dedupe for sessions and subjects.</p>
        <input
          className="block w-full text-sm text-[var(--muted)]"
          type="file"
          accept="application/json,.json"
          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
        />
        <button
          className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-[var(--accent-contrast)] disabled:opacity-50"
          onClick={() => selectedFile && onImportData(selectedFile)}
          disabled={!selectedFile || busy}
        >
          Import JSON
        </button>
        {importSummary && <p className="text-sm text-[var(--muted)]">{importSummary}</p>}
      </div>

      <div className="space-y-2 rounded-xl border border-red-400/40 bg-red-500/5 p-[var(--panel-padding)]">
        <h3 className="text-sm font-medium text-[var(--text)]">Reset all study data</h3>
        <p className="text-sm text-[var(--muted)]">Deletes sessions, subjects, and settings while keeping your account.</p>
        <button
          className="rounded-md bg-red-500/90 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => setShowResetConfirm(true)}
          disabled={busy}
        >
          Reset data
        </button>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowResetConfirm(false);
        }}>
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h4 className="text-base font-semibold text-[var(--text)]">Reset all study data?</h4>
            <p className="mt-1 text-sm text-[var(--muted)]">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-red-500/90 px-3 py-2 text-sm text-white"
                onClick={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
              >
                Yes, reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityPanel({ busy, onUpdatePassword, onLogoutAllSessions, onDeleteAccount, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [logoutAllPassword, setLogoutAllPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text)]">Security</h2>

      <form
        className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdatePassword(currentPassword, newPassword);
          setCurrentPassword('');
          setNewPassword('');
        }}
      >
        <h3 className="text-sm font-medium text-[var(--text)]">Change password</h3>
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          type="password"
          placeholder="New password (min 6 chars)"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={6}
          required
        />
        <button className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-contrast)] disabled:opacity-50" disabled={busy}>
          Save password
        </button>
      </form>

      <form
        className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-[var(--panel-padding)]"
        onSubmit={(event) => {
          event.preventDefault();
          onLogoutAllSessions(logoutAllPassword);
          setLogoutAllPassword('');
        }}
      >
        <h3 className="text-sm font-medium text-[var(--text)]">Log out all sessions</h3>
        <p className="text-sm text-[var(--muted)]">Invalidates all active tokens on every device.</p>
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          type="password"
          placeholder="Current password"
          value={logoutAllPassword}
          onChange={(event) => setLogoutAllPassword(event.target.value)}
          required
        />
        <button className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--text)] disabled:opacity-50" disabled={busy}>
          Log out all
        </button>
      </form>

      <div className="space-y-2 rounded-xl border border-red-400/40 bg-red-500/5 p-[var(--panel-padding)]">
        <h3 className="text-sm font-medium text-[var(--text)]">Delete account</h3>
        <p className="text-sm text-[var(--muted)]">Permanently removes this account and all associated data.</p>
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          type="password"
          placeholder="Password"
          value={deletePassword}
          onChange={(event) => setDeletePassword(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md bg-red-500/90 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            onClick={() => {
              if (deletePassword) {
                onDeleteAccount(deletePassword);
                setDeletePassword('');
              }
            }}
            disabled={busy || !deletePassword}
          >
            Delete account
          </button>
          <button
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--text)]"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal({
  open,
  onClose,
  activeSection,
  onSectionChange,
  preferences,
  account,
  subjects,
  busy,
  importSummary,
  onSaveGeneralPreferences,
  onUpdatePreferences,
  onUpdateProfile,
  onUpdateEmail,
  onUpdatePassword,
  onLogoutAllSessions,
  onDeleteAccount,
  onLogout,
  onCreateSubject,
  onUpdateSubject,
  onDeleteSubject,
  onExportData,
  onImportData,
  onResetData,
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    if (mounted) {
      setVisible(false);
      const timeoutId = window.setTimeout(() => setMounted(false), 180);
      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-6 backdrop-blur-[1px] transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`flex h-[min(88vh,760px)] w-full max-w-6xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl transition duration-200 ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.99] opacity-0'
        }`}
      >
        <div className="flex h-full w-full flex-col">
          <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h1 className="text-lg font-semibold text-[var(--text)]">Settings</h1>
            <button
              className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              onClick={onClose}
              aria-label="Close settings"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="flex min-h-0 flex-1 max-md:flex-col">
            <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg)] p-3 max-md:w-full max-md:border-r-0 max-md:border-b">
              <nav className="space-y-1 max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:space-y-0">
                {SECTIONS.map((section) => (
                  <SectionButton key={section.key} section={section} activeSection={activeSection} onClick={onSectionChange} />
                ))}
              </nav>
            </aside>

            <div className="min-w-0 flex-1 overflow-y-auto p-[var(--panel-padding)]">
              {activeSection === 'general' && (
                <GeneralPanel
                  preferences={preferences}
                  subjects={subjects}
                  busy={busy}
                  onSaveGeneralPreferences={onSaveGeneralPreferences}
                />
              )}
              {activeSection === 'subjects' && (
                <SubjectsPanel
                  subjects={subjects}
                  busy={busy}
                  onCreateSubject={onCreateSubject}
                  onUpdateSubject={onUpdateSubject}
                  onDeleteSubject={onDeleteSubject}
                />
              )}
              {activeSection === 'theme' && (
                <ThemePanel
                  preferences={preferences}
                  busy={busy}
                  onUpdatePreferences={onUpdatePreferences}
                />
              )}
              {activeSection === 'account' && (
                <AccountPanel
                  account={account}
                  busy={busy}
                  onUpdateProfile={onUpdateProfile}
                  onUpdateEmail={onUpdateEmail}
                />
              )}
              {activeSection === 'data' && (
                <DataPanel
                  busy={busy}
                  importSummary={importSummary}
                  onExportData={onExportData}
                  onImportData={onImportData}
                  onResetData={onResetData}
                />
              )}
              {activeSection === 'security' && (
                <SecurityPanel
                  busy={busy}
                  onUpdatePassword={onUpdatePassword}
                  onLogoutAllSessions={onLogoutAllSessions}
                  onDeleteAccount={onDeleteAccount}
                  onLogout={onLogout}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
