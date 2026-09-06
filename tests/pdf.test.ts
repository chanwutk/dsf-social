import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractProfileFromPdf, generatePdf } from '../src/lib/pdf';
import { completedDraft, profile } from './fixtures';

const templatePath = fileURLToPath(new URL('../public/erso-template.pdf', import.meta.url));

describe('PDF generation', () => {
  it('extracts a profile from a personalized blank PDF', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([612, 792]);
    const form = source.getForm();
    const values = new Map([
      ['1', profile.name],
      ['2', profile.address],
      ['3', profile.email],
      ['UCBEID.SID', profile.employeeId],
    ]);
    let y = 700;
    for (const [name, value] of values) {
      const field = form.createTextField(name);
      field.setText(value);
      field.addToPage(page, { x: 100, y, width: 250, height: 18 });
      y -= 24;
    }
    await expect(extractProfileFromPdf(await source.save())).resolves.toEqual(profile);
  });

  it('creates a one-page browser-generated PDF from the sanitized template', async () => {
    const bytes = await generatePdf(await readFile(templatePath), completedDraft, profile, {
      hostDate: new Date('2026-05-21T12:00:00'),
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(300_000);
  });

  it('creates a submission-ready PDF with no interactive fields', async () => {
    const bytes = await generatePdf(await readFile(templatePath), completedDraft, profile);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.catalog.get(PDFName.of('AcroForm'))).toBeUndefined();
    expect(pdf.getForm().getFields()).toHaveLength(0);
  });
});
