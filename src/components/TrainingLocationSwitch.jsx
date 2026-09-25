import { Check, Dumbbell, Home } from 'lucide-react';

export default function TrainingLocationSwitch({ value, onChange, compact = false }) {
  if (compact) return <div className="phone-session-location" role="group" aria-label="Training location">
    {[{ id: 'gym', label: 'Gym' }, { id: 'home', label: 'Home' }].map(({ id, label }) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}><span>{label}</span></button>)}
  </div>;

  return <div className="phone-training-location">
    <span>Train at</span>
    <div className="phone-location-switch" role="group" aria-label="Training location">
      {[{ id: 'gym', label: 'Gym', icon: Dumbbell }, { id: 'home', label: 'Home', icon: Home }].map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
        <Icon size={17} aria-hidden="true"/><span>{label}</span><Check className="phone-location-check" size={14} aria-hidden="true"/>
      </button>)}
    </div>
  </div>;
}
