import { Link } from 'react-router';

export default function SlotManagementPage() {
  return (
    <section className="eh-simple-page eh-wide-wrap">
      <p className="eh-page-eyebrow">Staff workspace</p>
      <h1>Meal slot management.</h1>
      <p>This area is being prepared for the team. Slot configuration and its staff permissions are not available from this screen yet.</p>
      <Link to="/" className="eh-button eh-button--green">Return home</Link>
    </section>
  );
}
