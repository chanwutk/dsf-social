import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  costPerPerson,
  countedAttendees,
  createDraft,
  downloadFileName,
  EVENT_TYPES,
  MEAL_LIMITS,
  normalizeName,
  policyWarnings,
  validationErrors,
} from './lib/form-logic';
import { DraftSchema } from './lib/schema';
import type { Draft, Profile, RosterEntry } from './lib/schema';
import { AttendeeCombobox } from './components/AttendeeCombobox';
import { DraftsDialog } from './components/DraftsDialog';
import { PdfPreview } from './components/PdfPreview';
import { ProfileDialog } from './components/ProfileDialog';
import { RosterDialog } from './components/RosterDialog';
import { downloadJson } from './lib/download';
import { localContact, officialRoster } from './lib/roster';
import {
  clearLocalData,
  deleteContact,
  deleteDraft,
  deleteSetting,
  getProfile,
  getSetting,
  listContacts,
  listDrafts,
  saveContact,
  saveDraft,
  saveProfile,
  setSetting,
  storedFile,
} from './lib/storage';
import type { StoredFile } from './lib/storage';

function nextBlankAttendee() {
  return { id: crypto.randomUUID(), name: '', affiliation: '' };
}

function prepareDraft(draft: Draft, profile: Profile) {
  const attendees = [...draft.attendees];
  attendees[0] = { ...attendees[0], name: profile.name, affiliation: 'Host (must be in attendance)' };
  if (attendees.length < 20 && attendees.at(-1)?.name.trim()) attendees.push(nextBlankAttendee());
  return { ...draft, attendees };
}

async function builtInTemplate() {
  const url = new URL(`${import.meta.env.BASE_URL}erso-template.pdf`, window.location.href);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load the built-in PDF template.');
  return response.arrayBuffer();
}

