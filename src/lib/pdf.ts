import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  PDFTextField,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { ProfileSchema } from './schema';
import type { Draft, Profile } from './schema';
import { countedAttendees, costPerPerson, formatEventDate, formatHostDate } from './form-logic';

const expectedTextFields = [
  '1', '2', '3', 'UCBEID.SID', 'EventBusinessPurpose', 'EVENT LOCATION', 'EVENT DATE',
  'NumberAttendees', 'TotalAmount', 'Cost Per Person auto calculateRow1', 'Name1', 'Name20',
  'IntranetorBearBuyRequest#',
];

type ButtonWidget = {
  fieldName: string;
  onValue: string;
  ref: PDFRef;
  rect: { x: number; y: number; width: number; height: number };
};

type Rect = { x: number; y: number; width: number; height: number };

const flatTextRects: Record<string, Rect> = {
  name: { x: 120.72, y: 680.24, width: 173.04, height: 15.48 },
  address: { x: 120.72, y: 661.28, width: 173.04, height: 15.48 },
  email: { x: 120.72, y: 642.32, width: 173.04, height: 15.48 },
  employeeId: { x: 471.82, y: 682.40, width: 107.45, height: 18.07 },
  purpose: { x: 122.04, y: 537.36, width: 459.36, height: 29.76 },
  location: { x: 20.52, y: 493.20, width: 114.24, height: 19.44 },
  eventDate: { x: 136.68, y: 493.20, width: 84.48, height: 19.44 },
  attendeeCount: { x: 223.08, y: 493.20, width: 69.60, height: 19.44 },
  total: { x: 294.60, y: 493.20, width: 84.48, height: 19.44 },
  perPerson: { x: 381.96, y: 493.20, width: 87.36, height: 19.44 },
  otherDetails: { x: 263.13, y: 419.16, width: 318.87, height: 22 },
  hostName: { x: 440.01, y: 144.89, width: 142.88, height: 18.85 },
};

