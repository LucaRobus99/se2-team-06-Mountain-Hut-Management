import { Button, Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';

export default function HomePage() {
  return (
    <>
      <section className="mb-4 mb-md-5">
        <p className="text-uppercase small fw-bold text-success mb-2">Mountain Hut Management</p>
        <h1 className="display-6 fw-bold">Welcome to the mountain hut</h1>
        <p className="lead text-secondary col-lg-8">
          A simple service for visitors planning a meal stop and for staff
          organising tables, time slots and reservations.
        </p>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to="/availability" variant="success">Check availability</Button>
          <Button as={Link} to="/book" variant="outline-success">Book a table</Button>
        </div>
      </section>
      <Row className="g-3">
        <Col md={6}>
          <Card className="h-100 border-0 shadow-sm page-card">
            <Card.Body className="p-4">
              <h2 className="h5">For visitors</h2>
              <p className="text-secondary mb-0">
                Check available seats and plan a meal stop. Booking will be available
                when the corresponding story has been implemented.
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="h-100 border-0 shadow-sm page-card">
            <Card.Body className="p-4">
              <h2 className="h5">For hut staff</h2>
              <p className="text-secondary mb-0">
                Configure meal slots and table capacities. Employee access will be
                connected when authentication is implemented.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <p className="small text-muted mt-4">
        Hut location, directions and nearby points of interest will be added when
        verified information about the specific hut is available.
      </p>
    </>
  );
}
