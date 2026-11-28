import { useRef, useState } from 'react';
import { Alert, Modal } from 'react-bootstrap';
import StaffSelect from '../components/StaffSelect.jsx';
import MenuContent from '../components/MenuContent.jsx';
import { createMenu } from '../api/menus.js';
import { mealLabel } from '../api/slots.js';
import { menuToHtml } from '../utils/menuContent.js';
import '../styles/staff-menus.css';

const meals = ['breakfast', 'lunch', 'aperitivo', 'dinner'].map(value => ({ value, label: mealLabel(value) }));
const tools = [ ['Bold', 'B', '**'], ['Italic', 'I', '*'], ['Bullet list', '• ≡', '- '], ['Numbered list', '1. ≡', '1. '], ['Nested item', '↳', '  - '] ];

export default function StaffMenusPage() {
  const [name, setName] = useState('');
  const [meal, setMeal] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState('both');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const editor = useRef(null);
  const html = menuToHtml(text);
  function format(marker) {
    const field = editor.current;
    if (!field) return;
    const { selectionStart: start, selectionEnd: end } = field;
    const selected = text.slice(start, end);
    let from = start, to = end, replacement;
    if (marker === '*' || marker === '**') {
      replacement = marker + (selected || 'text') + marker;
    } else {
      from = text.lastIndexOf('\n', start - 1) + 1;
      const next = text.indexOf('\n', end);
      to = next === -1 ? text.length : next;
      replacement = text.slice(from, to).split('\n').map(line => marker + line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')).join('\n');
    }
    setText(text.slice(0, from) + replacement + text.slice(to));
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(from, from + replacement.length); });
  }
  function review(event) {
    event.preventDefault(); setError(''); setSaved('');
    if (!name.trim() || !meal || !text.trim() || !html) { setError('Enter a menu name, select a meal and write the menu content.'); return; }
    setConfirm(true);
  }
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await createMenu({ name: name.trim(), meal, content: html });
      setSaved(`${result.name} was saved to the menu library.`);
      setConfirm(false); setName(''); setMeal(''); setText('');
    } catch (err) {
      setError([err.message, ...(err.details || []).map(d => d.message).filter(Boolean)].join(' '));
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="staff-page staff-menus-page">
    <header className="staff-page-heading"><div><p className="staff-eyebrow">Service planning</p><h1>Menu management</h1><p>Create and organize menus for your hut’s services.</p></div></header>
    <section className="staff-panel">
      <div className="staff-panel-heading"><div><h2>Create a new menu</h2><p>Compose a reusable menu for your guests.</p></div><span className="staff-menu-kicker">MENU EDITOR</span></div>
      {saved && <Alert variant="success">{saved}</Alert>}
      <form onSubmit={review} noValidate>
        <div className="staff-menu-fields">
          <div className="staff-field"><label htmlFor="menu-name">Menu name</label><input id="menu-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="e.g. Traditional Alpine Menu" required /></div>
          <div className="staff-field"><label htmlFor="menu-meal">Meal</label><StaffSelect id="menu-meal" value={meal} onChange={setMeal} options={meals} placeholder="Choose a meal" /></div>
        </div>
        <div className="staff-menu-editor-heading"><h3>Menu content</h3><div className="staff-menu-tabs" aria-label="Editor view">{['editor', 'both', 'preview'].map(view => <button key={view} type="button" aria-pressed={mode === view} onClick={() => setMode(view)}>{view[0].toUpperCase()+view.slice(1)}</button>)}</div></div>
        <div className={`staff-menu-workspace ${mode === 'both' ? 'is-split' : ''}`}>
          {mode !== 'preview' && <div className="staff-menu-editor"><div className="staff-menu-toolbar" role="group" aria-label="Text formatting">{tools.map(([label, symbol, marker]) => <button key={label} type="button" title={label} aria-label={label} onMouseDown={e => e.preventDefault()} onClick={() => format(marker)}>{symbol}</button>)}</div><textarea ref={editor} aria-label="Menu content" value={text} onChange={e => setText(e.target.value)} placeholder={'Write your menu here…\n\n**Starters**\n- Homemade bread\n- Alpine cheese'} /><small>Select text to format it, or use the list tools.</small></div>}
          {mode !== 'editor' && <div className="staff-menu-preview"><div className="staff-menu-paper"><svg viewBox="0 0 32 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 25 12 5l5 10 5-7 8 17H2Z"/></svg><p className="staff-menu-kicker">EDELWEISS HUT{meal ? ` · ${mealLabel(meal).toUpperCase()}` : ''}</p><h3>{name.trim() || 'Untitled menu'}</h3><hr/>{html ? <MenuContent content={html}/> : <p className="staff-menu-empty">Your formatted menu will appear here.</p>}</div></div>}
        </div>
        {error && !confirm && <Alert variant="danger" className="mt-3">{error}</Alert>}
        <div className="staff-menu-footer"><small>{text.length} characters · Saved menus can be assigned to service slots.</small><button type="submit" className="staff-primary-button">Save menu <span aria-hidden="true">→</span></button></div>
      </form>
    </section>
    <Modal show={confirm} onHide={() => !busy && setConfirm(false)} centered scrollable backdrop="static" keyboard={!busy} dialogClassName="staff-confirm-modal eh-dialog" backdropClassName="eh-cancel-backdrop" aria-labelledby="menu-confirm-title">
      <Modal.Header closeButton={!busy}><div><p className="eh-dialog-eyebrow">Service planning</p><Modal.Title as="h2" id="menu-confirm-title">Confirm new menu</Modal.Title></div></Modal.Header>
      <Modal.Body><p className="staff-confirm-intro">Save this menu to the reusable menu library.</p><dl className="staff-confirm-details"><div><dt>Menu name</dt><dd>{name}</dd></div><div><dt>Meal</dt><dd>{mealLabel(meal)}</dd></div></dl><MenuContent content={html}/>{error && <Alert variant="danger" className="mt-3">{error}</Alert>}</Modal.Body>
      <Modal.Footer><button type="button" className="staff-outline-button" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="staff-primary-button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Confirm'}</button></Modal.Footer>
    </Modal>
  </div>;
}
