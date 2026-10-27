import PagePlaceholder from '../components/PagePlaceholder.jsx';

export default function BookingPage() {
  return (
    <PagePlaceholder
      story="MHM-1 · Book a table"
      title="Book a table"
      description="Hikers will choose an available meal slot and party size to reserve seats. The booking rules and two-hour cutoff will be enforced by the backend."
      nextStep="Gaia will add the booking form after the REST API contract has been agreed. Hiker authentication will be connected separately."
    />
  );
}
