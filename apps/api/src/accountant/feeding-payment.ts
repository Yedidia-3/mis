import { BadRequestException } from '@nestjs/common';

export interface FeedingPrices {
  breakfast: number;
  lunch: number;
}

export interface FeedingPaymentCell {
  paid_on: string;
  months: number;
  expires_on?: string;
  kind?: 'full' | 'partial';
  unit_price?: number;
  full_amount?: number;
  amount_paid?: number;
  balance?: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mealOf(key: string): 'breakfast' | 'lunch' {
  return key.endsWith('B') ? 'breakfast' : 'lunch';
}

/**
 * Turn one feeding grid cell into the shape we store.
 *
 * A cell that already carries unit_price keeps that snapshot, so changing the
 * school price later does not rewrite payments already recorded. A new tick
 * (no snapshot) loads the current breakfast or lunch price times the months.
 * Legacy ticks from before money existed are left as date-only cells.
 */
export function normalizeFeedingCell(
  key: string,
  raw: any,
  prices: FeedingPrices,
): FeedingPaymentCell {
  if (!raw || typeof raw !== 'object' || !raw.paid_on) {
    throw new BadRequestException('Each feeding payment needs a date.');
  }

  const months = Number(raw.months ?? 1);
  if (!Number.isInteger(months) || months < 1 || months > 4) {
    throw new BadRequestException('Duration must be between 1 and 4 months.');
  }

  const base: FeedingPaymentCell = {
    paid_on: String(raw.paid_on),
    months,
    expires_on: raw.expires_on ? String(raw.expires_on) : undefined,
  };

  const legacy = raw.kind !== 'full' && raw.kind !== 'partial';
  if (legacy) return base;

  const meal = mealOf(key);
  let unit: number;
  let full: number;
  const hasSnapshot = raw.unit_price != null && raw.full_amount != null;

  if (hasSnapshot) {
    unit = roundMoney(Number(raw.unit_price));
    full = roundMoney(Number(raw.full_amount));
    if (!(unit > 0) || full !== roundMoney(unit * months)) {
      throw new BadRequestException('This payment does not match its meal price.');
    }
  } else {
    unit = roundMoney(Number(meal === 'breakfast' ? prices.breakfast : prices.lunch));
    if (!(unit > 0)) {
      throw new BadRequestException(`Set the ${meal} price before recording a payment.`);
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
