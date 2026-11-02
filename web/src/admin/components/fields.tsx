import { useId, type ReactNode } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  onBlur?: () => void;
  type?: string;
}

/** Campo con etiqueta propia; la ayuda va aparte y se enlaza con aria-describedby (no ensucia el nombre del campo). */
export function TextField({ label, value, onChange, multiline, placeholder, hint, onBlur, type = 'text' }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const common = {
    id,
    value,
    placeholder,
    onBlur,
    'aria-describedby': hint ? hintId : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
