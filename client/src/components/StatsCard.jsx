import { useMemo, useState } from 'react';

function formatHours(totalSeconds) {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

function formatAxisTime(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  if (safe === 0) return '0m';
  if (safe % 3600 === 0) return `${safe / 3600}h`;
  if (safe > 3600) return `${(safe / 3600).toFixed(1)}h`;
  return `${Math.round(safe / 60)}m`;
}

function formatBestDay(bestDay) {
  if (!bestDay?.date) return 'None';
  const date = new Date(`${bestDay.date}T00:00:00`);
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${formatHours(bestDay.totalSeconds)})`;
}

export default function StatsCard({
  stats,
  statsRange,
  onRangeChange,
  onPreviousPeriod,
  onNextPeriod,
  onResetToToday,
  colorPalette,
}) {
  const [showBySubject, setShowBySubject] = useState(false);
  const ranges = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];
  const bars = stats.bars || [];
  const barSubjectTotals = stats.barSubjectTotals || [];
  const barSubjectMap = useMemo(() => new Map(barSubjectTotals.map((item) => [item.date, item])), [barSubjectTotals]);
  const maxBarTotalRaw = Math.max(...bars.map((bar) => Number(bar.totalSeconds) || 0), 0);
  const yAxisStep = 30 * 60;
  const yAxisMax = Math.max(yAxisStep, Math.ceil(maxBarTotalRaw / yAxisStep) * yAxisStep);

  const yTicks = useMemo(() => {
    const ticks = [];
    for (let value = 0; value <= yAxisMax; value += yAxisStep) {
      ticks.push(value);
    }
    return ticks;
  }, [yAxisMax]);

  const chartOuterHeightClass = 'h-40';

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-[var(--panel-padding)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text)]">{stats.periodLabel || 'Current period'}</p>
        <div className="flex items-center gap-1">
          <button
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)]"
            onClick={onPreviousPeriod}
            title="Previous period"
            aria-label="Previous period"
          >
            ←
          </button>
          <button
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] disabled:opacity-40"
            onClick={onResetToToday}
            disabled={stats.isCurrentPeriod}
          >
            Today
          </button>
          <button
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] disabled:opacity-40"
            onClick={onNextPeriod}
            disabled={stats.isCurrentPeriod}
            title="Next period"
            aria-label="Next period"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Today</p>
          <p className="text-2xl font-semibold text-[var(--text)]">{formatHours(stats.todayTotalSeconds)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Range Total</p>
          <p className="text-2xl font-semibold text-[var(--text)]">{formatHours(stats.rangeTotalSeconds)}</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
        <p>Avg/day: {formatHours(stats.dailyAverageSeconds)}</p>
        <p>Best day: {formatBestDay(stats.bestDay)}</p>
        <p>Streak: {stats.currentStreakDays} day{stats.currentStreakDays === 1 ? '' : 's'}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          {ranges.map((range) => (
            <button
              key={range.key}
              className={`rounded-md px-3 py-1 text-sm transition ${
                statsRange === range.key
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              onClick={() => onRangeChange(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="flex w-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          <button
            className={`rounded-md px-3 py-1 text-sm transition ${
              !showBySubject
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
            onClick={() => setShowBySubject(false)}
          >
            Total
          </button>
          <button
            className={`rounded-md px-3 py-1 text-sm transition ${
              showBySubject
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
            onClick={() => setShowBySubject(true)}
          >
            By subject
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="flex gap-2">
            <div className={`relative ${chartOuterHeightClass} w-11 shrink-0`}>
              <div className="absolute inset-x-0 bottom-0 top-4">
                {yTicks.map((tick) => {
                  const bottom = yAxisMax === 0 ? 0 : (tick / yAxisMax) * 100;
                  const isTopTick = tick === yAxisMax;
                  return (
                    <div
                      key={`tick-label-${tick}`}
                      className="absolute right-0 text-[10px] leading-none text-[var(--muted)]"
                      style={{ bottom: `${bottom}%`, transform: isTopTick ? 'translateY(0)' : 'translateY(50%)' }}
                    >
                      {formatAxisTime(tick)}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`relative ${chartOuterHeightClass} flex-1`}>
              <div className="absolute inset-x-0 bottom-0 top-4">
                {yTicks.map((tick) => {
                  const bottom = yAxisMax === 0 ? 0 : (tick / yAxisMax) * 100;
                  return (
                    <div
                      key={`grid-${tick}`}
                      className="pointer-events-none absolute left-0 right-0 border-t border-[var(--border)]/60"
                      style={{ bottom: `${bottom}%` }}
                    />
                  );
                })}

                <div className="relative flex h-full items-end gap-1.5 sm:gap-2">
                  {bars.map((bar) => {
                    const value = Number(bar.totalSeconds) || 0;
                    const stacked = barSubjectMap.get(bar.date)?.segments || [];
                    const barHeight = value <= 0 ? 0 : (value / yAxisMax) * 100;

                    return (
                      <div key={`${bar.date}-${bar.label}`} className="flex h-full flex-1 items-end">
                        {showBySubject && stacked.length > 0 && value > 0 ? (
                          <div className="flex w-full flex-col-reverse overflow-hidden rounded" style={{ height: `${barHeight}%` }}>
                            {stacked.map((segment, index) => {
                              const segmentRatio = segment.totalSeconds / value;
                              const segmentHeight = segmentRatio * 100;
                              if (segmentHeight <= 0) return null;
                              return (
                                <div
                                  key={`${bar.date}-${segment.subject}-${index}`}
                                  className="w-full"
                                  style={{
                                    height: `${segmentHeight}%`,
                                    backgroundColor: colorPalette?.[segment.color] || 'var(--accent)',
                                  }}
                                  title={`${bar.label}: ${segment.subject} ${formatHours(segment.totalSeconds)}`}
                                />
                              );
                            })}
                          </div>
                        ) : value > 0 ? (
                          <div
                            className="w-full rounded bg-[var(--accent)]"
                            style={{ height: `${barHeight}%` }}
                            title={`${bar.label}: ${formatHours(value)}`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-1 flex">
            <div className="w-11 shrink-0" />
            <div className="flex flex-1 gap-1.5 sm:gap-2">
              {bars.map((bar) => (
                <div key={`label-${bar.date}-${bar.label}`} className="flex-1 text-center">
                  <span className="text-[10px] text-[var(--muted)]">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
