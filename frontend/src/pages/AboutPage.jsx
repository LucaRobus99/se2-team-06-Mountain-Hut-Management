import { Link } from 'react-router';
import hutPhoto from '../assets/edelweiss-terrace.jpg';
import mountainsPhoto from '../assets/edelweiss-dolomites.png';
import terracePhoto from '../assets/edelweiss-hero.png';

export default function AboutPage() {
  return (
    <div className="eh-editorial-page eh-about-page">
      <section className="eh-about-intro eh-wide-wrap">
        <div className="eh-about-intro-copy">
          <p className="eh-page-eyebrow">Our hut <span className="eh-label-line" /></p>
          <h1>A place to slow down, high above the valley.</h1>
          <p className="eh-about-lead">There's something about the mountains that makes the simplest moments feel special.</p>
          <p>At Edelweiss Hut, the table is part of the journey: a chance to set down your backpack, enjoy good food and take in the view together. No rush. Just the pleasure of being here.</p>
          <Link className="eh-text-button" to="/availability">Plan your visit <span aria-hidden="true">↗</span></Link>
        </div>
        <img src={hutPhoto} alt="Wooden Edelweiss Hut sign in an alpine setting" />
      </section>

      <section className="eh-about-story">
        <div className="eh-wide-wrap eh-about-story-grid">
          <img src={terracePhoto} alt="An inviting alpine restaurant terrace" loading="lazy" />
          <div>
            <p className="eh-page-eyebrow">The Edelweiss spirit</p>
            <h2>Good food tastes even better after the climb.</h2>
            <p>A day outdoors has its own rhythm: the first steps on the trail, the changing light on the peaks, the moment you finally sit down. Our idea of a mountain hut is built around that last moment.</p>
            <p>A welcoming table, the flavours of the mountains and time to share the day’s stories: the things worth making a little room for.</p>
          </div>
        </div>
      </section>

      <section className="eh-about-location eh-wide-wrap" id="getting-here">
        <div>
          <p className="eh-page-eyebrow">Find us</p>
          <h2>In the heart of the Dolomites.</h2>
          <p>Edelweiss Hut is set in the Seceda area above Val Gardena, surrounded by hiking routes, alpine views and winter ski slopes.</p>
          <p>Access depends on the season, mountain weather and lift operations. Check the current conditions and your route before setting off.</p>
          <Link to="/availability" className="eh-button eh-button--green">Check availability <span aria-hidden="true">↗</span></Link>
        </div>
        <img src={mountainsPhoto} alt="The panoramic mountain landscape around Seceda and Val Gardena" loading="lazy" />
      </section>
    </div>
  );
}
