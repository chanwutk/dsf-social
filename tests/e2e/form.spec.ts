import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function personalizedBlankPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();
  const values = new Map([
    ['1', 'Test Payee'],
    ['2', '123 Test Street, Berkeley, CA 94704'],
    ['3', 'test-payee@example.com'],
    ['UCBEID.SID', '1234567890'],
  ]);
  let y = 700;
  for (const [name, value] of values) {
    const field = form.createTextField(name);
    field.setText(value);
    field.addToPage(page, { x: 100, y, width: 250, height: 18 });
    y -= 24;
  }
  return Buffer.from(await pdf.save());
}

test('sets up a private browser profile and uses keyboard attendee suggestions', async ({ page }) => {
  await page.goto('/');
  const setup = page.getByRole('dialog', { name: 'Set up this browser' });
  await expect(setup).toBeVisible();
  await setup.getByLabel('Personalized blank PDF').setInputFiles({
    name: 'personalized-blank.pdf',
    mimeType: 'application/pdf',
    buffer: await personalizedBlankPdf(),
  });
  await expect(setup.getByLabel('Name')).toHaveValue('Test Payee');
  await expect(setup.getByLabel('Address')).toHaveValue('123 Test Street, Berkeley, CA 94704');
  await expect(setup.getByLabel('Email')).toHaveValue('test-payee@example.com');
  await expect(setup.getByLabel('UCB employee or student ID')).toHaveValue('1234567890');
  await setup.getByRole('button', { name: 'Save profile' }).click();

  await expect(page.getByText('Test Payee', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Business purpose')).toHaveValue('DSF Social: ');
  await expect(page.getByLabel('Meal type')).toHaveValue('dinner');
  await expect(page.getByLabel('Attendee 1 name')).toHaveValue('Test Payee');
  await page.getByLabel('Attendee 2 name').fill('Par');
  await expect(page.getByRole('option', { name: /Parth Asawa/ })).toBeVisible();
  await page.getByLabel('Attendee 2 name').press('ArrowDown');
  await page.getByLabel('Attendee 2 name').press('Enter');
  await expect(page.getByLabel('Attendee 2 occupation or affiliation')).toHaveValue('EECS PhD Student');

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Set up this browser' })).not.toBeVisible();
  await expect(page.getByLabel('Attendee 1 name')).toHaveValue('Test Payee');
});
