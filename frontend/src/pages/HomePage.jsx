import { Button, Card, Carousel, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { hutPhotos, latestNews } from '../data/homeContent.js';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <section className="mb-4 mb-md-5">
        <p className="text-uppercase small fw-bold text-success mb-2">Mountain Hut Management</p>
        <h1 className="display-6 fw-bold">
          {user ? `Welcome back, ${user.displayName}` : 'Welcome to the mountain hut'}
        </h1>
        <p className="lead text-secondary col-lg-8">
          A simple service for visitors planning a meal stop and for staff
          organising tables, time slots and reservations.
        </p>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to="/availability" variant="success">Check availability</Button>
          <Button as={Link} to="/book" variant="outline-success">Book a table</Button>
        </div>
      </section>
      {user ? <LoggedInContent /> : <VisitorCards />}
      <p className="small text-muted mt-4">
        Hut location, directions and nearby points of interest will be added when
        verified information about the specific hut is available.
      </p>
    </>
  );
}

function LoggedInContent() {
  // Le news più recenti per prime.
  const sortedNews = [...latestNews].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Row className="g-4">
      <Col lg={7}>
        <h2 className="h5 mb-3">The hut</h2>
        <Carousel className="hut-carousel shadow-sm" interval={5000}>
          {hutPhotos.map((photo) => (
            <Carousel.Item key={photo.src}>
              <img className="d-block w-100" src={photo.src} alt={photo.alt} />
              <Carousel.Caption>
                <p className="mb-0 fw-semibold">{photo.caption}</p>
              </Carousel.Caption>
            </Carousel.Item>
          ))}
        </Carousel>
      </Col>
      <Col lg={5}>
        <h2 className="h5 mb-3">Latest news</h2>
        <div className="news-list d-flex flex-column gap-3 pe-1">
          {sortedNews.map((news) => (
            <Card key={news.title} className="border-0 shadow-sm page-card">
              <Card.Body className="p-3">
                <p className="small text-success fw-bold mb-1">
                  {new Date(news.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <h3 className="h6 fw-bold">{news.title}</h3>
                <p className="text-secondary small mb-0">{news.text}</p>
              </Card.Body>
            </Card>
          ))}
        </div>
      </Col>
    </Row>
  );
}

function VisitorCards() {
  return (
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
  );
}