const flatButtons: Array<{ fieldName: string; value: string; rect: Rect }> = [
  { fieldName: 'paymentrequest', value: 'vendor', rect: { x: 147.76, y: 702.73, width: 9.36, height: 9.36 } },
  { fieldName: 'paymentrequest', value: 'reimbursement', rect: { x: 306.98, y: 702.56, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57233', rect: { x: 121.78, y: 614.36, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57002', rect: { x: 121.78, y: 603.03, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57004', rect: { x: 121.78, y: 591.69, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57005', rect: { x: 121.78, y: 580.36, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57006', rect: { x: 342.25, y: 614.49, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57006a', rect: { x: 342.46, y: 603.15, width: 9.36, height: 9.36 } },
  { fieldName: 'eventtype', value: '57007', rect: { x: 342.36, y: 591.82, width: 9.36, height: 9.36 } },
  { fieldName: 'alcohol', value: 'yes', rect: { x: 260.27, y: 465.13, width: 9.36, height: 9.36 } },
  { fieldName: 'alcohol', value: 'no', rect: { x: 306.91, y: 464.47, width: 9.36, height: 9.36 } },
  { fieldName: 'otherexpenses', value: 'yes', rect: { x: 260.27, y: 447.41, width: 9.36, height: 9.36 } },
  { fieldName: 'otherexpenses', value: 'no', rect: { x: 306.96, y: 447.41, width: 9.36, height: 9.36 } },
  { fieldName: 'meal', value: 'breakfast', rect: { x: 471, y: 498.54, width: 9.36, height: 9.36 } },
  { fieldName: 'meal', value: 'lunch', rect: { x: 471, y: 481.25, width: 9.36, height: 9.36 } },
  { fieldName: 'meal', value: 'dinner', rect: { x: 471, y: 465.25, width: 9.36, height: 9.36 } },
  { fieldName: 'meal', value: 'lightrefreshment', rect: { x: 471, y: 446.25, width: 9.36, height: 9.36 } },
];

function fieldName(dict: PDFDict) {
  return dict.lookupMaybe(PDFName.of('T'), PDFString, PDFHexString)?.decodeText();
}

function textFieldNames() {
  const allowed = new Set(expectedTextFields);
  for (let index = 1; index <= 20; index += 1) allowed.add(`Name${index}`);
  for (let index = 2; index <= 20; index += 1) allowed.add(`OccupationAffiliation${index}`);
  return allowed;
}

function repairFormTree(pdf: PDFDocument) {
  // The supplied Quartz PDF has a stale AcroForm tree. Rebuild it from the
  // visible page widgets so pdf-lib updates and flattens the fields users see.
  const allowed = textFieldNames();
  const roots: PDFRef[] = [];
  const rootKeys = new Set<string>();
  const grouped = new Map<string, { parentRef: PDFRef; parent: PDFDict; kids: PDFRef[] }>();

  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotationRef = annotations.get(index);
      if (!(annotationRef instanceof PDFRef)) continue;
      const annotation = pdf.context.lookup(annotationRef, PDFDict);
      if (annotation.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText() !== 'Widget') continue;
      const parentRef = annotation.get(PDFName.of('Parent'));
      if (parentRef instanceof PDFRef) {
        const parent = pdf.context.lookup(parentRef, PDFDict);
        const name = fieldName(parent);
        if (!name || !allowed.has(name)) continue;
        const key = parentRef.toString();
        const group = grouped.get(key) ?? { parentRef, parent, kids: [] };
        group.kids.push(annotationRef);
        grouped.set(key, group);
      } else {
        const name = fieldName(annotation);
        if (!name || !allowed.has(name)) continue;
        const key = annotationRef.toString();
        if (!rootKeys.has(key)) {
          rootKeys.add(key);
          roots.push(annotationRef);
        }
      }
    }
  }

  for (const { parentRef, parent, kids } of grouped.values()) {
    parent.set(PDFName.of('Kids'), pdf.context.obj(kids));
    const key = parentRef.toString();
    if (!rootKeys.has(key)) {
      rootKeys.add(key);
      roots.push(parentRef);
    }
  }

  let acroForm = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (!acroForm) {
    acroForm = pdf.context.obj({ Fields: roots });
    pdf.catalog.set(PDFName.of('AcroForm'), acroForm);
  } else {
    acroForm.set(PDFName.of('Fields'), pdf.context.obj(roots));
  }
}

function collectButtonWidgets(pdf: PDFDocument) {
  const widgets: ButtonWidget[] = [];
  const removableAnnotationRefs = new Set<string>();
  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = 0; index < annotations.size(); index += 1) {
      const ref = annotations.get(index);
      if (!(ref instanceof PDFRef)) continue;
      const annotation = pdf.context.lookup(ref, PDFDict);
      const subtype = annotation.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText();
      if (subtype === 'FreeText') {
        const contents = annotation.lookupMaybe(PDFName.of('Contents'), PDFString, PDFHexString)?.decodeText();
        if (contents?.trim().toLocaleLowerCase() === 'x') removableAnnotationRefs.add(ref.toString());
        continue;
      }
      if (subtype !== 'Widget') continue;
      const parentRef = annotation.get(PDFName.of('Parent'));
      const field = parentRef instanceof PDFRef ? pdf.context.lookup(parentRef, PDFDict) : annotation;
      if (field.lookupMaybe(PDFName.of('FT'), PDFName)?.decodeText() !== 'Btn') continue;
      const name = fieldName(field);
      if (!name) continue;
      const normalAppearance = annotation.lookupMaybe(PDFName.of('AP'), PDFDict)?.lookupMaybe(PDFName.of('N'), PDFDict);
      const onValue = normalAppearance?.keys().find((key) => key.decodeText() !== 'Off')?.decodeText() ?? name;
      const rect = annotation.lookup(PDFName.of('Rect'), PDFArray);
      const left = rect.lookup(0, PDFNumber).asNumber();
      const bottom = rect.lookup(1, PDFNumber).asNumber();
      const right = rect.lookup(2, PDFNumber).asNumber();
      const top = rect.lookup(3, PDFNumber).asNumber();
      widgets.push({ fieldName: name, onValue, ref, rect: { x: left, y: bottom, width: right - left, height: top - bottom } });
      removableAnnotationRefs.add(ref.toString());
    }
  }
  return { widgets, removableAnnotationRefs };
}

function removePageAnnotations(pdf: PDFDocument, refs: Set<string>) {
  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = annotations.size() - 1; index >= 0; index -= 1) {
      const ref = annotations.get(index);
      if (ref instanceof PDFRef && refs.has(ref.toString())) annotations.remove(index);
    }
  }
}

