interface ScorePickerProps {
  value: number | null;
  onChange: (score: number) => void;
}

export function ScorePicker({ value, onChange }: ScorePickerProps) {
  return (
    <section className="field-section">
      <h3 className="field-label">Score</h3>
      <div className="score-grid">
        {Array.from({ length: 13 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`score-circle ${value === i ? 'selected' : ''}`}
            onClick={() => onChange(i)}
            aria-label={`Score ${i}`}
          >
            {i}
          </button>
        ))}
      </div>
    </section>
  );
}
