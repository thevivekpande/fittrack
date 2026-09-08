import { useId, useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpRight, CalendarDays, Check, Clock3, Dumbbell, Plus, Scale, X } from 'lucide-react';
import { dateKey, getWeekDates } from '../data.js';
import './Progress.css';

const formatDate = (value, options = { month: 'short', day: 'numeric' }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-US', options);
const number = (value) => Number(value) || 0;

export function ActivityChart({ history = [], compact = false }) {
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState(null);
  const headingId = useId();
  const days = getWeekDates(week);
  const values = days.map((date) => history.reduce((sum, session) => sum + (session.date === dateKey(date) ? number(session.duration) : 0), 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const maximum = Math.max(...values, 0);
  const ceiling = Math.max(60, Math.ceil(maximum / 30) * 30);
  const highlighted = selected ?? (maximum > 0 ? values.indexOf(maximum) : -1);
  const previousDates = getWeekDates(week - 1).map(dateKey);
  const previousTotal = history.reduce((sum, session) => sum + (previousDates.includes(session.date) ? number(session.duration) : 0), 0);
  const change = previousTotal ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;

  return (
    <section className={`activity-card${compact ? ' activity-card--compact' : ''}`} aria-labelledby={headingId}>
      <div className="activity-heading">
        <h2 id={headingId}>Activity overview</h2>
        <select aria-label="Activity chart week" value={week} onChange={(event) => { setWeek(Number(event.target.value)); setSelected(null); }}>
          <option value={0}>This week</option>
          <option value={-1}>Last week</option>
        </select>
      </div>
      <div className="activity-total-row">
        <div className="activity-total"><strong>{total.toLocaleString()}</strong><span>min <span className="activity-total-label">of movement</span></span></div>
        {change !== null && <span className={`activity-change${change < 0 ? ' activity-change--lower' : ''}`}><ArrowUpRight size={14} aria-hidden="true" />{Math.abs(change)}% {change < 0 ? 'less' : 'more'}</span>}
      </div>
      <div className="activity-plot">
        <div className="activity-axis" aria-hidden="true"><span>{ceiling}</span><span>{ceiling / 2}</span><span>0</span></div>
        <div className="activity-grid" aria-hidden="true"><i /><i /><i /></div>
        {total===0&&<div className="activity-empty"><Activity size={22}/><strong>Your progress starts here.</strong><span>Completed workouts will appear in this chart.</span></div>}
        <div className="activity-bars">
          {days.map((date, index) => (
            <button
              type="button"
              className={`activity-day${highlighted === index ? ' activity-day--active' : ''}${dateKey(date) === dateKey() ? ' activity-day--today' : ''}`}
              key={dateKey(date)}
              aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}: ${values[index]} workout minutes`}
              aria-pressed={highlighted === index}
              onClick={() => setSelected(index)}
            >
              <span className="activity-bar-area">
                <span className="activity-bar" style={{ height: `${(values[index] / ceiling) * 100}%` }}>
                  <span className="activity-bar-value">{values[index]} min</span>
                </span>
              </span>
              <span className="activity-day-label">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="activity-chart-footer"><span><i />Workout duration</span><span>{total ? 'A little movement. A lot of progress.' : 'Your next workout starts your story.'}</span></div>
    </section>
  );
}

function WeightTrend({ weights }) {
  const sorted = [...weights].filter((entry) => number(entry.value) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const entries = sorted.slice(-12);
  const gradientId = useId().replace(/:/g, '');
  if (!entries.length) {
    return <div className="progress-weight-empty"><span><Scale size={26} strokeWidth={1.5} /></span><h3>Your journey, in perspective.</h3><p>Log your first weight to see your personal trend over time.</p></div>;
  }
  const min = Math.min(...entries.map((entry) => number(entry.value))) - 1;
  const max = Math.max(...entries.map((entry) => number(entry.value))) + 1;
  const firstTime = new Date(`${entries[0].date}T12:00:00`).getTime();
  const lastTime = new Date(`${entries.at(-1).date}T12:00:00`).getTime();
  const points = entries.map((entry) => ({
    ...entry,
    x: firstTime === lastTime ? 250 : 42 + ((new Date(`${entry.date}T12:00:00`).getTime() - firstTime) / (lastTime - firstTime)) * 416,
    y: 170 - ((number(entry.value) - min) / (max - min)) * 130,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const latest = number(entries.at(-1).value);
  const delta = latest - number(sorted[0].value);
  return <>
    <div className="progress-weight-number"><strong>{latest.toFixed(1)}</strong><span>kg</span>{sorted.length > 1 && <small>{delta > 0 ? '+' : ''}{delta.toFixed(1)} kg since first entry</small>}</div>
    <svg className="progress-weight-svg" viewBox="0 0 500 210" role="img" aria-label={`Weight trend: ${entries.map((entry) => `${formatDate(entry.date)}, ${entry.value} kilograms`).join('; ')}`}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a4b7a5" stopOpacity=".28" /><stop offset="100%" stopColor="#a4b7a5" stopOpacity="0" /></linearGradient></defs>
      {[40, 105, 170].map((y, index) => <g key={y}><line x1="42" x2="466" y1={y} y2={y} stroke="#e9ede8" strokeDasharray="4 5" /><text x="2" y={y + 4} fill="#92978e" fontSize="11">{(max - index * ((max - min) / 2)).toFixed(1)}</text></g>)}
      {points.length > 1 && <><polygon points={`${points[0].x},170 ${line} ${points.at(-1).x},170`} fill={`url(#${gradientId})`} /><polyline points={line} fill="none" stroke="#234f40" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></>}
      {points.map((point, index) => <circle key={point.id || `${point.date}-${index}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3.5} fill="#234f40" stroke="#fff" strokeWidth="2"><title>{formatDate(point.date)}: {point.value} kg</title></circle>)}
      <text x="42" y="198" fill="#92978e" fontSize="11">{formatDate(entries[0].date)}</text>
      {entries.length > 1 && <text x="466" y="198" textAnchor="end" fill="#92978e" fontSize="11">{formatDate(entries.at(-1).date)}</text>}
    </svg>
    <p className="progress-weight-caption">{entries.length === 1 ? 'Your starting point is saved. Add another entry to see a trend.' : 'Your latest 12 entries. Focus on the trend, at your own pace.'}</p>
  </>;
}

export default function Progress({ history = [], weights = [], onAddWeight, onExport }) {
  const [range, setRange] = useState('30');
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightDate, setWeightDate] = useState(dateKey());
  const [weightValue, setWeightValue] = useState('');
  const [notice, setNotice] = useState('');
  const formId = useId();
  const filtered = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - (Number(range) - 1));
    const startKey = dateKey(start);
    return history.filter((session) => range === 'all' || (session.date >= startKey && session.date <= dateKey())).sort((a, b) => b.date.localeCompare(a.date));
  }, [history, range]);
  const totalMinutes = history.reduce((sum, session) => sum + number(session.duration), 0);
  const activeDays = new Set(history.map((session) => session.date)).size;

  function submitWeight(event) {
    event.preventDefault();
    const value = Number(weightValue);
    if (!weightDate || weightDate > dateKey() || !Number.isFinite(value) || value < 20 || value > 400) return;
    onAddWeight({ id: crypto.randomUUID(), date: weightDate, value });
    setWeightValue('');
    setShowWeightForm(false);
    setNotice(`Weight logged: ${value.toFixed(1)} kg for ${formatDate(weightDate)}.`);
  }

  return (
    <div className="progress-page">
      <header className="progress-header"><div><span className="progress-eyebrow">YOUR PROGRESS</span><h1>Every effort adds up<span>.</span></h1><p>Look how far you’ve come. Keep showing up for yourself.</p></div><button type="button" className="progress-outline-button" onClick={onExport}><ArrowDownToLine size={17} />Export CSV</button></header>
      <div className="progress-stats">
        <div className="progress-stat"><span className="progress-stat-icon"><Dumbbell size={20} /></span><div><span>Workouts completed</span><strong>{history.length}<small>sessions</small></strong></div></div>
        <div className="progress-stat"><span className="progress-stat-icon progress-stat-icon--orange"><Clock3 size={20} /></span><div><span>Time invested</span><strong>{totalMinutes.toLocaleString()}<small>minutes</small></strong></div></div>
        <div className="progress-stat"><span className="progress-stat-icon progress-stat-icon--sage"><CalendarDays size={20} /></span><div><span>Days you showed up</span><strong>{activeDays}<small>active days</small></strong></div></div>
      </div>
      <div className="progress-chart-grid">
        <ActivityChart history={history} />
        <section className="progress-weight-card" aria-labelledby={`${formId}-heading`}>
          <div className="progress-card-heading"><div><h2 id={`${formId}-heading`}>Weight journey</h2><p>One part of your bigger picture.</p></div><button className="progress-small-button" type="button" onClick={() => setShowWeightForm((open) => !open)} aria-expanded={showWeightForm} aria-controls={`${formId}-form`}>{showWeightForm ? <X size={15} /> : <Plus size={15} />}{showWeightForm ? 'Close' : 'Log weight'}</button></div>
          {showWeightForm && <form className="progress-weight-form" id={`${formId}-form`} onSubmit={submitWeight}>
            <label htmlFor={`${formId}-date`}>Date<input id={`${formId}-date`} type="date" value={weightDate} max={dateKey()} required onChange={(event) => setWeightDate(event.target.value)} /></label>
            <label htmlFor={`${formId}-weight`}>Weight (kg)<input id={`${formId}-weight`} type="number" min="20" max="400" step="0.1" placeholder="e.g. 72.5" value={weightValue} required onChange={(event) => setWeightValue(event.target.value)} autoFocus /></label>
            <button className="progress-save-button" type="submit"><Check size={16} />Save</button>
            <p>Enter a weight between 20 and 400 kg.</p>
          </form>}
          <WeightTrend weights={weights} />
          <p className="progress-sr-only" role="status">{notice}</p>
        </section>
      </div>
      <section className="progress-history-card" aria-labelledby={`${formId}-history`}>
        <div className="progress-card-heading"><div><h2 id={`${formId}-history`}>Workout history</h2><p>Small wins, all in one place.</p></div><select className="progress-range-select" aria-label="Workout history date range" value={range} onChange={(event) => setRange(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select></div>
        {filtered.length ? <div className="progress-table-scroll"><table className="progress-table"><thead><tr><th scope="col">Workout</th><th scope="col">Date</th><th scope="col">Duration</th><th scope="col">Est. calories</th><th scope="col">Status</th></tr></thead><tbody>{filtered.map((session) => <tr key={session.id}><td><span className="progress-workout-icon"><Dumbbell size={17} /></span><span><strong>{session.title}</strong><small>{session.exercises} exercises · {session.level === 'medium' ? 'Medium' : session.level === 'beginner' ? 'Beginner' : 'Experienced'}{session.trainingPlace&&` · ${session.trainingPlace==='home'?'At home':'At the gym'}`}</small></span></td><td>{formatDate(session.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td>{number(session.duration)} min</td><td>{number(session.calories).toLocaleString()} kcal</td><td><span className="progress-completed"><Check size={12} />Completed</span></td></tr>)}</tbody></table></div> : <div className="progress-history-empty"><Activity size={28} strokeWidth={1.5} /><h3>A fresh start is a strong start.</h3><p>Complete a workout to add it here, or choose a different date range.</p></div>}
        <div className="progress-table-footer"><span>{filtered.length} {filtered.length === 1 ? 'workout' : 'workouts'} in this period</span><span>Calorie values are estimates.</span></div>
      </section>
    </div>
  );
}
