import Dropdown from './Dropdown';

function formatTime(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default function TimerCard({
  running,
  elapsedSeconds,
  onStart,
  onStop,
  subjects,
  subject,
  setSubject,
  pomodoroEnabled,
  setPomodoroEnabled,
  workMinutes,
  breakMinutes,
  setWorkMinutes,
  setBreakMinutes,
  cycleLabel,
  startPulseKey,
  colorPalette,
}) {
  const subjectOptions = [
    { value: '', label: 'No subject' },
    ...subjects.map((savedSubject) => ({
      value: savedSubject.name,
      label: savedSubject.name,
      color: colorPalette[savedSubject.color] || colorPalette.slate,
    })),
  ];

  return (
    <section className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-[var(--panel-padding-lg)] text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">{cycleLabel}</p>
      <div key={startPulseKey} className="animate-start-pop text-5xl font-semibold tabular-nums text-[var(--text)] sm:text-6xl">
        {formatTime(elapsedSeconds)}
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
        <Dropdown
          className="w-full sm:max-w-[260px]"
          options={subjectOptions}
          value={subject}
          onChange={(value) => setSubject(value)}
          placeholder="Select subject"
          showColorSwatch
        />

        {!running ? (
          <button
            className="rounded-lg bg-[var(--accent)] px-6 py-2 font-medium text-[var(--accent-contrast)] transition hover:opacity-95"
            onClick={onStart}
          >
            Start
          </button>
        ) : (
          <button
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-2 font-medium text-[var(--text)] transition hover:border-[var(--accent)]"
            onClick={onStop}
          >
            Stop
          </button>
        )}
      </div>

      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pomodoroEnabled}
            onChange={(event) => setPomodoroEnabled(event.target.checked)}
          />
          Pomodoro
        </label>
        <input
          className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
          type="number"
          min={1}
          value={workMinutes}
          onChange={(event) => setWorkMinutes(Number(event.target.value) || 25)}
          disabled={!pomodoroEnabled}
          aria-label="Work minutes"
        />
        <span>work</span>
        <input
          className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
          type="number"
          min={1}
          value={breakMinutes}
          onChange={(event) => setBreakMinutes(Number(event.target.value) || 5)}
          disabled={!pomodoroEnabled}
          aria-label="Break minutes"
        />
        <span>break</span>
      </div>
    </section>
  );
}
