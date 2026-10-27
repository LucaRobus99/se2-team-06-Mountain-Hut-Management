import { Button } from 'react-bootstrap';
import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="text-center py-5">
      <h1 className="display-6">Page not found</h1>
      <p className="text-secondary">The requested page does not exist.</p>
      <Button as={Link} to="/" variant="outline-success">Return home</Button>
    </div>
  );
}
