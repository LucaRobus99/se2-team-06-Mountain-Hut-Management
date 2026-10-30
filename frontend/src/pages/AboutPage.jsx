import { Button, Card, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';

export default function AboutPage() {
  return (
    <div className="inner-page-grid gap-4">
      <section>
        <p className="section-kicker mb-2">About Edelweiss Hut</p>
        <h1 className="page-heading">A simple alpine stop in the Dolomites.</h1>
        <p className="page-lead text-secondary">
          Edelweiss Hut is an imagined mountain restaurant set in the Seceda area,
          designed for hikers and skiers looking for a warm stop with a view.
        </p>
      </section>

      <Row className="g-4">
        <Col lg={4}>
          <Card className="border-0 shadow-sm page-card h-100">
            <Card.Body className="p-4">
              <h2 className="h5 mb-3">Our story</h2>
              <p className="text-secondary mb-0">
                The hut concept combines local food, panoramic terraces and a relaxed atmosphere,
                inspired by the mountain tradition of the Dolomites.
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="border-0 shadow-sm page-card h-100">
            <Card.Body className="p-4">
              <h2 className="h5 mb-3">Seasonal access</h2>
              <p className="text-secondary mb-0">
                The area is imagined as reachable through lifts and mountain trails depending on the season.
                Openings and slot availability may vary with weather conditions.
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="border-0 shadow-sm page-card h-100">
            <Card.Body className="p-4">
              <h2 className="h5 mb-3">Plan your stop</h2>
              <p className="text-secondary mb-0">
                Check the current availability online and continue to booking when you are ready to reserve a table.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="d-flex flex-wrap gap-2">
        <Button as={Link} to="/availability" className="search-submit-btn">Check availability</Button>
        <Button as={Link} to="/menu" variant="outline-success">Explore the menu</Button>
      </div>
    </div>
  );
}
