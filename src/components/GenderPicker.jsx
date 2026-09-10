import { useId } from 'react';
import { Check, UserRound } from 'lucide-react';
import { GENDERS } from '../profile';
import './GenderPicker.css';

export default function GenderPicker({ value = '', onChange, error, disabled = false }) {
  const id = useId();
  return <fieldset className="gender-picker" disabled={disabled}>
    <legend>Your gender</legend>
    <p id={`${id}-hint`}>Personalizes your demo figure and exercise variations. Your goals and experience set the difficulty.</p>
    <div className="gender-options">{GENDERS.map(gender => <label key={gender.id} className={value === gender.id ? 'is-selected' : ''}>
      <input type="radio" name="gender" value={gender.id} checked={value === gender.id} required onChange={() => onChange(gender.id)} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}/>
      <UserRound size={17} aria-hidden="true"/><span>{gender.label}</span><Check size={13} className="gender-check" aria-hidden="true"/>
    </label>)}</div>
    <small>Every exercise is available to everyone. Non-binary and private selections use a neutral demo figure.</small>
    {error && <p className="gender-error" id={`${id}-error`} role="status">{error}</p>}
  </fieldset>;
}
