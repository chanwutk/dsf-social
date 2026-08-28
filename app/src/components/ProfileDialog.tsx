import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ProfileSchema } from '../../shared/schema';
import type { Profile } from '../../shared/schema';

const emptyProfile: Profile = { name: '', address: '', email: '', employeeId: '' };

type Props = {
  open: boolean;
  profile: Profile | null;
  templateName?: string;
  signatureName?: string;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
  onTemplate: (file: File) => Promise<Profile>;
  onClearTemplate: () => Promise<void>;
  onSignature: (file: File) => Promise<void>;
  onClearSignature: () => Promise<void>;
  onDeleteAll: () => Promise<void>;
};

export function ProfileDialog(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<Profile>(props.profile ?? emptyProfile);
  const [status, setStatus] = useState('');

  useEffect(() => { setValue(props.profile ?? emptyProfile); }, [props.profile, props.open]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal();
    if (!props.open && dialog.open) dialog.close();
  }, [props.open]);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed = ProfileSchema.parse(value);
      setStatus('Saving…');
      await props.onSave(parsed);
      setStatus('Saved in this browser.');
      props.onClose();
    } catch (error) {
      setStatus(`Could not save: ${(error as Error).message}`);
    }
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const parsed = ProfileSchema.parse(typeof raw === 'object' && raw && 'profile' in raw ? (raw as { profile: unknown }).profile : raw);
      setValue(parsed);
      setStatus('Profile JSON loaded. Select Save profile to keep it.');
    } catch (error) {
      setStatus(`Could not import profile JSON: ${(error as Error).message}`);
    } finally {
      event.target.value = '';
    }
  }

  async function importPersonalizedPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus('Reading profile fields from the PDF…');
      const extracted = await props.onTemplate(file);
      setValue(extracted);
      setStatus('Profile loaded and personalized PDF saved. Review the fields, then select Save profile.');
    } catch (error) {
      setStatus(`Could not use the personalized PDF: ${(error as Error).message}`);
    } finally {
      event.target.value = '';
    }
  }

  function exportJson() {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'erso-profile.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="profile-dialog-title"
      onCancel={(event) => { if (!props.profile) event.preventDefault(); }}
      onClose={() => { if (props.profile) props.onClose(); }}
    >
      <h2 id="profile-dialog-title">{props.profile ? 'Profile and local files' : 'Set up this browser'}</h2>
      <p>Your information stays in this browser and is not sent to a server.</p>
      <fieldset>
        <legend>Use a personalized blank PDF</legend>
        <p>Select your already-filled blank ERSO form. The app will read the profile fields below and reuse the PDF, including its existing signature.</p>
        <label>
          Personalized blank PDF
          <input type="file" accept="application/pdf,.pdf" onChange={importPersonalizedPdf} />
        </label>
        <p>{props.templateName ? `Using ${props.templateName}` : 'No personalized PDF selected; the sanitized built-in template will be used.'} {props.templateName ? <button type="button" onClick={props.onClearTemplate}>Use built-in template</button> : null}</p>
      </fieldset>
      <p>Or enter the profile manually or import JSON:</p>
      <form onSubmit={save}>
        <label>Name<input required autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
        <label>Address<textarea required rows={3} value={value.address} onChange={(event) => setValue({ ...value, address: event.target.value })} /></label>
        <label>Email<input required type="email" value={value.email} onChange={(event) => setValue({ ...value, email: event.target.value })} /></label>
        <label>UCB employee or student ID<input required value={value.employeeId} onChange={(event) => setValue({ ...value, employeeId: event.target.value })} /></label>
        <div className="actions">
          <button type="submit">Save profile</button>
          <button type="button" onClick={() => importRef.current?.click()}>Import profile JSON</button>
          <button type="button" onClick={exportJson}>Export profile JSON</button>
          {props.profile ? <button type="button" onClick={props.onClose}>Close</button> : null}
          <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importJson} />
        </div>
      </form>

      <details>
        <summary>Optional separate signature image</summary>
        <p>Use this only with the sanitized built-in template. A personalized PDF can supply its existing signature instead.</p>
        <label>
          Signature image
          <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) { await props.onSignature(file); setStatus('Signature image saved in this browser.'); }
            event.target.value = '';
          }} />
        </label>
        <p>{props.signatureName ? `Using ${props.signatureName}` : 'No separate signature image.'} {props.signatureName ? <button type="button" onClick={props.onClearSignature}>Remove signature image</button> : null}</p>
      </details>

      {props.profile ? (
        <details>
          <summary>Delete browser data</summary>
          <p>This deletes the profile, drafts, contacts, and uploaded local files from this browser.</p>
          <button type="button" onClick={props.onDeleteAll}>Delete all local data</button>
        </details>
      ) : null}
      <p role="status">{status}</p>
    </dialog>
  );
}
