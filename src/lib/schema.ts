import { z } from 'zod';

export const ProfileSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  email: z.string().trim().email(),
  employeeId: z.string().trim().min(1),
});

export type Profile = z.infer<typeof ProfileSchema>;

// Roster entries are constructed internally; only imported profiles and drafts need runtime validation.
export type RosterEntry = {
  id: string;
  name: string;
  role: string;
  affiliation: string;
  source: 'official' | 'local';
  lastUsedAt?: string;
};

export const AttendeeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  affiliation: z.string(),
  rosterId: z.string().optional(),
});

export type Attendee = z.infer<typeof AttendeeSchema>;

export const EventTypeSchema = z.enum([
  '57233',
  '57002',
  '57004',
  '57005',
  '57006',
  '57006a',
  '57007',
]);

export const MealTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'lightrefreshment',
]);

export const DraftSchema = z.object({
  id: z.string().min(1),
  draftName: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  businessPurpose: z.string(),
  location: z.string(),
  eventDate: z.string(),
  totalAmount: z.number().nullable(),
  eventType: EventTypeSchema,
  mealType: MealTypeSchema,
  alcohol: z.boolean(),
  otherExpenses: z.boolean(),
  otherExpenseDetails: z.string(),
  attendees: z.array(AttendeeSchema).min(1).max(20),
});

export type Draft = z.infer<typeof DraftSchema>;
