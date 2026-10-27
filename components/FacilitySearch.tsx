'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

const ALL = 'All';

export interface FacilityOption { name: string; district: string | null }

/**
 * Type-to-search facility filter. Typing narrows the list (any word of the name or district); arrow keys and Enter, or a
 * click, choose a facility; Escape closes without changing the selection. Behaves as a WAI-ARIA combobox with a listbox.
 */
export default function FacilitySearch({ value, options, onChange, allLabel = 'All facilities', label = 'Facility' }: {
  value: string; options: FacilityOption[]; onChange: (v: string) => void; allLabel?: string; label?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = options.slice().sort((a, b) => (a.district || '').localeCompare(b.district || '') || a.name.localeCompare(b.name));
    // Searchable text includes the usual abbreviations, so "hc" finds Health Centre and "hosp" finds Hospital.
    const text = (o: FacilityOption) => `${o.name} ${o.district || ''}`.replace(/health cent(re|er)/gi, '$& hc').replace(/hospital/gi, '$& hosp').toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const hits = q ? sorted.filter((o) => {
      const t = text(o);
      const tokens = t.split(/[^a-z0-9]+/);
      return words.every((w) => tokens.some((x) => x.startsWith(w))) || t.includes(q);
    }) : sorted;
    return q ? hits : [{ name: ALL, district: null }, ...hits];
  }, [options, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open && matches[active]) { e.preventDefault(); choose(matches[active].name); } }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const shown = value === ALL ? allLabel : value;
  return (
    <div className="select search-select">
      <span id={`${id}-label`}>{label}</span>
      <div className={`combo${open ? ' open' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
          placeholder={open ? 'Type to search facilities' : shown}
          value={open ? query : shown}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onBlur={() => { setOpen(false); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKey}
          autoComplete="off"
          spellCheck={false}
        />
        {open && (
          <ul id={listId} role="listbox" ref={listRef} className="combo-list" aria-label={`${label} options`}>
            {matches.length === 0 && <li className="combo-empty" role="presentation">No facility matches &ldquo;{query}&rdquo;</li>}
            {matches.map((o, i) => (
              <li
                key={o.name}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.name === value}
                className={`combo-option${i === active ? ' active' : ''}${o.name === value ? ' chosen' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); choose(o.name); }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="combo-name">{o.name === ALL ? allLabel : o.name}</span>
                {o.district && <span className="combo-district">{o.district}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
