import { Card, Col, Row } from 'react-bootstrap';

const menuSections = [
  {
    title: 'Breakfast',
    hours: '08:30 – 10:30',
    items: ['Homemade cakes', 'Hot drinks', 'Yogurt with granola']
  },
  {
    title: 'Lunch',
    hours: '12:00 – 14:30',
    items: ['Mountain pasta', 'Polenta dishes', 'Seasonal soups']
  },
  {
    title: 'Aperitivo',
    hours: '16:00 – 18:00',
    items: ['Local cheeses', 'Cold cuts', 'Aperitif drinks']
  },
  {
    title: 'Dinner',
    hours: '19:00 – 21:00',
    items: ['Warm alpine plates', 'Vegetarian option', 'Dessert of the day']
  }
];

export default function MenuPage() {
  return (
    <div className="inner-page-grid gap-4">
      <section>
        <p className="section-kicker mb-2">Public page</p>
        <h1 className="page-heading">Our menu</h1>
        <p className="page-lead text-secondary">
          A simple overview of the meal moments offered by Edelweiss Hut.
          Detailed menus can be refined later when the related stories are implemented.
        </p>
      </section>

      <Row className="g-4">
        {menuSections.map((section) => (
          <Col key={section.title} md={6}>
            <Card className="border-0 shadow-sm page-card h-100">
              <Card.Body className="p-4">
                <p className="section-kicker mb-2">{section.hours}</p>
                <h2 className="h4 mb-3">{section.title}</h2>
                <ul className="menu-item-list mb-0">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
