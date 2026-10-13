import type { V3 } from '../model';

export function VectorInput({ label, values, disabled, onChange }: { label: string; values: V3; disabled?: boolean; onChange: (v: V3) => void }) {
  return (
    <div className="vector-input">
      <label>{label[0].toUpperCase() + label.slice(1)}</label>
      <div>
        {values.map((n, i) => (
          <label key={i} className={'axis-field axis-' + ['x', 'y', 'z'][i]}>
            <span>{['X', 'Y', 'Z'][i]}</span>
            <input
              type="number"
              step={label === 'scale' ? 0.125 : 1}
              aria-label={`${label} ${['X', 'Y', 'Z'][i]}`}
              value={Math.round(n * 1000) / 1000}
              disabled={disabled}
              onChange={e => {
                const value = Number(e.target.value);
                if (!Number.isFinite(value) || (label === 'scale' && value <= 0)) return;
                const next = [...values] as V3;
                next[i] = value;
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
