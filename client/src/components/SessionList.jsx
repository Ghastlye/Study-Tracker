import { useEffect, useMemo, useState } from 'react';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SessionList({ sessions, onSave, onDelete, formatDateTime }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    subject: '',
    durationHours: 0,
    durationMinutes: 0,
    startedAt: '',
    endedAt: '',
  });
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const recent = useMemo(() => sessions.slice(0, 12), [sessions]);

  useEffect(() => {
    if (editingId !== null && !sessions.some((session) => session.id === editingId)) {
      setEditingId(null);
      setFormError('');
    }
    if (deleteTarget && !sessions.some((session) => session.id === deleteTarget.id)) {
      setDeleteTarget(null);
    }
  }, [sessions, editingId, deleteTarget]);

  const saveEdit = async (sessionId) => {
    const hours = Math.max(0, Number(form.durationHours) || 0);
    const minutes = Math.min(59, Math.max(0, Number(form.durationMinutes) || 0));
    const durationSeconds = hours * 3600 + minutes * 60;

    if (durationSeconds < 60) {
      setFormError('Duration must be at least 1 minute');
      return;
    }

    const startedAt = new Date(form.startedAt);
    const endedAt = new Date(form.endedAt);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt < startedAt) {
      setFormError('Please provide a valid start/end time');
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      await onSave(sessionId, {
        subject: form.subject,
        durationSeconds,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      });
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) {
        setEditingId(null);
        setFormError('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-[var(--panel-padding)]">
      <h2 className="text-lg font-medium text-[var(--text)]">Recent sessions</h2>
      <div className="space-y-2">
        {recent.length === 0 && <p className="text-sm text-[var(--muted)]">No sessions yet.</p>}
        {recent.map((session) => (
          <div key={session.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            {editingId === session.id ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                  value={form.subject}
                  onChange={(event) => setForm({ ...form, subject: event.target.value })}
                  placeholder="Subject"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                    type="number"
                    min={0}
                    value={form.durationHours}
                    onChange={(event) =>
                      setForm({ ...form, durationHours: Math.max(0, Number(event.target.value) || 0) })
                    }
                    placeholder="Hours"
                  />
                  <input
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                    type="number"
                    min={0}
                    max={59}
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        durationMinutes: Math.min(59, Math.max(0, Number(event.target.value) || 0)),
                      })
                    }
                    placeholder="Minutes"
                  />
                </div>
                <input
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(event) => setForm({ ...form, startedAt: event.target.value })}
                />
                <input
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                  type="datetime-local"
                  value={form.endedAt}
                  onChange={(event) => setForm({ ...form, endedAt: event.target.value })}
                />
                <button
                  className="rounded bg-[var(--accent)] px-3 py-1 text-[var(--accent-contrast)] disabled:opacity-50"
                  onClick={() => saveEdit(session.id)}
                  disabled={busy}
                >
                  Save
                </button>
                <button
                  className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text)] disabled:opacity-50"
                  onClick={() => {
                    setEditingId(null);
                    setFormError('');
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                {formError && <p className="sm:col-span-2 text-xs text-red-500">{formError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="text-[var(--text)]">{session.subject || 'General study'}</p>
                  <p className="text-[var(--muted)]">
                    {formatDateTime ? formatDateTime(session.startedAt) : new Date(session.startedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--muted)]">{formatDuration(session.durationSeconds)}</span>
                  <button
                    className="text-[var(--muted)] hover:text-[var(--text)]"
                    onClick={() => {
                      const totalSeconds = Number(session.durationSeconds) || 0;
                      const durationHours = Math.floor(totalSeconds / 3600);
                      const durationMinutes = Math.floor((totalSeconds % 3600) / 60);
                      setEditingId(session.id);
                      setFormError('');
                      setForm({
                        subject: session.subject || '',
                        durationHours,
                        durationMinutes,
                        startedAt: new Date(session.startedAt).toISOString().slice(0, 16),
                        endedAt: new Date(session.endedAt).toISOString().slice(0, 16),
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-[var(--muted)] hover:text-red-500"
                    onClick={() => setDeleteTarget({ id: session.id, subject: session.subject || 'General study' })}
                    aria-label="Delete session"
                    title="Delete session"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-base font-medium text-[var(--text)]">Delete this session?</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This will remove the session for <span className="text-[var(--text)]">{deleteTarget.subject}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border border-[var(--border)] px-3 py-1 text-sm text-[var(--text)] disabled:opacity-50"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="rounded bg-red-500 px-3 py-1 text-sm text-white disabled:opacity-50"
                onClick={confirmDelete}
                disabled={busy}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
