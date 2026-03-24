import { useEffect, useMemo, useRef, useState } from 'react';

function getNextEnabledIndex(options, startIndex, direction) {
  if (!options.length) return -1;

  let index = startIndex;
  for (let i = 0; i < options.length; i += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }

  return -1;
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select',
  disabled = false,
  showColorSwatch = false,
  renderPrefix = null,
  className = '',
  buttonClassName = '',
  listClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const selectedOption = safeOptions.find((option) => option.value === value) || null;
  const prefixFor = (option) => {
    if (!option) return null;
    if (typeof renderPrefix === 'function') {
      return renderPrefix(option);
    }
    if (showColorSwatch && option.color) {
      return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />;
    }
    return null;
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const selectedIndex = safeOptions.findIndex((option) => option.value === value && !option.disabled);
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }

    const firstEnabled = safeOptions.findIndex((option) => !option.disabled);
    setActiveIndex(firstEnabled);
  }, [open, safeOptions, value]);

  const selectOption = (option) => {
    if (!option || option.disabled) return;
    onChange(option.value, option);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => getNextEnabledIndex(safeOptions, current < 0 ? 0 : current, direction));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((prev) => !prev);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const onListKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => getNextEnabledIndex(safeOptions, current < 0 ? 0 : current, direction));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) {
        selectOption(safeOptions[activeIndex]);
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left text-sm text-[var(--text)] transition focus:border-[var(--accent)] focus:outline-none disabled:opacity-50 ${buttonClassName}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={onButtonKeyDown}
        disabled={disabled}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          {prefixFor(selectedOption)}
          <span className="truncate text-[var(--text)]">{selectedOption?.label || placeholder}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0 text-[var(--muted)]">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className={`absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg ${listClassName}`}
        >
          {safeOptions.map((option, index) => {
            const selected = value === option.value;
            const active = index === activeIndex;

            return (
              <button
                key={`${String(option.value)}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ${
                  option.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : active || selected
                      ? 'bg-[var(--surface)] text-[var(--text)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => selectOption(option)}
                disabled={option.disabled}
              >
                {prefixFor(option)}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
