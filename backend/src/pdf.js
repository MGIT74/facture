import PDFDocument from 'pdfkit';

// Helvetica (police PDF standard) ne gère pas les espaces insécables fines : on les remplace.
const money = (n, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency })
  .format(n).replace(/[\u202f\u00a0]/g, ' ');
const dateFr = (s) => (s ? s.split('-').reverse().join('/') : '');
const num = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n).replace(/[\u202f\u00a0]/g, ' ');

const INK = '#16212A', MUTED = '#5E6C78', LINE = '#D8DEE3', ACCENT = '#0F5C58';

export function renderPdf(res, kind, doc) {
  const isInvoice = kind === 'invoice';
  const eur = (n) => money(n, doc.currency);
  const title = isInvoice ? 'FACTURE' : 'DEVIS';
  const pdf = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `${title} ${doc.number}` } });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${doc.number}.pdf"`);
  pdf.pipe(res);

  const co = doc.company;
  const cl = doc.client;
  const left = 50, right = 545;

  // En-tête : entreprise à gauche, titre à droite
  pdf.fillColor(ACCENT).font('Helvetica-Bold').fontSize(16).text(co.company_name, left, 50);
  pdf.fillColor(MUTED).font('Helvetica').fontSize(9);
  const coLines = [co.legal_name, co.address, [co.postal_code, co.city].filter(Boolean).join(' '),
    co.siret && `SIRET ${co.siret}`, co.vat_number && `TVA ${co.vat_number}`, co.email, co.phone].filter(Boolean);
  pdf.text(coLines.join('\n'), left, 72, { width: 250 });

  pdf.fillColor(INK).font('Helvetica-Bold').fontSize(22).text(title, 300, 50, { width: right - 300, align: 'right' });
  pdf.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text(doc.number, 300, 78, { width: right - 300, align: 'right' })
    .text(`Émise le ${dateFr(doc.issue_date)}`, 300, 93, { width: right - 300, align: 'right' })
    .text(isInvoice ? `Échéance le ${dateFr(doc.due_date)}` : `Valable jusqu'au ${dateFr(doc.valid_until)}`,
      300, 108, { width: right - 300, align: 'right' });

  // Client
  let y = 170;
  pdf.fillColor(MUTED).font('Helvetica').fontSize(9).text(isInvoice ? 'Facturé à' : 'Destinataire', 330, y);
  pdf.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(cl.name, 330, y + 14, { width: 215 });
  pdf.font('Helvetica').fontSize(10).fillColor(INK);
  const clLines = [cl.address, [cl.postal_code, cl.city].filter(Boolean).join(' '), cl.country,
    cl.vat_number && `TVA ${cl.vat_number}`].filter(Boolean);
  pdf.text(clLines.join('\n'), 330, pdf.y + 2, { width: 215 });

  // Tableau des lignes
  y = Math.max(pdf.y + 30, 270);
  const cols = { desc: left, qty: 285, pu: 330, disc: 395, tva: 435, total: 480 };
  const header = () => {
    pdf.moveTo(left, y + 16).lineTo(right, y + 16).strokeColor(INK).lineWidth(1).stroke();
    pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5);
    pdf.text('Description', cols.desc, y, { width: 225 });
    pdf.text('Qté', cols.qty, y, { width: 40, align: 'right' });
    pdf.text('P.U. HT', cols.pu, y, { width: 60, align: 'right' });
    pdf.text('Remise', cols.disc, y, { width: 35, align: 'right' });
    pdf.text('TVA', cols.tva, y, { width: 35, align: 'right' });
    pdf.text('Total HT', cols.total, y, { width: right - cols.total, align: 'right' });
    y += 24;
  };
  header();

  pdf.font('Helvetica').fontSize(9.5).fillColor(INK);
  for (const l of doc.lines) {
    const h = pdf.heightOfString(l.description, { width: 225 });
    if (y + h > 740) { pdf.addPage(); y = 50; header(); pdf.font('Helvetica').fontSize(9.5).fillColor(INK); }
    pdf.text(l.description, cols.desc, y, { width: 225 });
    pdf.text(num(l.quantity), cols.qty, y, { width: 40, align: 'right' });
    pdf.text(eur(l.unit_price), cols.pu, y, { width: 60, align: 'right' });
    pdf.text(l.discount_rate ? `${num(l.discount_rate)} %` : '', cols.disc, y, { width: 35, align: 'right' });
    pdf.text(`${num(l.tax_rate)} %`, cols.tva, y, { width: 35, align: 'right' });
    pdf.text(eur(l.line_total), cols.total, y, { width: right - cols.total, align: 'right' });
    y += Math.max(h, 12) + 8;
    pdf.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor(LINE).lineWidth(0.5).stroke();
  }

  // Totaux
  if (y > 690) { pdf.addPage(); y = 50; }
  y += 10;
  const row = (label, value, bold = false, size = 10) => {
    pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(bold ? INK : MUTED)
      .text(label, 330, y, { width: 110 });
    pdf.fillColor(INK).text(value, 440, y, { width: right - 440, align: 'right' });
    y += size + 6;
  };
  row('Total HT', eur(doc.subtotal));
  row('TVA', eur(doc.tax_total));
  pdf.moveTo(330, y).lineTo(right, y).strokeColor(INK).lineWidth(1).stroke();
  y += 6;
  row('Total TTC', eur(doc.total), true, 13);
  if (isInvoice && doc.amount_paid > 0) {
    row('Déjà réglé', eur(doc.amount_paid));
    row('Reste à payer', eur(doc.balance_due), true, 11);
  }

  // Notes, conditions, coordonnées bancaires
  y += 14;
  const block = (label, text) => {
    if (!text) return;
    if (y > 740) { pdf.addPage(); y = 50; }
    pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text(label, left, y);
    pdf.fillColor(INK).font('Helvetica').fontSize(9).text(text, left, y + 12, { width: 300 });
    y = pdf.y + 12;
  };
  block('Notes', doc.notes);
  block('Conditions', doc.terms);
  if (isInvoice && co.iban) block('Règlement par virement', `IBAN ${co.iban}${co.bic ? `\nBIC ${co.bic}` : ''}`);

  pdf.end();
}