export default function App() {
  const official = useMemo(() => officialRoster(), []);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [localRoster, setLocalRoster] = useState<RosterEntry[]>([]);
  const [templateFile, setTemplateFile] = useState<StoredFile>();
  const [signatureFile, setSignatureFile] = useState<StoredFile>();
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('');
  const [actionError, setActionError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const draftImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getProfile(),
      listDrafts(),
      listContacts(),
      getSetting<StoredFile>('template'),
      getSetting<StoredFile>('signature'),
    ]).then(([savedProfile, savedDrafts, contacts, template, signature]) => {
      if (!active) return;
      setProfileState(savedProfile ?? null);
      setDrafts(savedDrafts);
      setLocalRoster(contacts);
      setTemplateFile(template);
      setSignatureFile(signature);
      if (savedProfile) {
        setDraft(prepareDraft(createDraft(savedProfile), savedProfile));
      } else {
        setProfileOpen(true);
      }
      setLoading(false);
    }).catch((error: Error) => {
      setActionError(`Could not open browser storage: ${error.message}`);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const roster = useMemo(() => [...official, ...localRoster], [official, localRoster]);
  const attendees = useMemo(() => draft ? countedAttendees(draft) : [], [draft]);
  const perPerson = useMemo(() => draft ? costPerPerson(draft) : null, [draft]);
  const errors = useMemo(() => draft && profile ? validationErrors(draft, profile) : [], [draft, profile]);
  const warnings = useMemo(() => draft ? policyWarnings(draft) : [], [draft]);
  const locationHistory = useMemo(() => [...new Set(drafts.map((item) => item.location.trim()).filter(Boolean))], [drafts]);

  function update(patch: Partial<Draft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function updateAttendee(index: number, patch: Partial<Draft['attendees'][number]>) {
    setDraft((current) => {
      if (!current) return current;
      const next = current.attendees.map((attendee, attendeeIndex) => attendeeIndex === index ? { ...attendee, ...patch } : attendee);
      if (index === next.length - 1 && (patch.name ?? next[index].name).trim() && next.length < 20) next.push(nextBlankAttendee());
      return { ...current, attendees: next };
    });
  }

  function removeAttendee(index: number) {
    setDraft((current) => {
      if (!current || index === 0) return current;
      const next = current.attendees.filter((_attendee, attendeeIndex) => attendeeIndex !== index);
      if (next.length < 20 && next.at(-1)?.name.trim()) next.push(nextBlankAttendee());
      return { ...current, attendees: next };
    });
  }

  async function rememberLocalAttendees() {
    const officialNames = new Set(official.map((entry) => normalizeName(entry.name)));
    const existing = new Map(localRoster.map((entry) => [normalizeName(entry.name), entry]));
    const additions: RosterEntry[] = [];
    for (const attendee of attendees.slice(1)) {
      const key = normalizeName(attendee.name);
      if (!key || officialNames.has(key) || !attendee.affiliation.trim()) continue;
      const prior = existing.get(key);
      const contact = prior
        ? { ...prior, name: attendee.name.trim(), affiliation: attendee.affiliation.trim(), lastUsedAt: new Date().toISOString() }
        : localContact(attendee.name, attendee.affiliation);
      await saveContact(contact);
      additions.push(contact);
      existing.set(key, contact);
    }
    if (additions.length) setLocalRoster(await listContacts());
  }

  async function saveNow() {
    if (!draft) return;
    try {
      setSaveState('Saving…');
      const saved = await saveDraft(draft);
      await rememberLocalAttendees();
      setDraft(saved);
      setDrafts((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setSaveState('Draft saved in this browser.');
    } catch (error) {
      setSaveState(`Save failed: ${(error as Error).message}`);
    }
  }

  async function reviewPdf() {
    if (!draft || !profile) return;
    setShowErrors(true);
    if (errors.length) {
      document.getElementById('validation-summary')?.focus();
      return;
    }
    try {
      setGenerating(true);
      setActionError('');
      await rememberLocalAttendees();
      const templateBytes = templateFile?.bytes ?? await builtInTemplate();
      const { generatePdf } = await import('./lib/pdf');
      const bytes = await generatePdf(templateBytes, draft, profile, {
        signatureBytes: signatureFile ? new Uint8Array(signatureFile.bytes) : undefined,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })));
    } catch (error) {
      setActionError(`PDF generation failed: ${(error as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function savePayee(next: Profile) {
    await saveProfile(next);
    setProfileState(next);
    setDraft((current) => current ? prepareDraft(current, next) : createDraft(next));
    setProfileOpen(false);
  }

  function newDraft() {
    if (!profile) return;
    setDraft(createDraft(profile));
    setShowErrors(false);
    setDraftsOpen(false);
  }

  function openDraft(selected: Draft) {
    if (!profile) return;
    setDraft(prepareDraft(selected, profile));
    setDraftsOpen(false);
  }

  async function duplicateDraft(source: Draft) {
    if (!profile) return;
    const now = new Date().toISOString();
    const copy = prepareDraft({ ...source, id: crypto.randomUUID(), draftName: `Copy of ${source.draftName}`, createdAt: now, updatedAt: now }, profile);
    const saved = await saveDraft(copy);
    setDrafts((items) => [saved, ...items]);
  }

  async function removeDraft(source: Draft) {
    if (!window.confirm(`Delete “${source.draftName}”?`)) return;
    await deleteDraft(source.id);
    const remaining = drafts.filter((item) => item.id !== source.id);
    setDrafts(remaining);
    if (source.id === draft?.id && profile) setDraft(prepareDraft(remaining[0] ?? createDraft(profile), profile));
  }

  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    try {
      const imported = DraftSchema.parse(JSON.parse(await file.text()));
      const now = new Date().toISOString();
      const next = prepareDraft({ ...imported, id: crypto.randomUUID(), draftName: `Imported: ${imported.draftName}`, createdAt: now, updatedAt: now }, profile);
      setDraft(next);
      setActionError('');
    } catch (error) {
      setActionError(`Could not import draft: ${(error as Error).message}`);
    } finally {
      event.target.value = '';
    }
  }

  async function deleteEverything() {
    if (!window.confirm('Delete the profile, drafts, contacts, and local files stored by this site in this browser?')) return;
    await clearLocalData();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setProfileState(null);
    setDraft(null);
    setDrafts([]);
    setLocalRoster([]);
    setTemplateFile(undefined);
    setSignatureFile(undefined);
    setPreviewUrl('');
    setProfileOpen(true);
  }

  if (loading) return <main><h1>ERSO entertainment reimbursement</h1><p role="status">Opening browser storage…</p></main>;

  return (
    <>
      <main>
        <header className="page-header">
          <div><h1>ERSO entertainment reimbursement</h1><p>Fill, review, and download the form. Data stays in this browser.</p></div>
          <nav aria-label="Utilities" className="actions">
            <button type="button" onClick={() => setProfileOpen(true)}>Profile and files</button>
            <button type="button" onClick={() => setRosterOpen(true)}>Roster</button>
            <button type="button" onClick={() => setDraftsOpen(true)}>Drafts</button>
          </nav>
        </header>

        {actionError ? <p role="alert">{actionError}</p> : null}
        {!profile || !draft ? <p>Complete the profile dialog to begin.</p> : (
          <form onSubmit={(event) => event.preventDefault()}>
            <fieldset>
              <legend>Draft</legend>
              <div className="form-grid">
                <label>Draft name<input value={draft.draftName} onChange={(event) => update({ draftName: event.target.value })} /></label>
                <div>
                  <p role="status">{saveState}</p>
                  <div className="actions">
                    <button type="button" onClick={saveNow}>Save now</button>
                    <button type="button" onClick={() => downloadJson(draft, `${draft.eventDate || 'draft'} ERSO reimbursement draft.json`)}>Export draft JSON</button>
                    <button type="button" onClick={() => draftImportRef.current?.click()}>Import draft JSON</button>
                    <input ref={draftImportRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importDraft} />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Payee</legend>
              <p><strong>{profile.name}</strong><br />{profile.address}<br />{profile.email}<br />UCB employee or student ID: {profile.employeeId}</p>
              <p><button type="button" onClick={() => setProfileOpen(true)}>Edit profile</button></p>
            </fieldset>

            <fieldset>
              <legend>Event</legend>
              <div className="form-grid">
                <label className="wide-field">Business purpose<textarea required rows={3} value={draft.businessPurpose} onChange={(event) => update({ businessPurpose: event.target.value })} /></label>
                <label>Location<input required list="location-history" value={draft.location} onChange={(event) => update({ location: event.target.value })} /><datalist id="location-history">{locationHistory.map((location) => <option value={location} key={location} />)}</datalist></label>
                <label>Event date<input required type="date" value={draft.eventDate} onChange={(event) => update({ eventDate: event.target.value })} /></label>
                <label>Total amount<input required type="number" min="0.01" step="0.01" value={draft.totalAmount ?? ''} onChange={(event) => update({ totalAmount: event.target.value ? Number(event.target.value) : null })} /></label>
                <label>Event type<select value={draft.eventType} onChange={(event) => update({ eventType: event.target.value as Draft['eventType'] })}>{EVENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>Meal type<select value={draft.mealType} onChange={(event) => update({ mealType: event.target.value as Draft['mealType'] })}><option value="breakfast">Breakfast — $31 limit</option><option value="lunch">Lunch — $54 limit</option><option value="dinner">Dinner — $94 limit</option><option value="lightrefreshment">Light refreshment — $22 limit</option></select></label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Compliance questions</legend>
              <div className="form-grid">
                <fieldset><legend>Does this request include alcohol?</legend><label className="inline-label"><input type="radio" name="alcohol" checked={draft.alcohol} onChange={() => update({ alcohol: true })} /> Yes</label><label className="inline-label"><input type="radio" name="alcohol" checked={!draft.alcohol} onChange={() => update({ alcohol: false })} /> No</label></fieldset>
                <fieldset><legend>Are related expenses paid by others or payable to a vendor?</legend><label className="inline-label"><input type="radio" name="other-expenses" checked={draft.otherExpenses} onChange={() => update({ otherExpenses: true })} /> Yes</label><label className="inline-label"><input type="radio" name="other-expenses" checked={!draft.otherExpenses} onChange={() => update({ otherExpenses: false, otherExpenseDetails: '' })} /> No</label></fieldset>
              </div>
              {draft.otherExpenses ? <label>Intranet or BearBuy request IDs and total amount<textarea required rows={2} value={draft.otherExpenseDetails} onChange={(event) => update({ otherExpenseDetails: event.target.value })} /></label> : null}
            </fieldset>

            <fieldset>
              <legend>Attendees — {attendees.length} of 20</legend>
              <p>Attendee 1 is fixed as the official host. Type a Lab roster name or enter a free-form attendee. Tab moves through rows; Down/Up selects suggestions.</p>
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Occupation / affiliation</th><th scope="col">Action</th></tr></thead>
                  <tbody>{draft.attendees.map((attendee, index) => (
                    <tr key={attendee.id}>
                      <th scope="row">{index + 1}</th>
                      <td>{index === 0 ? <input aria-label="Attendee 1 name" value={profile.name} readOnly /> : <AttendeeCombobox rowNumber={index + 1} value={attendee.name} entries={roster} onChange={(name) => updateAttendee(index, { name, rosterId: undefined })} onSelect={(entry) => { updateAttendee(index, { name: entry.name, affiliation: entry.affiliation, rosterId: entry.id }); window.requestAnimationFrame(() => document.getElementById(`affiliation-${attendee.id}`)?.focus()); }} />}</td>
                      <td>{index === 0 ? 'Host (must be in attendance)' : <input id={`affiliation-${attendee.id}`} aria-label={`Attendee ${index + 1} occupation or affiliation`} value={attendee.affiliation} onChange={(event) => updateAttendee(index, { affiliation: event.target.value })} />}</td>
                      <td>{index === 0 ? 'Fixed' : <button type="button" onClick={() => removeAttendee(index)}>Remove</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </fieldset>

            <fieldset>
              <legend>Calculated summary</legend>
              <dl className="summary-list"><div><dt>Attendees</dt><dd>{attendees.length}</dd></div><div><dt>Total amount</dt><dd>{draft.totalAmount === null ? '—' : `$${draft.totalAmount.toFixed(2)}`}</dd></div><div><dt>Cost per person</dt><dd>{perPerson === null ? '—' : `$${perPerson.toFixed(2)}`}</dd></div><div><dt>Selected meal limit</dt><dd>${MEAL_LIMITS[draft.mealType].toFixed(2)}</dd></div></dl>
              {warnings.length ? <ul aria-label="Policy warnings">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>No policy warnings.</p>}
            </fieldset>

            {showErrors && errors.length ? <section id="validation-summary" role="alert" tabIndex={-1}><h2>Complete these items before review</h2><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></section> : null}
            <div className="actions"><button type="button" onClick={reviewPdf} disabled={generating}>{generating ? 'Generating PDF…' : 'Review PDF'}</button></div>
          </form>
        )}
      </main>

      <ProfileDialog
        open={profileOpen || !profile}
        profile={profile}
        templateName={templateFile?.name}
        signatureName={signatureFile?.name}
        onSave={savePayee}
        onClose={() => { if (profile) setProfileOpen(false); }}
        onTemplate={async (file) => {
          const stored = await storedFile(file);
          const { extractProfileFromPdf } = await import('./lib/pdf');
          const extracted = await extractProfileFromPdf(stored.bytes);
          await setSetting('template', stored);
          await deleteSetting('signature');
          setTemplateFile(stored);
          setSignatureFile(undefined);
          return extracted;
        }}
        onClearTemplate={async () => { await deleteSetting('template'); setTemplateFile(undefined); }}
        onSignature={async (file) => { const stored = await storedFile(file); await setSetting('signature', stored); setSignatureFile(stored); }}
        onClearSignature={async () => { await deleteSetting('signature'); setSignatureFile(undefined); }}
        onDeleteAll={deleteEverything}
      />
      <DraftsDialog open={draftsOpen} drafts={drafts} currentId={draft?.id} onClose={() => setDraftsOpen(false)} onNew={newDraft} onSelect={openDraft} onDuplicate={duplicateDraft} onDelete={removeDraft} />
      <RosterDialog open={rosterOpen} official={official} local={localRoster} onClose={() => setRosterOpen(false)} onAdd={async (name, affiliation) => { await saveContact(localContact(name, affiliation)); setLocalRoster(await listContacts()); }} onDelete={async (entry) => { if (!window.confirm(`Delete ${entry.name} from local contacts?`)) return; await deleteContact(entry.id); setLocalRoster(await listContacts()); }} />
      {previewUrl && draft ? <PdfPreview url={previewUrl} filename={downloadFileName(draft)} onClose={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }} /> : null}
    </>
  );
}
