import { BadRequestException } from '@nestjs/common';
import { normalizeTransportCell } from './transport-payment';

describe('normalizeTransportCell', () => {
  const dated = { paid_on: '2026-10-11', expires_on: '2026-11-11' };
  const zonePrice = 25000;

  it('loads the zone price for a full tick', () => {
    expect(normalizeTransportCell({ ...dated, months: 1, kind: 'full' }, zonePrice)).toEqual({
      paid_on: '2026-10-11',
      months: 1,
      expires_on: '2026-11-11',
      kind: 'full',
      unit_price: 25000,
      full_amount: 25000,
      amount_paid: 25000,
      balance: 0,
    });
  });

  it('loads the zone price times the selected months', () => {
    const cell = normalizeTransportCell({ ...dated, months: 2, kind: 'full' }, zonePrice);
    expect(cell.unit_price).toBe(25000);
    expect(cell.full_amount).toBe(50000);
    expect(cell.amount_paid).toBe(50000);
    expect(cell.balance).toBe(0);
  });

  it('records a partial payment and the amount left', () => {
    const cell = normalizeTransportCell(
      { ...dated, months: 1, kind: 'partial', amount_paid: 10000 },
      zonePrice,
    );
    expect(cell.kind).toBe('partial');
    expect(cell.amount_paid).toBe(10000);
    expect(cell.balance).toBe(15000);
  });

  it('rejects an amount above the full payment', () => {
    expect(() =>
      normalizeTransportCell({ ...dated, months: 1, kind: 'partial', amount_paid: 25001 }, zonePrice),
    ).toThrow(BadRequestException);
  });

  it('treats a partial that covers the full amount as full', () => {
    const cell = normalizeTransportCell(
      { ...dated, months: 1, kind: 'partial', amount_paid: 25000 },
      zonePrice,
    );
    expect(cell.kind).toBe('full');
    expect(cell.balance).toBe(0);
  });

  it('refuses a new tick when the zone has no price', () => {
    expect(() =>
      normalizeTransportCell({ ...dated, months: 1, kind: 'full' }, 0),
    ).toThrow(/zone price/);
  });

  it('keeps a recorded snapshot when the zone price later changes', () => {
    const cell = normalizeTransportCell(
      { ...dated, months: 1, kind: 'partial', amount_paid: 4000, unit_price: 10000, full_amount: 10000 },
      zonePrice,
    );
    expect(cell.full_amount).toBe(10000);
    expect(cell.balance).toBe(6000);
  });

  it('leaves older ticks that have no payment kind unchanged', () => {
    expect(normalizeTransportCell({ ...dated, months: 1 }, zonePrice)).toEqual({
      paid_on: '2026-10-11',
      months: 1,
      expires_on: '2026-11-11',
    });
  });
});
