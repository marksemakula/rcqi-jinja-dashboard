import { buildWordField, FIELD_H, FIELD_W } from '@/lib/cqi-words';

const BLOCKS = buildWordField();

/**
 * The left half of the landing page: a rotated field of CQI words in blocks whose text runs either along the field or
 * across it, in mixed sizes, weights and tones. Decorative only, so it is hidden from screen readers. Rendered on the
 * server from a seeded generator, so it never changes between loads.
 */
export default function WordField() {
  return (
    <div className="landing-words" aria-hidden="true">
      <div className="word-field" style={{ width: FIELD_W, height: FIELD_H }}>
        {BLOCKS.map((b, n) => (
          <div key={n} className={`wf-block ${b.dir}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
            {b.lines.map((line, l) => (
              <div className="wf-line" key={l}>
                {line.map((w, i) => (
                  <span key={i} className={`wf s${w.size} w${w.weight} t${w.tone}${w.upper ? ' up' : ''}`}>{w.text}</span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
