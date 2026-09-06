import type { Draft, Profile } from './schema';

export const EVENT_TYPES = [
  ['57233', '57233 — University employee on travel status'],
  ['57002', '57002 — Meals provided to students'],
  ['57004', '57004 — Business meeting hospitality, technical'],
  ['57005', '57005 — Business meeting hospitality, non-technical'],
  ['57006', '57006 — Visitors, guests and volunteers'],
  ['57006a', '57006 — Prospective donors, employees and students'],
  ['57007', '57007 — Employee morale (exception)'],
] as const;

export const MEAL_LIMITS = {
  breakfast: 31,
  lunch: 54,
  dinner: 94,
  lightrefreshment: 22,
} as const;

export function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function countedAttendees(draft: Draft) {
  return draft.attendees.filter((attendee) => attendee.name.trim());
}

export function costPerPerson(draft: Draft) {
  const count = countedAttendees(draft).length;
  return count > 0 && draft.totalAmount !== null ? draft.totalAmount / count : null;
}

export function validationErrors(draft: Draft, profile: Profile) {
  const errors: string[] = [];
  if (!profile.name || !profile.address || !profile.email || !profile.employeeId) {
    errors.push('Complete the payee profile.');
  }
  const purpose = draft.businessPurpose.replace(/^DSF Social:\s*/i, '').trim();
  if (!purpose) errors.push('Enter a specific business purpose.');
  if (!draft.location.trim()) errors.push('Enter the event location.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.eventDate)) errors.push('Enter the event date.');
  if (draft.totalAmount === null || !Number.isFinite(draft.totalAmount) || draft.totalAmount <= 0) {
    errors.push('Enter a positive total amount.');
  }
  const attendees = countedAttendees(draft);
  if (attendees.length === 0 || normalizeName(attendees[0]?.name ?? '') !== normalizeName(profile.name)) {
    errors.push('The first attendee must be the payee.');
  }
  const names = attendees.map((attendee) => normalizeName(attendee.name));
  if (new Set(names).size !== names.length) errors.push('Remove duplicate attendees.');
  for (const attendee of attendees.slice(1)) {
    if (!attendee.affiliation.trim()) errors.push(`Enter an affiliation for ${attendee.name}.`);
  }
  if (draft.otherExpenses && !draft.otherExpenseDetails.trim()) {
    errors.push('Enter the related request IDs and total amount.');
  }
  return errors;
}

export function policyWarnings(draft: Draft, today = new Date()) {
  const warnings: string[] = [];
  const perPerson = costPerPerson(draft);
  const limit = MEAL_LIMITS[draft.mealType];
  if (perPerson !== null && perPerson > limit) {
    warnings.push(`Cost per person ($${perPerson.toFixed(2)}) exceeds the ${draft.mealType} limit of $${limit.toFixed(2)}.`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(draft.eventDate)) {
    const event = new Date(`${draft.eventDate}T00:00:00`);
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const age = Math.floor((current.getTime() - event.getTime()) / 86_400_000);
    if (age < 0) warnings.push('The event date is in the future.');
    if (age > 45) warnings.push(`The event was ${age} days ago; the form states a 45-day submission window.`);
  }
  return warnings;
}

export function createDraft(profile: Profile): Draft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    draftName: 'Untitled reimbursement',
    createdAt: now,
    updatedAt: now,
    businessPurpose: 'DSF Social: ',
    location: '',
    eventDate: '',
    totalAmount: null,
    eventType: '57004',
    mealType: 'dinner',
    alcohol: false,
    otherExpenses: false,
    otherExpenseDetails: '',
    attendees: [
      { id: crypto.randomUUID(), name: profile.name, affiliation: 'Host (must be in attendance)' },
      { id: crypto.randomUUID(), name: '', affiliation: '' },
    ],
  };
}

export function downloadFileName(draft: Draft) {
  return `${draft.eventDate || 'YYYY-MM-DD'} ERSO ENT Reimbursement Payment form.pdf`;
}

export function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

export function formatHostDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}
