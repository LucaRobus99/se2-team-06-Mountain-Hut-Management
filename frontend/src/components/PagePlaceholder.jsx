import { Badge, Card } from 'react-bootstrap';

/** Temporary page shell: replaced by the corresponding story task. */
export default function PagePlaceholder({ story, title, description, nextStep }) {
  return (
    <Card className="border-0 shadow-sm page-card">
      <Card.Body className="p-4 p-md-5">
        <Badge bg="secondary" className="mb-3">{story}</Badge>
        <h1 className="h2">{title}</h1>
        <p className="text-secondary mb-3">{description}</p>
        <p className="small text-muted mb-0">
          <strong>Not implemented yet.</strong> {nextStep}
        </p>
      </Card.Body>
    </Card>
  );
}
