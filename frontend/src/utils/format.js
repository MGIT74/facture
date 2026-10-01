export const eur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

export const dateFr = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-FR') : '');

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDaysISO = (s, days) => {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const monthLabel = (ym) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

export const STATUS = {
  invoice: { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' },
  quote: { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', rejected: 'Refusé', invoiced: 'Facturé' },
};

export const METHODS = {
  bank_transfer: 'Virement',
  card: 'Carte',
  check: 'Chèque',
  cash: 'Espèces',
  other: 'Autre',
};
