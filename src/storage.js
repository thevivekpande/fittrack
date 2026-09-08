export function calculateStreak(history, today = new Date()) {
  const dates = new Set(history.map(item => item.date));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  if (!dates.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(key(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

export function exportSessions(history) {
  const escape = value => `"${String(value).replaceAll('"','""')}"`;
  const rows = [['Date', 'Workout', 'Duration (min)', 'Estimated calories (kcal)', 'Exercises', 'Level', 'Training location'],
    ...history.map(({date,title,duration,calories,exercises,level,trainingPlace}) => [date,title,duration,calories,exercises,level,['home','gym'].includes(trainingPlace)?trainingPlace:''])];
  const url = URL.createObjectURL(new Blob([rows.map(row=>row.map(escape).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8;'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'fittrack-workout-history.csv'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
