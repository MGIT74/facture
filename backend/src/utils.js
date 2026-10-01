export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Calcul des lignes et totaux (même logique que le front).
 * line_total = HT après remise ; subtotal = total HT ; total = TTC.
 */
export function computeTotals(lines) {
  let subtotal = 0, discount = 0, tax = 0;
  const out = lines.map((l, i) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unit_price) || 0;
    const dRate = Number(l.discount_rate) || 0;
    const tRate = Number(l.tax_rate) || 0;
    const gross = r2(qty * price);
    const disc = r2((gross * dRate) / 100);
    const net = r2(gross - disc);
    const tx = r2((net * tRate) / 100);
    subtotal += net;
    discount += disc;
    tax += tx;
    return {
      item_id: l.item_id || null,
      description: String(l.description || '').trim(),
      quantity: qty,
      unit_price: price,
      discount_rate: dRate,
      tax_rate: tRate,
      line_total: net,
      sort_order: i,
    };
  });
  subtotal = r2(subtotal);
  tax = r2(tax);
  return { lines: out, subtotal, discount_total: r2(discount), tax_total: tax, total: r2(subtotal + tax) };
}
