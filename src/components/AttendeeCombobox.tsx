import Fuse from 'fuse.js';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { RosterEntry } from '../lib/schema';

type Props = {
  rowNumber: number;
  value: string;
  entries: RosterEntry[];
  onChange: (value: string) => void;
  onSelect: (entry: RosterEntry) => void;
};

const GAP = 4;
const EDGE = 8;

// The listbox renders in a portal because the attendee table scrolls horizontally, and a
// scroll container clips its overflow on both axes. Anchor it to the input by hand instead.
function listPosition(input: HTMLInputElement): CSSProperties {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const rect = input.getBoundingClientRect();
  const preferred = 16 * rem;
  const below = window.innerHeight - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const flip = below < Math.min(preferred, above);
  const width = Math.min(Math.max(rect.width, 24 * rem), 40 * rem, window.innerWidth - EDGE * 2);
  return {
    left: Math.min(Math.max(rect.left, EDGE), window.innerWidth - width - EDGE),
    width,
    maxHeight: Math.max(Math.min(preferred, flip ? above : below), 4 * rem),
    ...(flip ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
  };
}

export function AttendeeCombobox({ rowNumber, value, entries, onChange, onSelect }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listStyle, setListStyle] = useState<CSSProperties>();
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => new Fuse(entries, { keys: ['name'], threshold: 0.38, includeScore: true }), [entries]);

  const suggestions = useMemo(() => {
    const query = value.trim();
    if (!query) return [];
    const normalized = query.toLocaleLowerCase();
    const scored = fuse.search(query).map(({ item, score }) => ({ item, score: score ?? 1 }));
    for (const entry of entries) {
      const name = entry.name.toLocaleLowerCase();
      if (name === normalized || name.startsWith(normalized) || name.split(/\s+/).some((word) => word.startsWith(normalized))) {
        const score = name === normalized ? -2 : name.startsWith(normalized) ? -1 : -0.5;
        const existing = scored.find((result) => result.item.id === entry.id);
        if (existing) existing.score = Math.min(existing.score, score);
        else scored.push({ item: entry, score });
      }
    }
    return scored
      .sort((a, b) => a.score - b.score || Number(Boolean(b.item.lastUsedAt)) - Number(Boolean(a.item.lastUsedAt)) || a.item.name.localeCompare(b.item.name))
      .slice(0, 8)
      .map(({ item }) => item);
  }, [entries, value, fuse]);

  const expanded = open && suggestions.length > 0;

  useLayoutEffect(() => {
    if (!expanded) return;
    const place = () => { if (inputRef.current) setListStyle(listPosition(inputRef.current)); };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [expanded, suggestions.length]);

  function select(entry: RosterEntry) {
    onSelect(entry);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index < 0 ? suggestions.length - 1 : Math.max(index - 1, 0)));
    } else if (event.key === 'Enter' && open && suggestions[activeIndex]) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="combobox">
      <input
        ref={inputRef}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={expanded}
        aria-label={`Attendee ${rowNumber} name`}
        aria-activedescendant={open && suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        value={value}
      />
      {expanded ? createPortal(
        <ul id={listId} role="listbox" className="suggestions" style={listStyle}>
          {suggestions.map((entry, index) => (
            <li
              aria-selected={index === activeIndex}
              id={`${listId}-${index}`}
              key={entry.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(entry)}
              role="option"
            >
              {entry.name} — {entry.affiliation} ({entry.source === 'official' ? 'Lab roster' : 'Local contact'})
            </li>
          ))}
        </ul>,
        document.body,
      ) : null}
    </div>
  );
}