function removeDanglingPageAnnotations(pdf: PDFDocument) {
  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = annotations.size() - 1; index >= 0; index -= 1) {
      const ref = annotations.get(index);
      if (ref instanceof PDFRef && !pdf.context.lookupMaybe(ref, PDFDict)) annotations.remove(index);
    }
  }
}

function drawCheckbox(page: ReturnType<PDFDocument['getPages']>[number], widget: { rect: Rect }) {
  const inset = Math.max(1, Math.min(widget.rect.width, widget.rect.height) * 0.18);
  const x1 = widget.rect.x + inset;
  const x2 = widget.rect.x + widget.rect.width - inset;
  const y1 = widget.rect.y + inset;
  const y2 = widget.rect.y + widget.rect.height - inset;
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.2 });
  page.drawLine({ start: { x: x1, y: y2 }, end: { x: x2, y: y1 }, thickness: 1.2 });
}

function drawCheckboxBorder(page: ReturnType<PDFDocument['getPages']>[number], widget: { rect: Rect }) {
  page.drawRectangle({
    x: widget.rect.x,
    y: widget.rect.y,
    width: widget.rect.width,
    height: widget.rect.height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.7,
  });
}

async function drawSignature(pdf: PDFDocument, bytes: Uint8Array) {
  let image;
  try {
    image = await pdf.embedPng(bytes);
  } catch {
    image = await pdf.embedJpg(bytes);
  }
  const maxWidth = 155;
  const maxHeight = 22;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  pdf.getPages()[0].drawImage(image, {
    x: 120 + (maxWidth - width) / 2,
    y: 146 + (maxHeight - height) / 2,
    width,
    height,
  });
}

function hasVisibleTemplateFields(pdf: PDFDocument) {
  const wanted = textFieldNames();
  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = 0; index < annotations.size(); index += 1) {
      const ref = annotations.get(index);
      if (!(ref instanceof PDFRef)) continue;
      const annotation = pdf.context.lookup(ref, PDFDict);
      const parentRef = annotation.get(PDFName.of('Parent'));
      const field = parentRef instanceof PDFRef ? pdf.context.lookup(parentRef, PDFDict) : annotation;
      const name = fieldName(field);
      if (name && wanted.has(name)) return true;
    }
  }
  return false;
}

function drawFittedText(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  rect: Rect,
  options: { size?: number; align?: 'left' | 'center' } = {},
) {
  if (!text) return;
  let size = options.size ?? 10;
  const availableWidth = rect.width - 4;
  while (size > 5 && font.widthOfTextAtSize(text, size) > availableWidth) size -= 0.25;
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = options.align === 'center' ? rect.x + (rect.width - textWidth) / 2 : rect.x + 2;
  const y = rect.y + Math.max(1, (rect.height - size) / 2 + 1);
  page.drawText(text, { x, y, size, font });
}

function drawWrappedText(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  rect: Rect,
  size = 8,
) {
  if (!text) return;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const candidate = lines.length ? `${lines.at(-1)} ${word}` : word;
    if (lines.length && font.widthOfTextAtSize(candidate, size) > rect.width - 4) lines.push(word);
    else if (lines.length) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  const maxLines = Math.max(1, Math.floor((rect.height - 2) / (size + 1)));
  for (const [index, line] of lines.slice(0, maxLines).entries()) {
    page.drawText(line, { x: rect.x + 2, y: rect.y + rect.height - size - 2 - index * (size + 1), size, font });
  }
}

