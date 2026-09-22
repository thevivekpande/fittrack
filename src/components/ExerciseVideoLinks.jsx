import { ArrowUpRight, Languages } from 'lucide-react';
import './ExerciseVideoLinks.css';

function isVideoSearch(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.youtube.com' && url.pathname === '/results' && Boolean(url.searchParams.get('search_query'));
  } catch { return false; }
}

export default function ExerciseVideoLinks({ exercise, links }) {
  const selected = links || exercise?.videoLinks;
  const options = [['hindi', 'Hindi'], ['english', 'English']].filter(([language]) => isVideoSearch(selected?.[language]));
  if (!options.length) return null;
  return <div className="exercise-video-links">
    <span><Languages size={15}/>Technique videos</span>
    <div>{options.map(([language, label]) => <a key={language} href={selected[language]} target="_blank" rel="noreferrer" aria-label={`${exercise.name} technique search in ${label} (opens in a new tab)`}>{label}<ArrowUpRight size={13}/></a>)}</div>
    <small>YouTube searches from your sheet; results may vary.</small>
  </div>;
}
