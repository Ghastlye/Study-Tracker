import { useMemo, useState } from 'react';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SessionList({ sessions, onSave, formatDateTime }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ subject: '', durationSeconds: 0, startedAt: '', endedAt: '' });

  const recent = useMemo(() => sessions.slice(0, 12), [sessions]);

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
                <input
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                  type="number"
                  min={1}
                  value={form.durationSeconds}
                  onChange={(event) => setForm({ ...form, durationSeconds: Number(event.target.value) || 1 })}
                  placeholder="Duration seconds"
                />
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
                  className="rounded bg-[var(--accent)] px-3 py-1 text-[var(--accent-contrast)]"
                  onClick={() => {
                    onSave(session.id, {
                      ...form,
                      startedAt: new Date(form.startedAt).toISOString(),
                      endedAt: new Date(form.endedAt).toISOString(),
                    });
                    setEditingId(null);
                  }}
                >
                  Save
                </button>
                <button className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text)]" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
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
                      setEditingId(session.id);
                      setForm({
                        subject: session.subject || '',
                        durationSeconds: session.durationSeconds,
                        startedAt: new Date(session.startedAt).toISOString().slice(0, 16),
                        endedAt: new Date(session.endedAt).toISOString().slice(0, 16),
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