async function generateOnFlatTemplate(
  pdf: PDFDocument,
  draft: Draft,
  profile: Profile,
  options: { hostDate?: Date; signatureBytes?: Uint8Array },
) {
  const page = pdf.getPages()[0];
  if (!page || pdf.getPageCount() !== 1) throw new Error('Unsupported PDF template; expected one page.');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const attendees = countedAttendees(draft);
  const perPerson = costPerPerson(draft);

  drawFittedText(page, font, profile.name, flatTextRects.name);
  drawFittedText(page, font, profile.address, flatTextRects.address, { size: 9 });
  drawFittedText(page, font, profile.email, flatTextRects.email);
  drawFittedText(page, font, profile.employeeId, flatTextRects.employeeId, { align: 'center' });
  drawWrappedText(page, font, draft.businessPurpose.trim(), flatTextRects.purpose, 9);
  drawFittedText(page, font, draft.location.trim(), flatTextRects.location, { align: 'center' });
  drawFittedText(page, font, formatEventDate(draft.eventDate), flatTextRects.eventDate, { align: 'center' });
  drawFittedText(page, font, String(attendees.length), flatTextRects.attendeeCount, { align: 'center' });
  drawFittedText(page, font, draft.totalAmount?.toFixed(2) ?? '', flatTextRects.total, { align: 'center' });
  drawFittedText(page, font, perPerson === null ? '' : perPerson.toFixed(2), flatTextRects.perPerson, { align: 'center' });
  if (draft.otherExpenses) drawWrappedText(page, font, draft.otherExpenseDetails.trim(), flatTextRects.otherDetails, 8);
  drawFittedText(page, font, profile.name, flatTextRects.hostName, { align: 'center' });

  for (let index = 1; index <= 20; index += 1) {
    const left = index <= 10;
    const row = left ? index : index - 10;
    const y = 345 - (row - 1) * 16.2;
    const nameRect = { x: left ? 35.28 : 324.24, y, width: left ? 141.36 : 129.36, height: 14.4 };
    const affiliationRect = { x: left ? 178.32 : 455.28, y, width: left ? 129.36 : 126.48, height: 14.4 };
    const attendee = attendees[index - 1];
    if (!attendee) continue;
    drawFittedText(page, font, attendee.name.trim(), nameRect, { size: 8 });
    if (index >= 2) drawFittedText(page, font, attendee.affiliation.trim(), affiliationRect, { size: 8 });
  }

  const selected = {
    paymentrequest: 'reimbursement',
    eventtype: draft.eventType,
    alcohol: draft.alcohol ? 'yes' : 'no',
    otherexpenses: draft.otherExpenses ? 'yes' : 'no',
    meal: draft.mealType,
  };
  for (const button of flatButtons) {
    if (selected[button.fieldName as keyof typeof selected] === button.value) drawCheckbox(page, button);
  }

  page.drawText(formatHostDate(options.hostDate), { x: 309, y: 150, size: 7, font });
  if (options.signatureBytes?.byteLength) await drawSignature(pdf, options.signatureBytes);
  return pdf.save({ useObjectStreams: false, addDefaultPage: false });
}

export async function generatePdf(
  templateBytes: Uint8Array | ArrayBuffer,
  draft: Draft,
  profile: Profile,
  options: { flatten?: boolean; hostDate?: Date; signatureBytes?: Uint8Array } = {},
) {
  const pdf = await PDFDocument.load(templateBytes);
  if (!hasVisibleTemplateFields(pdf)) return generateOnFlatTemplate(pdf, draft, profile, options);
  const buttonData = collectButtonWidgets(pdf);
  repairFormTree(pdf);
  const form = pdf.getForm();
  const fields = new Set(form.getFields().map((field) => field.getName()));
  const missing = expectedTextFields.filter((name) => !fields.has(name));
  if (missing.length) throw new Error(`Unsupported PDF template; missing fields: ${missing.join(', ')}`);

  const setText = (name: string, value: string) => form.getTextField(name).setText(value);
  setText('1', profile.name);
  setText('2', profile.address);
  setText('3', profile.email);
  setText('UCBEID.SID', profile.employeeId);
  setText('EventBusinessPurpose', draft.businessPurpose.trim());
  setText('EVENT LOCATION', draft.location.trim());
  setText('EVENT DATE', formatEventDate(draft.eventDate));

  const attendees = countedAttendees(draft);
  setText('NumberAttendees', String(attendees.length));
  setText('TotalAmount', draft.totalAmount?.toFixed(2) ?? '');
  const perPerson = costPerPerson(draft);
  setText('Cost Per Person auto calculateRow1', perPerson === null ? '' : perPerson.toFixed(2));
  setText('IntranetorBearBuyRequest#', draft.otherExpenses ? draft.otherExpenseDetails.trim() : '');

  for (let index = 1; index <= 20; index += 1) {
    setText(`Name${index}`, attendees[index - 1]?.name.trim() ?? '');
    if (index >= 2) setText(`OccupationAffiliation${index}`, attendees[index - 1]?.affiliation.trim() ?? '');
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);
  if (options.flatten !== false) {
    form.flatten({ updateFieldAppearances: false });
    pdf.catalog.delete(PDFName.of('AcroForm'));
  }

  removePageAnnotations(pdf, buttonData.removableAnnotationRefs);
  removeDanglingPageAnnotations(pdf);

  const page = pdf.getPages()[0];
  const selectedButtons = new Map([
    ['paymentrequest', 'reimbursement request'],
    ['eventtype', draft.eventType],
    ['alcohol', draft.alcohol ? 'Yes' : 'No'],
    ['otherexpenses', draft.otherExpenses ? 'Yes' : 'No'],
  ]);
  for (const widget of buttonData.widgets) {
    drawCheckboxBorder(page, widget);
    const selectedValue = selectedButtons.get(widget.fieldName);
    if (selectedValue === widget.onValue || widget.fieldName === draft.mealType) drawCheckbox(page, widget);
  }
  page.drawText(formatHostDate(options.hostDate), { x: 309, y: 150, size: 7, font });
  if (options.signatureBytes?.byteLength) await drawSignature(pdf, options.signatureBytes);

  return pdf.save({ useObjectStreams: false, addDefaultPage: false });
}

