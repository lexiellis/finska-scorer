interface OptionGridProps<T extends string | number> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  columns?: number;
}

export function OptionGrid<T extends string | number>({
  label,
  options,
  value,
  onChange,
  formatLabel = (v) => String(v),
  columns = 4,
}: OptionGridProps<T>) {
  return (
    <section className="field-section">
      <h3 className="field-label">{label}</h3>
      <div
        className="option-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            className={`option-btn ${value === opt ? 'selected' : ''}`}
            onClick={() => onChange(opt)}
          >
            {formatLabel(opt)}
          </button>
        ))}
      </div>
    </section>
  );
}
