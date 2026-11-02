import { Link } from 'react-router';
import menuBackground from '../assets/edelweiss-hero.png';

export default function MenuPage() {
  return (
    <div className="eh-editorial-page eh-menu-page">
      <section className="eh-page-banner eh-menu-banner" style={{ backgroundImage: `url(${menuBackground})` }}>
        <div className="eh-wide-wrap eh-banner-content">
          <p className="eh-page-eyebrow">Food &amp; drinks</p>
          <h1>Our menu.</h1>
          <p>Mountain flavours, served with a view.</p>
        </div>
      </section>
      <section className="eh-menu-empty eh-wide-wrap">
        <span className="eh-ornament" aria-hidden="true">✳</span>
        <h2>Something good is coming.</h2>
        <p>Our menu will be available here soon.</p>
        <Link to="/availability" className="eh-button eh-button--green">Check availability <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
