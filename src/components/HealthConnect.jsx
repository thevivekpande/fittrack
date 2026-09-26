import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Footprints, Flame, HeartPulse, Moon, RefreshCw, Scale, Settings, ShieldCheck, Smartphone, Unplug } from 'lucide-react';
import TouchSelect from './TouchSelect';
import { dateKey } from '../data';
import { createEmptyHealth, mergeHealthSnapshot, parseHealthImport, serializeHealth } from '../healthData';
import { isAndroidCompanion, requestAndroidHealth } from '../androidHealth';
import './HealthConnect.css';

const LABELS = { steps: 'Steps', activeCalories: 'Active energy', sleep: 'Sleep', weight: 'Weight' };
const EMPTY_STATUS = { available: false, status: 'checking', granted: [] };
function availability(value) {
  return { available: value?.available === true, status: ['available', 'install-required', 'unavailable'].includes(value?.status) ? value.status : 'unavailable', granted: Object.keys(LABELS).filter(key => Array.isArray(value?.granted) && value.granted.includes(key)) };
}

export function useHealthConnection(health, onChange) {
  const native = isAndroidCompanion();
  const [status, setStatus] = useState(native ? EMPTY_STATUS : { ...EMPTY_STATUS, status: 'browser' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busyRef = useRef(false);
  const lastAttempt = useRef(0);
  const accessGeneration = useRef(0);
  const returningFromSettings = useRef(false);
  const sync = useCallback(async (connect = false, automatic = false) => {
    if (!native || busyRef.current) return;
    accessGeneration.current += 1;
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    lastAttempt.current = Date.now();
    try {
      const access = availability(await requestAndroidHealth(connect ? 'connect' : 'availability'));
      setStatus(access);
      if (!access.available) {
        if (!automatic) setError(access.status === 'install-required' ? 'Install or update Health Connect, then try again.' : 'Health Connect is not available on this device.');
        return;
      }
      if (!access.granted.length) {
        onChange(previous => ({ ...previous, autoSync: false, permissions: [] }));
        if (!automatic) setMessage('No health permissions were granted. You can choose them when you connect.');
        return;
      }
      const result = await requestAndroidHealth('sync');
      onChange(previous => ({ ...mergeHealthSnapshot(previous, result), autoSync: true }));
      setMessage('Health data refreshed. Only available records are shown.');
    } catch (failure) {
      setStatus(previous => previous.status === 'checking' ? { ...EMPTY_STATUS, status: 'error' } : previous);
      setError(failure.message || 'Health sync could not finish. Please try again.');
    }
    finally { busyRef.current = false; setBusy(false); }
  }, [native, onChange]);

  useEffect(() => {
    if (!native) return;
    let active = true;
    const generation = accessGeneration.current;
    requestAndroidHealth('availability').then(value => { if (active && generation === accessGeneration.current) setStatus(availability(value)); }).catch(failure => {
      if (active && generation === accessGeneration.current) { setStatus({ ...EMPTY_STATUS, status: 'error' }); setError(failure.message); }
    });
    return () => { active = false; };
  }, [native]);
  useEffect(() => {
    if (!native) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || busyRef.current) return;
      const generation = ++accessGeneration.current;
      try {
        // Permission indicators must refresh even if readings were synced very
        // recently, or automatic reading has not yet been enabled.
        const access = availability(await requestAndroidHealth('availability'));
        if (!active || generation !== accessGeneration.current) return;
        setStatus(access);
        if (!access.available) return;
        const force = returningFromSettings.current;
        returningFromSettings.current = false;
        if (!access.granted.length) {
          onChange(previous => ({ ...previous, autoSync: false, permissions: [] }));
        } else if (health.autoSync && (force || Date.now() - lastAttempt.current > 60000)) {
          sync(false, true);
        }
      } catch (failure) {
        if (active && generation === accessGeneration.current) setError(failure.message);
      }
    };
    if (health.autoSync && document.visibilityState === 'visible' && Date.now() - lastAttempt.current > 60000) sync(false, true);
    window.addEventListener('fittrack:foreground', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.removeEventListener('fittrack:foreground', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [native, health.autoSync, sync, onChange]);

  async function openSettings() {
    setError('');
    returningFromSettings.current = true;
    try { await requestAndroidHealth('openSettings'); }
    catch (failure) { returningFromSettings.current = false; setError(failure.message); }
  }
  async function disconnect() {
    if (busyRef.current) return;
    accessGeneration.current += 1;
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (native) { await requestAndroidHealth('disconnect'); setStatus(availability(await requestAndroidHealth('availability'))); }
      onChange(createEmptyHealth());
      setMessage('Health data cleared from FitTrack. Your source health app keeps its records.');
    } catch (failure) { setError(failure.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function exportData() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    setError(''); setMessage('');
    try {
      const json = serializeHealth(health);
      if (native) await requestAndroidHealth('exportHealth', { json });
      else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `fittrack-health-${dateKey()}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (failure) { setError(failure.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function importData(file) {
    if (!file || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    setError(''); setMessage('');
    try {
      if (file.size > 1048576) throw new Error('Choose a FitTrack health file smaller than 1 MB.');
      const snapshot = parseHealthImport(await file.text());
      onChange(previous => mergeHealthSnapshot(previous, snapshot, 'import'));
      setMessage('Health snapshot imported. Matching dates were replaced, so totals are not counted twice.');
    } catch (failure) { setError(failure.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return { native, status, busy, error, message, sync: () => sync(false), connect: () => sync(true), openSettings, disconnect, exportData, importData };
}

export default function HealthConnect({ health, connection }) {
  const { native, status, busy, error, message, sync, connect, openSettings, disconnect, exportData, importData } = connection;
  const [selectedDate, setSelectedDate] = useState(dateKey);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef(null);
  const dates = [...new Set([...Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setDate(day.getDate() - index); return dateKey(day); }), ...health.days.map(day => day.date)])].sort().reverse();
  const day = health.days.find(item => item.date === selectedDate);
  const hasRecords = health.days.some(item => ['steps', 'activeCalories', 'sleepMinutes', 'weightKg'].some(key => item[key] !== null));
  const connected = native && status.available && status.granted.length > 0;
  const cards = [
    { key: 'steps', label: 'Steps', icon: Footprints, unit: 'steps', value: day?.steps },
    { key: 'activeCalories', label: 'Active energy', icon: Flame, unit: 'kcal', value: day?.activeCalories },
    { key: 'sleepMinutes', label: 'Sleep', icon: Moon, unit: 'hours', value: day?.sleepMinutes == null ? null : Math.round(day.sleepMinutes / 6) / 10 },
    { key: 'weightKg', label: 'Weight', icon: Scale, unit: 'kg', value: day?.weightKg },
  ];
  return <div className="health-page">
    <header className="health-heading"><div><p>YOUR DAILY PICTURE</p><h1>Health & activity</h1><span>Bring your movement, sleep, and weight together.</span></div><span className="health-heading-icon"><HeartPulse size={27}/></span></header>
    <section className="health-connection-card" aria-label="Health connection">
      <div className="health-connection-title"><span className="health-service-icon"><Smartphone size={25}/></span><div><h2>Android Health Connect</h2><p>Samsung Health & other connected apps</p></div></div>
      <span className={`health-state ${connected ? 'is-connected' : ''}`}><span/>{connected ? 'Permissions granted' : native ? status.status === 'checking' ? 'Checking availability' : status.status === 'install-required' ? 'Setup needed' : 'Not connected' : 'Android companion required'}</span>
      <p>{native ? 'Choose which health data FitTrack can read. Once connected, it refreshes when you open or return to the app.' : 'Open the FitTrack Android companion to connect your phone’s health data. A browser cannot read Health Connect directly.'}</p>
      {native ? <div className="health-actions"><button type="button" className="button button-green" onClick={connected ? sync : connect} disabled={busy || status.status === 'checking' || status.status === 'unavailable'}><RefreshCw size={17} className={busy?'health-spinning':''}/>{busy ? 'Working…' : connected ? 'Sync now' : 'Connect health data'}</button><button type="button" className="button button-secondary" onClick={openSettings} disabled={busy}><Settings size={16}/>{status.status==='install-required'?'Set up Health Connect':'Manage access'}</button></div> : <p className="health-companion-note">Already using the companion? Export a health snapshot there, then import it below to view it in this browser.</p>}
      {connected&&<div className="health-permissions">{status.granted.map(key=><span key={key}><Check size={12}/>{LABELS[key]}</span>)}{status.granted.length < Object.keys(LABELS).length && <button type="button" onClick={connect} disabled={busy}>Add data types</button>}</div>}
      <div className="health-local-note"><ShieldCheck size={16}/><span>Saved on this device. No health data is uploaded to a server.</span></div>
    </section>
    {error&&<p className="health-error" role="alert">{error}</p>}{message&&<p className="health-message" role="status">{message}</p>}
    <section className="health-readings" aria-label="Daily health readings">
      <div className="health-section-heading"><div><h2>Your readings</h2><p>{health.lastSyncedAt ? `${health.source==='import'?'Snapshot from':'Last synced'} ${new Date(health.lastSyncedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}` : 'Your first readings will appear after syncing or importing.'}</p></div><label>Day<TouchSelect aria-label="Health readings date" value={selectedDate} onChange={event=>setSelectedDate(event.target.value)}>{dates.map(date=><option key={date} value={date}>{date===dateKey()?'Today':new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</option>)}</TouchSelect></label></div>
      <div className="health-metric-grid">{cards.map(({key,label,icon:Icon,unit,value})=><article className={`health-metric health-metric-${key}`} key={key}><div><span>{label}</span><Icon size={19}/></div><strong>{value==null?'—':value.toLocaleString('en-US',{maximumFractionDigits:['weightKg','sleepMinutes'].includes(key)?1:0})}<small>{value==null?'No record':unit}</small></strong></article>)}</div>
      <p className="health-reading-note">Missing readings stay blank. Active energy is kept separate from workout estimates, and synced weight does not replace weight entries you log yourself.</p>
    </section>
    <section className="health-transfer"><div><h2>Take your readings with you</h2><p>Transfer a FitTrack health file between the companion and a browser. It contains personal health data; share it only where you intend.</p></div><div className="health-actions"><button type="button" className="button button-secondary" onClick={exportData} disabled={!hasRecords||busy}><ArrowUpFromLine size={17}/>Export health data</button><button type="button" className="button button-secondary" onClick={()=>fileRef.current?.click()} disabled={busy}><ArrowDownToLine size={17}/>Import snapshot</button><input ref={fileRef} type="file" accept=".json,application/json" aria-label="Import FitTrack health file" hidden onChange={event=>{importData(event.target.files?.[0]);event.target.value='';}}/></div></section>
    <details className="health-help"><summary><span>Set up Samsung Health</span><ChevronDown size={19}/></summary><ol><li>On your phone, open Samsung Health → Settings → Health Connect.</li><li>In App permissions, allow Samsung Health to share the data you want, then reopen Samsung Health.</li><li>Open the FitTrack Android companion, choose Connect health data, and grant the read permissions you want.</li><li>Tap Sync now. Watch readings may take time to reach Samsung Health on your phone.</li></ol><p>Health Connect is built into Android 14 and later. On Android 9–13, install Health Connect first.</p><a href="https://developer.samsung.com/health/health-connect-faq.html" target="_blank" rel="noreferrer">Samsung’s connection guide ↗</a><p>Automatic refresh runs while FitTrack is open. The companion and your browser have separate local storage; desktop transfer uses the export/import controls above.</p></details>
    {(hasRecords||connected||health.autoSync)&&<div className="health-disconnect">{confirmClear?<><p>{native?'Disconnect FitTrack and clear its saved health readings?':'Clear the health readings saved in this browser?'} Your source health app is unaffected.</p><div className="health-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={()=>setConfirmClear(false)}>Keep data</button><button type="button" className="button danger-button" disabled={busy} onClick={async()=>{await disconnect();setConfirmClear(false);}}>Clear health data</button></div></>:<button type="button" className="text-button" onClick={()=>setConfirmClear(true)}><Unplug size={16}/>{native?'Disconnect & clear health data':'Clear imported health data'}</button>}</div>}
  </div>;
}
