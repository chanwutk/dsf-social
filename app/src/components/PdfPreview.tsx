import { useEffect, useRef } from 'react';

type Props = { url: string; filename: string; onClose: () => void };

export function PdfPreview({ url, filename, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  return (
    <dialog ref={dialogRef} onClose={onClose} className="pdf-dialog" aria-labelledby="pdf-dialog-title">
      <h2 id="pdf-dialog-title">Review PDF</h2>
      <p>The preview is read-only. Return to the form to make changes.</p>
      <iframe src={url} title="Completed reimbursement PDF preview" />
      <div className="actions">
        <a href={url} download={filename}>Download PDF</a>
        <button type="button" onClick={() => dialogRef.current?.close()}>Close</button>
      </div>
    </dialog>
  );
}
