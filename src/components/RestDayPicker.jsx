import { useId } from 'react';
import { Check, Leaf } from 'lucide-react';
import './RestDayPicker.css';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RestDayPicker({ value = [], weeklyGoal, onChange, disabled = false, error, note }) {
  const id = useId();
  const count = 7 - Number(weeklyGoal);
  if (!Number.isInteger(count) || count < 0 || count > 6) return null;
  const remaining = count - value.length;
  const status = remaining === 0
    ? count === 0 ? 'No fixed rest days selected.' : 'Your rest days are ready.'
    : remaining > 0 ? `Choose ${remaining} more rest day${remaining === 1 ? '' : 's'}.`
      : `Remove ${Math.abs(remaining)} rest day${remaining === -1 ? '' : 's'} to match your target.`;

  function toggle(index) {
    onChange(value.includes(index) ? value.filter(day => day !== index) : [...value, index].sort((a, b) => a - b));
  }

  return <fieldset className={`rest-day-picker${error ? ' has-error' : ''}`} disabled={disabled} aria-describedby={`${id}-hint ${id}-status${error ? ` ${id}-error` : ''}`}>
    <legend><Leaf size={15} aria-hidden="true"/>Your rest days</legend>
    <div className="rest-day-picker-heading"><p id={`${id}-hint`}>{count ? `Choose ${count} day${count === 1 ? '' : 's'} off. Your ${weeklyGoal} workout${Number(weeklyGoal) === 1 ? '' : 's'} will fit around them.` : 'Seven workouts means no fixed day off. You can change your target to make room for rest.'}</p><span className={remaining === 0 ? 'is-complete' : ''}>{value.length} / {count}<span className="rest-day-sr-only"> rest days selected</span></span></div>
    {count > 0 && <div className="rest-day-options">{WEEKDAYS.map((day, index) => <label className="rest-day-option" key={day}>
      <input type="checkbox" name="restDays" value={index} checked={value.includes(index)} onChange={() => toggle(index)} aria-label={`${day} rest day`} aria-invalid={Boolean(error)} aria-describedby={`${id}-status${error ? ` ${id}-error` : ''}`}/>
      <span><strong>{day.slice(0, 3)}</strong><span className="rest-day-mark" aria-hidden="true">{value.includes(index) ? <Check size={12}/> : <span/>}</span></span>
    </label>)}</div>}
    <p className="rest-day-status" id={`${id}-status`} role="status">{status}</p>
    {note && <p className="rest-day-context">{note}</p>}
    {error && <p className="rest-day-error" id={`${id}-error`}>{error}</p>}
  </fieldset>;
}
