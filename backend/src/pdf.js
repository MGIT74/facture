import PDFDocument from 'pdfkit';

// Helvetica (police PDF standard) ne gère pas les espaces insécables fines : on les remplace.
const money = (n, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency })
  .format(n).replace(/[\u202f\u00a0]/g, ' ');
const dateFr = (s) => (s ? s.split('-').reverse().join('/') : '');
const num = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n).replace(/[\u202f\u00a0]/g, ' ');

const INK = '#1c1c1e', MUTED = '#6e6e73', LINE = '#d9dfe3';
const DEFAULTS = { layout: 'classic', accent: '#0071e3', title: null, logo: null, show_discount: 1, show_tax: 1, show_bank: 1, footer: null };

/** Apparence du document : le modèle choisi, complété par les valeurs standard. */
function theme(template) {
  const t = {};
  for (const k of Object.keys(DEFAULTS)) t[k] = template?.[k] ?? DEFAULTS[k];
  return t;
}

/** Plus grande taille de police (jusqu'à max) pour laquelle le texte tient sur une ligne dans la largeur donnée. */
function fitSize(pdf, text, font, max, width, min = 11) {
  pdf.font(font);
  let size = max;
  while (size > min) {
    pdf.fontSize(size);
    if (pdf.widthOfString(text) <= width) break;
    size -= 1;
  }
  return size;
}

const logoBuffer = (dataUrl) => {
  try { return dataUrl ? Buffer.from(dataUrl.split(',')[1], 'base64') : null; } catch { return null; }
};

