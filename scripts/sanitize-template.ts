import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { sanitizeTemplate } from '../src/lib/pdf';

const run = promisify(execFile);
const sourcePath = fileURLToPath(new URL('../resources/2026-MM-DD ERSO ENT Reimbursement Payment form.pdf', import.meta.url));
const outputPath = fileURLToPath(new URL('../public/erso-template.pdf', import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'erso-public-template-'));

try {
  const intermediatePath = join(temporaryRoot, 'covered.pdf');
  const imagePrefix = join(temporaryRoot, 'page');
  await writeFile(intermediatePath, await sanitizeTemplate(await readFile(sourcePath)));
  await run('pdftoppm', ['-f', '1', '-singlefile', '-png', '-r', '220', intermediatePath, imagePrefix]);

  // A raster-only page guarantees that deleted form values and signature
  // appearance streams cannot survive as recoverable objects in the public PDF.
  const clean = await PDFDocument.create();
  const page = clean.addPage([612, 792]);
  const image = await clean.embedPng(await readFile(`${imagePrefix}.png`));
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  clean.setTitle('ERSO Entertainment Reimbursement Payment Request');
  clean.setSubject('Sanitized blank template');
  await writeFile(outputPath, await clean.save({ useObjectStreams: false, addDefaultPage: false }));
  console.log(`Wrote sanitized public template: ${outputPath}`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
