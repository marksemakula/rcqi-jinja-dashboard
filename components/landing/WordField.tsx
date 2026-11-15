import { buildWordField } from '@/lib/cqi-words';

const FIELD = buildWordField();

/**
 * The left half of the landing page: a rotated field of CQI words in mixed sizes, weights and tones. Decorative only,
 * so it is hidden from screen readers. Rendered on the server from a seeded generator, so it never changes between loads.
 */
export default function WordField() {
  return (
    <div className="landing-words" aria-hidden="true">
      <div className="word-field">
        {FIELD.map((line, l) => (
          <div className="wf-line" key={l}>
            {line.map((w, i) => (
              <span key={i} className={`wf s${w.size} w${w.weight} t${w.tone}${w.upper ? ' up' : ''}`}>{w.text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
