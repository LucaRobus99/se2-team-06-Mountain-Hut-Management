import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section className="eh-simple-page eh-wide-wrap">
      <p className="eh-page-eyebrow">404 · Wrong trail</p>
      <h1>We can't find that path.</h1>
      <p>The page you're looking for doesn't exist. You can head back to Edelweiss Hut.</p>
      <Link to="/" className="eh-button eh-button--green">Back to the Home</Link>
    </section>
  );
}
