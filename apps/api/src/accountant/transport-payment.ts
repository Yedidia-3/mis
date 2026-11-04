import { BadRequestException } from '@nestjs/common';
import { roundMoney } from './feeding-payment';

export interface TransportPaymentCell {
  paid_on: string;
  months: number;
  expires_on?: string;
  kind?: 'full' | 'partial';
  unit_price?: number;
  full_amount?: number;
  amount_paid?: number;
  balance?: number;
}

/**
 * Turn one transport grid cell into the shape we store.
 *
 * A cell that already carries unit_price keeps that snapshot, so changing the
 * zone price later does not rewrite payments already recorded. A new tick
 * (no snapshot) loads the current zone price times the months. Legacy ticks
 * from before money existed are left as date-only cells.
 */
export function normalizeTransportCell(
  raw: any,
  zonePrice: number | null | undefined,
): TransportPaymentCell {
  if (!raw || typeof raw !== 'object' || !raw.paid_on) {
    throw new BadRequestException('Each transport payment needs a date.');
  }

  const months = Number(raw.months ?? 1);
  if (!Number.isInteger(months) || months < 1 || months > 4) {
    throw new BadRequestException('Duration must be between 1 and 4 months.');
  }

  const base: TransportPaymentCell = {
    paid_on: String(raw.paid_on),
    months,
    expires_on: raw.expires_on ? String(raw.expires_on) : undefined,
  };

  const legacy = raw.kind !== 'full' && raw.kind !== 'partial';
  if (legacy) return base;

  let unit: number;
  let full: number;
  const hasSnapshot = raw.unit_price != null && raw.full_amount != null;

  if (hasSnapshot) {
    unit = roundMoney(Number(raw.unit_price));
    full = roundMoney(Number(raw.full_amount));
    if (!(unit > 0) || full !== roundMoney(unit * months)) {
      throw new BadRequestException('This payment does not match its zone price.');
    }
  } else {
    unit = roundMoney(Number(zonePrice));
    if (!(unit > 0)) {
      throw new BadRequestException('Set the zone price before recording a payment.');
    }
    full = roundMoney(unit * months);
  }

  if (raw.kind === 'full') {
    return {
      ...base,
      kind: 'full',
      unit_price: unit,
      full_amount: full,
      amount_paid: full,
      balance: 0,
    };
  }

  const paid = roundMoney(Number(raw.amount_paid));
  if (!Number.isFinite(paid) || paid <= 0) {
    throw new BadRequestException('Enter the amount paid.');
  }
  if (paid > full) {
    throw new BadRequestException(`Amount paid cannot exceed the full payment of ${full}.`);
  }

  if (paid === full) {
    return {
      ...base,
      kind: 'full',
      unit_price: unit,
      full_amount: full,
      amount_paid: full,
      balance: 0,
    };
  }

  return {
    ...base,
    kind: 'partial',
    unit_price: unit,
    full_amount: full,
    amount_paid: paid,
    balance: roundMoney(full - paid),
  };
}
