import { BadRequestException } from '@nestjs/common';
import { normalizeFeedingCell } from './feeding-payment';

const prices = { breakfast: 15000, lunch: 20000 };

describe('normalizeFeedingCell', () => {
  const dated = { paid_on: '2026-10-11', expires_on: '2026-11-11' };

  it('loads the breakfast price for a full B tick', () => {
    expect(normalizeFeedingCell('1B', { ...dated, months: 1, kind: 'full' }, prices)).toEqual({
      paid_on: '2026-10-11',
      months: 1,
      expires_on: '2026-11-11',
      kind: 'full',
      unit_price: 15000,
      full_amount: 15000,
      amount_paid: 15000,
      balance: 0,
    });
  });

  it('loads the lunch price times the selected months', () => {
    const cell = normalizeFeedingCell('2L', { ...dated, months: 2, kind: 'full' }, prices);
    expect(cell.unit_price).toBe(20000);
    expect(cell.full_amount).toBe(40000);
    expect(cell.amount_paid).toBe(40000);
    expect(cell.balance).toBe(0);
  });

  it('records a partial payment and the amount left', () => {
    const cell = normalizeFeedingCell('1B', { ...dated, months: 1, kind: 'partial', amount_paid: 6000 }, prices);
    expect(cell.kind).toBe('partial');
    expect(cell.amount_paid).toBe(6000);
    expect(cell.balance).toBe(9000);
  });

  it('rejects an amount above the full payment', () => {
    expect(() =>
      normalizeFeedingCell('1L', { ...dated, months: 1, kind: 'partial', amount_paid: 20001 }, prices),
    ).toThrow(BadRequestException);
  });

  it('treats a partial that covers the full amount as full', () => {
    const cell = normalizeFeedingCell('1L', { ...dated, months: 1, kind: 'partial', amount_paid: 20000 }, prices);
    expect(cell.kind).toBe('full');
    expect(cell.balance).toBe(0);
  });

  it('refuses a new tick when that meal has no price', () => {
    expect(() =>
      normalizeFeedingCell('1B', { ...dated, months: 1, kind: 'full' }, { breakfast: 0, lunch: 20000 }),
    ).toThrow(/breakfast price/);
  });

  it('keeps a recorded snapshot when the school price later changes', () => {
    const cell = normalizeFeedingCell(
      '1B',
      { ...dated, months: 1, kind: 'partial', amount_paid: 4000, unit_price: 10000, full_amount: 10000 },
      prices,
    );
    expect(cell.full_amount).toBe(10000);
    expect(cell.balance).toBe(6000);
  });

  it('leaves older ticks that have no payment kind unchanged', () => {
    expect(normalizeFeedingCell('3B', { ...dated, months: 1 }, prices)).toEqual({
      paid_on: '2026-10-11',
      months: 1,
      expires_on: '2026-11-11',
    });
  });
});
