import { Children, Fragment, forwardRef, isValidElement, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import './TouchSelect.css';

function optionText(children) {
  return Children.toArray(children).map(child => isValidElement(child) ? optionText(child.props.children) : String(child)).join('');
}

function readOptions(children, groupDisabled = false) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type === 'option') return [{ value: String(child.props.value ?? optionText(child.props.children)), label: optionText(child.props.children), disabled: groupDisabled || child.props.disabled }];
    if (child.type === Fragment || child.type === 'optgroup') return readOptions(child.props.children, groupDisabled || child.props.disabled);
    return [];
  });
}

function labelFor(button, explicitLabel, labelledBy) {
  if (explicitLabel) return explicitLabel;
  if (labelledBy) return labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
  return Array.from(button?.labels || []).map(label => {
    const clone = label.cloneNode(true);
    clone.querySelectorAll('.touch-select').forEach(field => field.remove());
    return clone.textContent.trim();
  }).join(' ').trim() || 'Choose an option';
}

/** A labelled field that opens a touch-friendly, keyboard-accessible choice sheet. */
const TouchSelect = forwardRef(function TouchSelect({
  id, name, value = '', onChange, disabled = false, required = false, children,
  className = '', 'aria-label': ariaLabel, 'aria-labelledby': labelledBy,
  'aria-describedby': describedBy, 'aria-invalid': invalid, ...buttonProps
}, forwardedRef) {
  const uid = useId();
  const trigger = useRef(null);
  const dialog = useRef(null);
  const list = useRef(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Choose an option');
  const [query, setQuery] = useState('');
  const [activeValue, setActiveValue] = useState('');
  const [requiredError, setRequiredError] = useState(false);
  const options = readOptions(children);
  const selected = options.find(option => option.value === String(value));
  const choices = options.filter(option => !(option.disabled && option.value === ''));
  const matches = choices.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const enabled = matches.filter(option => !option.disabled);
  const active = enabled.find(option => option.value === activeValue) || enabled[0];
  const activeIndex = matches.findIndex(option => option === active);
  const valueLabel = selected?.label || 'Choose an option';
  const hasError = invalid === true || invalid === 'true' || requiredError;

  useImperativeHandle(forwardedRef, () => trigger.current);

  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function show() {
    if (disabled || trigger.current?.matches(':disabled') || open) return;
    setTitle(labelFor(trigger.current, ariaLabel, labelledBy));
    setQuery('');
    setActiveValue(selected && !selected.disabled ? selected.value : choices.find(option => !option.disabled)?.value || '');
    typeahead.current = { text: '', time: 0 };
    setOpen(true);
  }

  function choose(option) {
    if (!option || option.disabled) return;
    const target = { value: option.value, name, id };
    setRequiredError(false);
    onChange?.({ target, currentTarget: target, type: 'change' });
    close();
  }

  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    node.showModal();
    list.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (viewport && viewport.scale !== 1) return;
      node.style.setProperty('--choice-viewport-height', `${viewport?.height || window.innerHeight}px`);
      node.style.setProperty('--choice-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    return () => {
      node.close();
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active?.value, query]);

  function navigate(event) {
    if (event.key === 'Tab') {
      const stops = [...dialog.current.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [tabindex="0"]')]
        .filter(node => node.getClientRects().length);
      const first = stops[0];
      const last = stops.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    const inSearch = event.target.tagName === 'INPUT';
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || (!inSearch && ['Home', 'End'].includes(event.key))) {
      event.preventDefault();
      const current = enabled.findIndex(option => option.value === active?.value);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
      setActiveValue(enabled[next]?.value || '');
      if (inSearch) list.current?.focus({ preventScroll: true });
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === list.current) {
      event.preventDefault();
      choose(active);
    } else if (!inSearch && event.target === list.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - typeahead.current.time < 700 ? typeahead.current.text : '') + event.key.toLocaleLowerCase();
      typeahead.current = { text, time: now };
      const found = enabled.find(option => option.label.toLocaleLowerCase().startsWith(text));
      if (found) setActiveValue(found.value);
    }
  }

  return <span className={`touch-select ${value === '' ? 'touch-select--placeholder' : ''} ${hasError ? 'touch-select--invalid' : ''} ${className}`}>
    <button {...buttonProps} ref={trigger} id={id} name={name} type="button" disabled={disabled} className="touch-select__trigger" onClick={event => { event.stopPropagation(); show(); }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }} aria-label={ariaLabel} aria-labelledby={labelledBy} aria-describedby={[`${uid}-value`, describedBy, requiredError ? `${uid}-error` : ''].filter(Boolean).join(' ')} aria-invalid={hasError || undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${uid}-dialog` : undefined}>
      <span id={`${uid}-value`} className="touch-select__value">{valueLabel}</span><ChevronDown size={18} aria-hidden="true"/>
    </button>
    <input className="touch-select__form-value" type={required ? 'text' : 'hidden'} tabIndex={-1} aria-hidden="true" name={name} value={String(value)} disabled={disabled} required={required} onChange={() => {}} onInvalid={event => { event.preventDefault(); setRequiredError(true); trigger.current?.focus({ preventScroll: true }); }}/>
    {requiredError && <span id={`${uid}-error`} className="touch-select__error">Choose an option to continue.</span>}
    {open && createPortal(<dialog ref={dialog} id={`${uid}-dialog`} className="touch-select-dialog" aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-hint`} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} onClose={() => setOpen(false)} onKeyDown={event => { event.stopPropagation(); navigate(event); }} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }} onMouseDown={event => event.stopPropagation()}>
      <div className="touch-select-dialog__panel">
        <div className="touch-select-dialog__handle" aria-hidden="true"/>
        <div className="touch-select-dialog__heading"><div><p className="touch-select-dialog__eyebrow">MAKE IT YOURS</p><h2 id={`${uid}-title`}>{title}</h2><p id={`${uid}-hint`}>Tap an option to select it.</p></div><button type="button" className="touch-select-dialog__close" aria-label={`Close ${title.toLocaleLowerCase()} options`} onClick={close}><X size={20}/></button></div>
        {choices.length > 8 && <div className="touch-select-dialog__search"><Search size={19} aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an option" aria-label={`Search ${title.toLocaleLowerCase()} options`} autoComplete="off" autoCorrect="off" spellCheck={false}/>{query && <button type="button" aria-label="Clear option search" onClick={() => setQuery('')}><X size={17}/></button>}</div>}
        <div className="touch-select-dialog__list" ref={list} role="listbox" tabIndex={0} aria-labelledby={`${uid}-title`} aria-required={required || undefined} aria-activedescendant={active ? `${uid}-option-${activeIndex}` : undefined}>
          {matches.map((option, index) => <button key={option.value} id={`${uid}-option-${index}`} type="button" role="option" tabIndex={-1} disabled={option.disabled} aria-selected={option.value === String(value)} data-active={active?.value === option.value} className="touch-select-dialog__option" onClick={() => choose(option)} onPointerMove={event => { if (event.pointerType === 'mouse' && !option.disabled) setActiveValue(option.value); }}><span>{option.label}</span><span className="touch-select-dialog__check" aria-hidden="true">{option.value === String(value) && <Check size={16} strokeWidth={2.5}/>}</span></button>)}
          {!matches.length && <p className="touch-select-dialog__empty" role="status">No matching options. Try a different search.</p>}
        </div>
      </div>
    </dialog>, document.body)}
  </span>;
});

export default TouchSelect;
