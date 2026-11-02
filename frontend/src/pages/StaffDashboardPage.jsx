import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router';
import { listStaffSlots, mealLabel, todayInHut } from '../api/slots.js';
import StaffDatePicker from '../components/StaffDatePicker.jsx';

export default function StaffDashboardPage() {
  const [date, setDate] = useState(todayInHut);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listStaffSlots(date).then((data) => {
      if (active) setSlots(data.slots || []);
    }).catch((err) => {
      if (active) setError(err.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [date]);

  const active = slots.filter((slot) => slot.status === 'available');
  const configuredSeats = active.reduce((sum, slot) => sum + slot.tables.reduce((n, table) => n + table.seats, 0), 0);
  return (
    <div className="staff-page">
      <div className="staff-page-heading"><div><p className="staff-eyebrow">OPERATIONS CENTER</p><h1>Overview</h1><p>Manage the schedule and keep the hut ready for its guests.</p></div><Link to="/staff/slots" className="staff-primary-button">Manage slots <span aria-hidden="true">↗</span></Link></div>
      <section className="staff-panel staff-overview-date"><label htmlFor="staff-overview-date">View schedule for</label><StaffDatePicker id="staff-overview-date" value={date} onChange={setDate} ariaLabel="Choose schedule date" /></section>
      {error && <Alert variant="danger" role="alert">{error}</Alert>}
      <div className="staff-stats" aria-live="polite">
        <div className="staff-stat"><span>Scheduled slots</span><strong>{loading ? '—' : slots.length}</strong></div>
        <div className="staff-stat"><span>Available slots</span><strong>{loading ? '—' : active.length}</strong></div>
        <div className="staff-stat"><span>Configured seats</span><strong>{loading ? '—' : configuredSeats}</strong></div>
      </div>
      <section className="staff-panel">
        <div className="staff-panel-heading"><h2>Daily schedule</h2></div>
        {loading ? <p className="staff-muted"><Spinner animation="border" size="sm" /> Loading slots…</p> : slots.length ? (
          <div className="staff-schedule-list">{slots.map((slot) => (
            <div className="staff-schedule-row" key={slot.id}>
              <span className="staff-schedule-time">{slot.startTime} – {slot.endTime}</span>
              <span><strong>{mealLabel(slot.meal)}</strong><small>{slot.tables.length} tables · {slot.tables.reduce((n, t) => n + t.seats, 0)} total seats</small></span>
              <span className={`staff-status ${slot.status !== 'available' ? 'staff-status--off' : ''}`}>{slot.status === 'available' ? 'Available' : 'Off'}</span>
            </div>
          ))}</div>
        ) : <div className="staff-empty"><h3>No slots configured</h3><p>Start by adding a service slot and setting its table capacities.</p><Link to="/staff/slots" className="staff-primary-button">Create a slot</Link></div>}
      </section>
    </div>
  );
}
