import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { RosterEntry } from '../lib/schema';
import { SKY_PEOPLE_URL } from '../lib/roster';

type Props = {
  open: boolean;
  official: RosterEntry[];
  local: RosterEntry[];
  onClose: () => void;
  onAdd: (name: string, affiliation: string) => Promise<void>;
  onDelete: (entry: RosterEntry) => Promise<void>;
};

export function RosterDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (props.open && !ref.current?.open) ref.current?.showModal();
    if (!props.open && ref.current?.open) ref.current.close();
  }, [props.open]);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      await props.onAdd(name, affiliation);
      setName('');
      setAffiliation('');
      setStatus('Contact saved in this browser.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <dialog ref={ref} onClose={props.onClose} className="list-dialog" aria-labelledby="roster-dialog-title">
      <h2 id="roster-dialog-title">Attendee roster</h2>
      <p>The official roster is refreshed on each deployment, including weekly updates, and is included in the website files. Sources: <a href={SKY_PEOPLE_URL}>Sky Lab</a> and <a href="https://slice.eecs.berkeley.edu/people/">SLICE Lab</a>, and <a href="https://epic.berkeley.edu/">EPIC Lab</a>.</p>
      <p>If a lab website is unavailable, we use a Wayback Machine archive or the bundled snapshot. Archived rosters may be out of date.</p>
      <section>
        <h3>Local contacts</h3>
        <form onSubmit={add} className="form-grid">
          <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Occupation / affiliation<input required value={affiliation} onChange={(event) => setAffiliation(event.target.value)} /></label>
          <div><button type="submit">Add contact</button></div>
        </form>
        <ul>{props.local.map((entry) => <li key={entry.id}>{entry.name} — {entry.affiliation} <button type="button" onClick={() => props.onDelete(entry)}>Delete</button></li>)}</ul>
      </section>
      <details>
        <summary>Show {props.official.length} official roster entries</summary>
        <ul className="roster-list">{props.official.map((entry) => <li key={entry.id}>{entry.name} — {entry.role} → {entry.affiliation}</li>)}</ul>
      </details>
      <p role="status">{status}</p>
      <button type="button" onClick={props.onClose}>Close</button>
    </dialog>
  );
}