export function renderPdf(res, kind, doc) {
  const isInvoice = kind === 'invoice';
  const t = theme(doc.template);
  const title = (t.title || (isInvoice ? 'Facture' : 'Devis')).trim();
  const eur = (n) => money(n, doc.currency);
  const co = doc.company;
  const cl = doc.client;
  const logo = logoBuffer(t.logo);
  const accent = t.accent;
  const left = 50, right = 545;

  const pdf = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `${title} ${doc.number}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${doc.number}.pdf"`);
  pdf.pipe(res);

  // Pied de page : dessiné sur chaque page, sans déclencher de saut de page
  const footer = () => {
    if (!t.footer) return;
    const margins = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf.fillColor(MUTED).font('Helvetica').fontSize(8).text(t.footer, left, 796, { width: right - left, align: 'center', height: 36 });
    pdf.page.margins.bottom = margins;
  };
  footer();
  pdf.on('pageAdded', footer);

  const companyLines = [co.legal_name && co.legal_name !== co.company_name ? co.legal_name : null, co.address, [co.postal_code, co.city].filter(Boolean).join(' '),
    co.siret && `SIRET ${co.siret}`, co.vat_number && `TVA ${co.vat_number}`, co.email, co.phone].filter(Boolean);
  const dateLines = [`Émise le ${dateFr(doc.issue_date)}`,
    isInvoice ? `Échéance le ${dateFr(doc.due_date)}` : `Valable jusqu'au ${dateFr(doc.valid_until)}`];

  // ------------------------------------------------------------------ en-tête (3 dispositions)
  let y;
  if (t.layout === 'modern') {
    pdf.rect(0, 0, 595.28, 104).fill(accent);
    if (logo) {
      pdf.roundedRect(left, 24, 150, 56, 8).fill('#ffffff');
      try { pdf.image(logo, left + 8, 30, { fit: [134, 44], align: 'center', valign: 'center' }); } catch { /* logo illisible */ }
    } else {
      pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(co.company_name, left, 40, { width: 260 });
    }
    pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fitSize(pdf, title, 'Helvetica-Bold', 24, right - 300)).text(title, 300, 28, { width: right - 300, align: 'right' });
    pdf.font('Helvetica').fontSize(11).text(doc.number, 300, 60, { width: right - 300, align: 'right' });
    pdf.fillColor(MUTED).font('Helvetica').fontSize(9);
    pdf.text([logo && co.company_name, ...companyLines].filter(Boolean).join('\n'), left, 122, { width: 250 });
    pdf.text(dateLines.join('\n'), 300, 122, { width: right - 300, align: 'right' });
    y = 190;
  } else if (t.layout === 'minimal') {
    pdf.fillColor(INK).font('Helvetica').fontSize(fitSize(pdf, title, 'Helvetica', 20, 250)).text(title, left, 50, { width: 260 });
    pdf.fillColor(MUTED).fontSize(10).text(doc.number, left, 76, { width: 260 });
    pdf.text(dateLines.join('\n'), left, 94, { width: 260 });
    if (logo) { try { pdf.image(logo, right - 120, 46, { fit: [120, 44], align: 'right' }); } catch { /* ignore */ } }
    pdf.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(co.company_name, 300, logo ? 96 : 50, { width: right - 300, align: 'right' });
    pdf.fillColor(MUTED).font('Helvetica').fontSize(9).text(companyLines.join('\n'), 300, pdf.y + 2, { width: right - 300, align: 'right' });
    pdf.moveTo(left, 150).lineTo(right, 150).strokeColor(accent).lineWidth(1.2).stroke();
    y = 168;
  } else {
    // classique
    let textY = 72;
    if (logo) {
      try { pdf.image(logo, left, 44, { fit: [150, 52] }); } catch { /* ignore */ }
      textY = 104;
    } else {
      pdf.fillColor(accent).font('Helvetica-Bold').fontSize(16).text(co.company_name, left, 50);
    }
    pdf.fillColor(MUTED).font('Helvetica').fontSize(9);
    pdf.text([logo && co.company_name, ...companyLines].filter(Boolean).join('\n'), left, textY, { width: 250 });
    pdf.fillColor(INK).font('Helvetica-Bold').fontSize(fitSize(pdf, title.toUpperCase(), 'Helvetica-Bold', 22, right - 300)).text(title.toUpperCase(), 300, 50, { width: right - 300, align: 'right' });
    pdf.font('Helvetica').fontSize(10).fillColor(MUTED).text(doc.number, 300, 78, { width: right - 300, align: 'right' });
    pdf.text(dateLines.join('\n'), 300, 93, { width: right - 300, align: 'right' });
    y = Math.max(pdf.y + 24, 170);
  }

  // ------------------------------------------------------------------ client
  const clientTop = y;
  pdf.fillColor(MUTED).font('Helvetica').fontSize(9).text(isInvoice ? 'Facturé à' : 'Destinataire', 330, clientTop);
  pdf.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(cl.name, 330, clientTop + 14, { width: 215 });
  pdf.font('Helvetica').fontSize(10);
  pdf.text([cl.address, [cl.postal_code, cl.city].filter(Boolean).join(' '), cl.country, cl.vat_number && `TVA ${cl.vat_number}`]
    .filter(Boolean).join('\n'), 330, pdf.y + 2, { width: 215 });
  y = Math.max(pdf.y + 30, 280);

  // ------------------------------------------------------------------ tableau (colonnes selon le modèle)
  const cols = [{ key: 'desc', label: 'Description', w: 0, align: 'left' },
    { key: 'qty', label: 'Qté', w: 40, align: 'right' },
    { key: 'pu', label: 'P.U. HT', w: 64, align: 'right' }];
  if (t.show_discount) cols.push({ key: 'disc', label: 'Remise', w: 42, align: 'right' });
  if (t.show_tax) cols.push({ key: 'tva', label: 'TVA', w: 40, align: 'right' });
  cols.push({ key: 'total', label: 'Total HT', w: 72, align: 'right' });
  const gap = 8;
  const fixed = cols.reduce((a, c) => a + c.w, 0) + gap * (cols.length - 1);
  cols[0].w = right - left - fixed;
  let cx = left;
  for (const c of cols) { c.x = cx; cx += c.w + gap; }

  const header = () => {
    if (t.layout === 'modern') {
      pdf.rect(left, y - 5, right - left, 22).fill(accent);
      pdf.fillColor('#ffffff');
    } else {
      pdf.moveTo(left, y + 16).lineTo(right, y + 16).strokeColor(t.layout === 'minimal' ? accent : INK).lineWidth(1).stroke();
      pdf.fillColor(MUTED);
    }
    pdf.font('Helvetica-Bold').fontSize(8.5);
    const pad = t.layout === 'modern' ? 6 : 0;
    for (const c of cols) {
      pdf.text(c.label, c.x + (c.key === 'desc' ? pad : 0), y, { width: c.w - (c.key === 'total' ? pad : 0), align: c.align });
    }
    y += 26;
  };
  header();

  pdf.font('Helvetica').fontSize(9.5).fillColor(INK);
  const cell = (c, l) => ({
    desc: l.description, qty: num(l.quantity), pu: eur(l.unit_price),
    disc: l.discount_rate ? `${num(l.discount_rate)} %` : '', tva: `${num(l.tax_rate)} %`, total: eur(l.line_total),
  })[c.key];
  for (const l of doc.lines) {
    const h = pdf.heightOfString(l.description, { width: cols[0].w });
    if (y + h > 730) { pdf.addPage(); y = 50; header(); pdf.font('Helvetica').fontSize(9.5).fillColor(INK); }
    for (const c of cols) pdf.fillColor(INK).text(cell(c, l), c.x, y, { width: c.w, align: c.align });
    y += Math.max(h, 12) + 8;
    pdf.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor(LINE).lineWidth(0.5).stroke();
  }

  // ------------------------------------------------------------------ totaux
  if (y > 680) { pdf.addPage(); y = 50; }
  y += 10;
  const row = (label, value, bold = false, size = 10) => {
    pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(bold ? INK : MUTED).text(label, 330, y, { width: 110 });
    pdf.fillColor(INK).text(value, 440, y, { width: right - 440, align: 'right' });
    y += size + 6;
  };
  if (t.show_tax) {
    row('Total HT', eur(doc.subtotal));
    row('TVA', eur(doc.tax_total));
  }
  pdf.moveTo(330, y).lineTo(right, y).strokeColor(t.layout === 'classic' ? INK : accent).lineWidth(1).stroke();
  y += 6;
  row(t.show_tax ? 'Total TTC' : 'Total', eur(doc.total), true, 13);
  if (isInvoice && doc.amount_paid > 0) {
    row('Déjà réglé', eur(doc.amount_paid));
    row('Reste à payer', eur(doc.balance_due), true, 11);
  }

  // ------------------------------------------------------------------ notes, conditions, banque
  y += 14;
  const block = (label, text) => {
    if (!text) return;
    if (y > 735) { pdf.addPage(); y = 50; }
    pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text(label, left, y);
    pdf.fillColor(INK).font('Helvetica').fontSize(9).text(text, left, y + 12, { width: 300 });
    y = pdf.y + 12;
  };
  block('Notes', doc.notes);
  block('Conditions', doc.terms);
  if (isInvoice && t.show_bank && co.iban) block('Règlement par virement', `IBAN ${co.iban}${co.bic ? `\nBIC ${co.bic}` : ''}`);

  pdf.end();
}
