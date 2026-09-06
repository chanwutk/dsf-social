import type { Draft, Profile } from '../src/lib/schema';

export const profile: Profile = {
  name: 'Test Payee',
  address: '123 Test Street, Berkeley, CA 94704',
  email: 'test-payee@example.com',
  employeeId: '1234567890',
};

export const completedDraft: Draft = {
  id: '00000000-0000-4000-8000-000000000001',
  draftName: 'May 20 DSF social',
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
  businessPurpose: 'DSF Social: Discussion on hiring process for DB faculty job.',
  location: 'Zhangliang Malatang',
  eventDate: '2026-05-20',
  totalAmount: 240.47,
  eventType: '57004',
  mealType: 'dinner',
  alcohol: false,
  otherExpenses: false,
  otherExpenseDetails: '',
  attendees: [
    ['Test Payee', 'Host (must be in attendance)'],
    ['Avery Example', 'EECS PhD Student'],
    ['Blair Example', 'EECS PhD Student'],
    ['Casey Example', 'EECS PhD Student'],
    ['Devon Example', 'EECS PhD Student'],
    ['Ellis Example', 'EECS PhD Student'],
    ['Frankie Example', 'EECS PhD Student'],
    ['Gray Example', 'Visiting Scholar'],
  ].map(([name, affiliation], index) => ({ id: `attendee-${index + 1}`, name, affiliation })),
};