export async function extractProfileFromPdf(templateBytes: Uint8Array | ArrayBuffer) {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(templateBytes);
  } catch {
    throw new Error('The selected file is not a readable PDF.');
  }
  if (pdf.getPageCount() !== 1) throw new Error('Expected the one-page ERSO reimbursement form.');

  const form = pdf.getForm();
  function value(field: string, label: string) {
    try {
      const text = form.getTextField(field).getText()?.trim() ?? '';
      if (!text) throw new Error();
      return text;
    } catch {
      throw new Error(`The PDF does not contain a filled ${label} field.`);
    }
  }

  return ProfileSchema.parse({
    name: value('1', 'payee name'),
    address: value('2', 'payee address'),
    email: value('3', 'payee email'),
    employeeId: value('UCBEID.SID', 'employee or student ID'),
  });
}

export async function sanitizeTemplate(sourceBytes: Uint8Array | ArrayBuffer) {
  const source = await PDFDocument.load(sourceBytes);
  repairFormTree(source);
  const form = source.getForm();
  const font = await source.embedFont(StandardFonts.Helvetica);
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) field.setText('');
  }
  form.updateFieldAppearances(font);

  const removable = new Set<string>();
  for (const page of source.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = 0; index < annotations.size(); index += 1) {
      const ref = annotations.get(index);
      if (!(ref instanceof PDFRef)) continue;
      const annotation = source.context.lookup(ref, PDFDict);
      const subtype = annotation.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText();
      const parentRef = annotation.get(PDFName.of('Parent'));
      const field = parentRef instanceof PDFRef ? source.context.lookup(parentRef, PDFDict) : annotation;
      const name = fieldName(field);
      const contents = annotation.lookupMaybe(PDFName.of('Contents'), PDFString, PDFHexString)?.decodeText();
      if (name === 'Hosts Signature' || (subtype === 'FreeText' && contents?.trim().toLocaleLowerCase() === 'x')) {
        removable.add(ref.toString());
      }
      if (field.lookupMaybe(PDFName.of('FT'), PDFName)?.decodeText() === 'Btn') {
        annotation.set(PDFName.of('AS'), PDFName.of('Off'));
        field.set(PDFName.of('V'), PDFName.of('Off'));
      }
    }
  }
  removePageAnnotations(source, removable);

  // The personalized source also contains signature strokes in its page
  // content. Cover them before the Node-side sanitizer rasterizes the page.
  const sourcePage = source.getPages()[0];
  sourcePage.drawRectangle({ x: 115, y: 135, width: 165, height: 31, color: rgb(1, 1, 1) });
  sourcePage.drawLine({ start: { x: 116, y: 145 }, end: { x: 279, y: 145 }, thickness: 0.6 });

  // Copy only page-reachable objects into a new document. This drops orphaned
  // field values and signature appearance streams from the personalized source.
  const clean = await PDFDocument.create();
  const [page] = await clean.copyPages(source, [0]);
  clean.addPage(page);
  clean.setTitle('ERSO Entertainment Reimbursement Payment Request');
  clean.setSubject('Sanitized blank template');
  return clean.save({ useObjectStreams: false, addDefaultPage: false });
}
