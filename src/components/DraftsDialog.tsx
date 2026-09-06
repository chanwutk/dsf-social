import { useEffect, useRef } from 'react';
import type { Draft } from '../../shared/schema';

type Props = {
  open: boolean;
  drafts: Draft[];
  currentId?: string;
  onClose: () => void;
  onNew: () => void;
  onSelect: (draft: Draft) => void;
  onDuplicate: (draft: Draft) => void;
  onDelete: (draft: Draft) => void;
};

export function DraftsDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (props.open && !ref.current?.open) ref.current?.showModal();
    if (!props.open && ref.current?.open) ref.current.close();
  }, [props.open]);
  return (
    <dialog ref={ref} onClose={props.onClose} className="list-dialog" aria-labelledby="drafts-dialog-title">
      <h2 id="drafts-dialog-title">Drafts</h2>
      <p>Drafts are stored only in this browser. Generated PDFs are not stored.</p>
      <div className="actions"><button type="button" onClick={props.onNew}>New draft</button><button type="button" onClick={props.onClose}>Close</button></div>
      {props.drafts.length ? (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Event date</th><th>Location</th><th>Saved</th><th>Actions</th></tr></thead>
            <tbody>{props.drafts.map((draft) => (
              <tr key={draft.id}>
                <td>{draft.draftName}{draft.id === props.currentId ? ' (current)' : ''}</td>
                <td>{draft.eventDate || '—'}</td>
                <td>{draft.location || '—'}</td>
                <td>{new Date(draft.updatedAt).toLocaleString()}</td>
                <td className="actions">
                  <button type="button" onClick={() => props.onSelect(draft)}>Open</button>
                  <button type="button" onClick={() => props.onDuplicate(draft)}>Duplicate</button>
                  <button type="button" onClick={() => props.onDelete(draft)}>Delete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p>No saved drafts yet.</p>}
    </dialog>
  );
}
