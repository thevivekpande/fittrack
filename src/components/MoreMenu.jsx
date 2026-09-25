import { forwardRef } from 'react';
import { Check, ChevronRight, CircleHelp, Settings, UserRound, X } from 'lucide-react';
import './MoreMenu.css';

const MoreMenu = forwardRef(function MoreMenu({ items, view, name, onNavigate, onSettings, onHelp, onClose }, ref) {
  return <div className="more-menu-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section id="workspace-navigation" className="more-menu" role="dialog" aria-modal="true" aria-labelledby="more-menu-title" ref={ref} tabIndex={-1}>
      <div className="more-menu-handle" aria-hidden="true"/>
      <header className="more-menu-heading"><h2 id="more-menu-title">More</h2><button type="button" aria-label="Close menu" onClick={onClose}><X size={21}/></button></header>
      <div className="more-menu-content">
        <nav aria-label="More navigation">{items.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => onNavigate(id)}><Icon size={21}/><span>{label}</span>{view === id ? <Check size={17} aria-hidden="true"/> : <ChevronRight size={17} aria-hidden="true"/>}</button>)}</nav>
        <div className="more-menu-tools"><button type="button" onClick={onSettings}><Settings size={21}/><span>Settings</span><ChevronRight size={17} aria-hidden="true"/></button><button type="button" onClick={onHelp}><CircleHelp size={21}/><span>Help & getting started</span><ChevronRight size={17} aria-hidden="true"/></button></div>
        <button type="button" className="more-menu-profile" aria-label="Edit your profile" onClick={onSettings}><span className="more-menu-avatar"><UserRound size={21}/></span><span><strong>{name}</strong><small>Your profile & preferences</small></span><ChevronRight size={17} aria-hidden="true"/></button>
      </div>
    </section>
  </div>;
});

export default MoreMenu;
