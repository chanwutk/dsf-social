import { describe, expect, it } from 'vitest';
import { costPerPerson, policyWarnings, validationErrors } from '../src/lib/form-logic';
import { completedDraft, profile } from './fixtures';

describe('form calculations and validation', () => {
  it('matches the completed example calculation', () => {
    expect(costPerPerson(completedDraft)).toBeCloseTo(30.05875);
    expect(validationErrors(completedDraft, profile)).toEqual([]);
  });

  it('warns without blocking old and over-limit events', () => {
    const draft = { ...completedDraft, totalAmount: 800 };
    expect(policyWarnings(draft, new Date('2026-08-27T12:00:00'))).toEqual([
      'Cost per person ($100.00) exceeds the dinner limit of $94.00.',
      'The event was 99 days ago; the form states a 45-day submission window.',
    ]);
  });
});
