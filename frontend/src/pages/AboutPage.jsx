import { useEffect } from 'react';
import { useLocation } from 'react-router';
import routeIllustration from '../assets/edelweiss-route-illustration.png';

const HUT_MAP = 'https://www.google.com/maps/search/?api=1&query=Sofie%20Hut%2C%20Streda%20Mastl%C3%A8%2064%2C%20Santa%20Cristina%20Val%20Gardena';
const PARKING_MAP = 'https://www.google.com/maps/search/?api=1&query=Parking%20%2B%20Garage%20Seceda%2C%20Streda%20Annatal%2C%20Ortisei';
const LIFT_TIMETABLE = 'https://www.seceda.it/en/summer';

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 5h6v6" />
      <path d="m19 5-9 9" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

export default function AboutPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === '#getting-here') {
      requestAnimationFrame(() => {
        document.getElementById('getting-here')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [hash]);

  return (
    <div className="eh-editorial-page eh-about-page eh-find-us-page">
      <section className="eh-find-us-section" id="getting-here" aria-labelledby="eh-find-us-heading">
        <div className="eh-find-us-backdrop" aria-hidden="true" />

        <div className="eh-wide-wrap eh-find-us-inner">
          <header className="eh-find-us-heading">
            <h1 id="eh-find-us-heading">Find us</h1>
            <p>In the heart of the Dolomites, just a short walk from the top of Seceda.</p>
          </header>

          <div className="eh-find-us-layout">
            <figure className="eh-route-visual">
              <img
                src={routeIllustration}
                alt="Illustrated alpine route with four steps: Ortisei valley station, transfer at Furnes, Seceda upper station and the hut, about 200 metres away on foot."
              />
            </figure>

            <div className="eh-find-us-cards">
              <article className="eh-info-card">
                <div className="eh-info-copy">
                  <h2>Our location</h2>
                  <address>Streda Mastlè 64<br />39047 Santa Cristina Val Gardena (BZ)<br />South Tyrol · Italy</address>
                  <a className="eh-info-map-link" href={HUT_MAP} target="_blank" rel="noopener noreferrer"><ExternalIcon /> Open in Google Maps</a>
                </div>
              </article>

              <article className="eh-info-card">
                <div className="eh-info-copy">
                  <h2>How to reach us</h2>
                  <p>Start in <strong>Ortisei</strong>, near the Seceda valley station. Take the gondola to <strong>Furnes</strong>, change there to the <strong>Furnes–Seceda cable car</strong>, then follow the short marked path (about 200 m) to our hut.</p>
                </div>
              </article>

              <article className="eh-info-card">
                <div className="eh-info-copy">
                  <h2>Before your visit</h2>
                  <p>The mountain lifts operate seasonally and usually stop before our hut closes. Check the last return service, weather and trail conditions before setting out.</p>
                  <a className="eh-info-inline-link" href={LIFT_TIMETABLE} target="_blank" rel="noopener noreferrer">Official lift timetable <span aria-hidden="true">↗</span></a>
                </div>
              </article>
            </div>
          </div>

          <div className="eh-journey-steps" aria-label="Ways to reach the hut">
            <article className="eh-journey-step">
              <div className="eh-journey-copy">
                <h3>By car</h3>
                <p>The hut cannot be reached by car. Park at <strong>Parkgarage Seceda</strong>, next to the valley station. Spaces are limited and parking is paid.</p>
                <a className="eh-parking-link" href={PARKING_MAP} target="_blank" rel="noopener noreferrer">Parking on Google Maps <span aria-hidden="true">↗</span></a>
              </div>
            </article>

            <article className="eh-journey-step">
              <div className="eh-journey-copy">
                <h3>By cable car</h3>
                <p>From Ortisei, take the <strong>gondola to Furnes</strong>. Get off and transfer to the <strong>Seceda cable car</strong>. From the upper station, walk about 200 m to the hut.</p>
              </div>
            </article>

            <article className="eh-journey-step">
              <div className="eh-journey-copy">
                <h3>On foot</h3>
                <p>Prefer hiking? You can walk up from <strong>Ortisei</strong> on marked mountain trails, without taking the lifts. It's a demanding ascent that requires about <strong>4 hours</strong>.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
