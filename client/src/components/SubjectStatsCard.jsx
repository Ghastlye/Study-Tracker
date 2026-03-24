function formatHours(totalSeconds) {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

export default function SubjectStatsCard({ stats, colorPalette }) {
  const rows = stats.subjectTotals || [];

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-[var(--panel-padding)]">
      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Subjects</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No subject data in this range.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <div key={`${item.subject}-${item.subjectId ?? 'none'}`} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text)]">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colorPalette[item.color] || colorPalette.slate }}
                  />
                  <span>{item.subject}</span>
                </div>
                <span className="text-[var(--muted)]">
                  {formatHours(item.totalSeconds)} · {item.percent}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded bg-[var(--surface)]">
                <div
                  className="h-1.5 rounded"
                  style={{
                    width: `${Math.max(item.percent, 2)}%`,
                    backgroundColor: colorPalette[item.color] || colorPalette.slate,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
