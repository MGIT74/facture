// Même calcul que le backend : le serveur recalcule toujours, ceci sert à l'aperçu en direct.
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function lineNet(l) {
  const gross = r2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0));
  return r2(gross - r2((gross * (Number(l.discount_rate) || 0)) / 100));
}

export function totals(lines) {
  let ht = 0, tax = 0;
  for (const l of lines) {
    const net = lineNet(l);
    ht += net;
    tax += r2((net * (Number(l.tax_rate) || 0)) / 100);
  }
  return { ht: r2(ht), tax: r2(tax), ttc: r2(ht + tax) };
}
