import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  tax_rate: number;
  line_total: number;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  currency_code: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  clients: {
    name: string;
    email: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    vat_number: string | null;
  };
  companies: {
    name: string;
    legal_name: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    vat_number: string | null;
    registration_number: string | null;
    iban: string | null;
    bic: string | null;
    bank_details: string | null;
  };
  invoice_lines: InvoiceLine[];
}

interface Quote {
  id: string;
  number: string;
  status: string;
  currency_code: string;
  issue_date: string;
  expiry_date: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  clients: {
    name: string;
    email: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    vat_number: string | null;
  };
  companies: {
    name: string;
    legal_name: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    vat_number: string | null;
    registration_number: string | null;
  };
  quote_lines: InvoiceLine[];
}

const translations: Record<string, Record<string, string>> = {
  fr: {
    invoice: 'FACTURE',
    quote: 'DEVIS',
    invoiceNumber: 'Facture N°',
    quoteNumber: 'Devis N°',
    date: 'Date',
    dueDate: 'Date d\'échéance',
    expiryDate: 'Date d\'expiration',
    from: 'De',
    billTo: 'Facturer à',
    description: 'Description',
    quantity: 'Qté',
    unitPrice: 'Prix unitaire',
    discount: 'Remise',
    tax: 'TVA',
    total: 'Total',
    subtotal: 'Sous-total',
    totalDiscount: 'Remise totale',
    totalTax: 'TVA totale',
    totalDue: 'Total à payer',
    notes: 'Notes',
    terms: 'Conditions',
    bankDetails: 'Coordonnées bancaires',
    iban: 'IBAN',
    bic: 'BIC',
    vatNumber: 'N° TVA',
    regNumber: 'SIRET',
    page: 'Page',
    of: 'sur',
  },
  en: {
    invoice: 'INVOICE',
    quote: 'QUOTE',
    invoiceNumber: 'Invoice #',
    quoteNumber: 'Quote #',
    date: 'Date',
    dueDate: 'Due Date',
    expiryDate: 'Expiry Date',
    from: 'From',
    billTo: 'Bill To',
    description: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    subtotal: 'Subtotal',
    totalDiscount: 'Total Discount',
    totalTax: 'Total Tax',
    totalDue: 'Total Due',
    notes: 'Notes',
    terms: 'Terms & Conditions',
    bankDetails: 'Bank Details',
    iban: 'IBAN',
    bic: 'BIC',
    vatNumber: 'VAT Number',
    regNumber: 'Reg. Number',
    page: 'Page',
    of: 'of',
  },
};

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };
  const symbol = symbols[currency] || currency;
  return `${amount.toFixed(2)} ${symbol}`;
}

function formatDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  if (lang === 'fr') {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateInvoiceHtml(invoice: Invoice, lang: string = 'fr'): string {
  const t = translations[lang] || translations.fr;
  const company = invoice.companies;
  const client = invoice.clients;
  const lines = invoice.invoice_lines || [];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24pt; font-weight: bold; color: #1a56db; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 28pt; color: #1a56db; margin-bottom: 8px; }
    .invoice-title .number { font-size: 12pt; color: #666; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-block h3 { font-size: 9pt; text-transform: uppercase; color: #888; margin-bottom: 8px; letter-spacing: 1px; }
    .address-block p { margin-bottom: 4px; }
    .address-block .company-name { font-weight: bold; font-size: 12pt; margin-bottom: 8px; }
    .dates { display: flex; gap: 40px; margin-bottom: 30px; padding: 15px 20px; background: #f8fafc; border-radius: 8px; }
    .date-item label { font-size: 9pt; text-transform: uppercase; color: #888; display: block; margin-bottom: 4px; }
    .date-item span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead th { background: #1a56db; color: white; padding: 12px 15px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:first-child { border-radius: 8px 0 0 0; }
    thead th:last-child { border-radius: 0 8px 0 0; text-align: right; }
    thead th.right { text-align: right; }
    tbody td { padding: 12px 15px; border-bottom: 1px solid #e5e7eb; }
    tbody td.right { text-align: right; }
    tbody tr:last-child td { border-bottom: none; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-table { width: 300px; }
    .totals-table .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .totals-table .row.total { border-bottom: none; border-top: 2px solid #1a56db; margin-top: 8px; padding-top: 16px; font-size: 14pt; font-weight: bold; color: #1a56db; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .footer-section { margin-bottom: 20px; }
    .footer-section h4 { font-size: 10pt; color: #666; margin-bottom: 8px; }
    .footer-section p { color: #666; white-space: pre-wrap; }
    .bank-details { background: #f8fafc; padding: 15px 20px; border-radius: 8px; margin-top: 20px; }
    .bank-details h4 { margin-bottom: 10px; }
    .bank-row { display: flex; gap: 30px; }
    .bank-item label { font-size: 9pt; color: #888; display: block; }
    .bank-item span { font-weight: 600; font-family: monospace; }
    @media print { .container { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${escapeHtml(company.name)}</div>
      <div class="invoice-title">
        <h1>${t.invoice}</h1>
        <div class="number">${t.invoiceNumber}${escapeHtml(invoice.number)}</div>
      </div>
    </div>
    <div class="addresses">
      <div class="address-block">
        <h3>${t.from}</h3>
        <p class="company-name">${escapeHtml(company.legal_name || company.name)}</p>
        ${company.address ? `<p>${escapeHtml(company.address)}</p>` : ''}
        ${company.postal_code || company.city ? `<p>${escapeHtml(company.postal_code || '')} ${escapeHtml(company.city || '')}</p>` : ''}
        ${company.country ? `<p>${escapeHtml(company.country)}</p>` : ''}
        ${company.email ? `<p>${escapeHtml(company.email)}</p>` : ''}
        ${company.phone ? `<p>${escapeHtml(company.phone)}</p>` : ''}
        ${company.vat_number ? `<p>${t.vatNumber}: ${escapeHtml(company.vat_number)}</p>` : ''}
        ${company.registration_number ? `<p>${t.regNumber}: ${escapeHtml(company.registration_number)}</p>` : ''}
      </div>
      <div class="address-block">
        <h3>${t.billTo}</h3>
        <p class="company-name">${escapeHtml(client.name)}</p>
        ${client.address ? `<p>${escapeHtml(client.address)}</p>` : ''}
        ${client.postal_code || client.city ? `<p>${escapeHtml(client.postal_code || '')} ${escapeHtml(client.city || '')}</p>` : ''}
        ${client.country ? `<p>${escapeHtml(client.country)}</p>` : ''}
        ${client.vat_number ? `<p>${t.vatNumber}: ${escapeHtml(client.vat_number)}</p>` : ''}
      </div>
    </div>
    <div class="dates">
      <div class="date-item">
        <label>${t.date}</label>
        <span>${formatDate(invoice.issue_date, lang)}</span>
      </div>
      <div class="date-item">
        <label>${t.dueDate}</label>
        <span>${formatDate(invoice.due_date, lang)}</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${t.description}</th>
          <th class="right">${t.quantity}</th>
          <th class="right">${t.unitPrice}</th>
          <th class="right">${t.discount}</th>
          <th class="right">${t.tax}</th>
          <th class="right">${t.total}</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map(line => `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${formatCurrency(line.unit_price, invoice.currency_code)}</td>
          <td class="right">${line.discount_rate}%</td>
          <td class="right">${line.tax_rate}%</td>
          <td class="right">${formatCurrency(line.line_total, invoice.currency_code)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-table">
        <div class="row">
          <span>${t.subtotal}</span>
          <span>${formatCurrency(invoice.subtotal, invoice.currency_code)}</span>
        </div>
        ${invoice.discount_total > 0 ? `
        <div class="row">
          <span>${t.totalDiscount}</span>
          <span>-${formatCurrency(invoice.discount_total, invoice.currency_code)}</span>
        </div>
        ` : ''}
        <div class="row">
          <span>${t.totalTax}</span>
          <span>${formatCurrency(invoice.tax_total, invoice.currency_code)}</span>
        </div>
        <div class="row total">
          <span>${t.totalDue}</span>
          <span>${formatCurrency(invoice.total, invoice.currency_code)}</span>
        </div>
      </div>
    </div>
    ${invoice.notes || invoice.terms || company.iban ? `
    <div class="footer">
      ${invoice.notes ? `
      <div class="footer-section">
        <h4>${t.notes}</h4>
        <p>${escapeHtml(invoice.notes)}</p>
      </div>
      ` : ''}
      ${invoice.terms ? `
      <div class="footer-section">
        <h4>${t.terms}</h4>
        <p>${escapeHtml(invoice.terms)}</p>
      </div>
      ` : ''}
      ${company.iban ? `
      <div class="bank-details">
        <h4>${t.bankDetails}</h4>
        <div class="bank-row">
          <div class="bank-item">
            <label>${t.iban}</label>
            <span>${escapeHtml(company.iban)}</span>
          </div>
          ${company.bic ? `
          <div class="bank-item">
            <label>${t.bic}</label>
            <span>${escapeHtml(company.bic)}</span>
          </div>
          ` : ''}
        </div>
        ${company.bank_details ? `<p style="margin-top: 10px;">${escapeHtml(company.bank_details)}</p>` : ''}
      </div>
      ` : ''}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

function generateQuoteHtml(quote: Quote, lang: string = 'fr'): string {
  const t = translations[lang] || translations.fr;
  const company = quote.companies;
  const client = quote.clients;
  const lines = quote.quote_lines || [];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24pt; font-weight: bold; color: #059669; }
    .quote-title { text-align: right; }
    .quote-title h1 { font-size: 28pt; color: #059669; margin-bottom: 8px; }
    .quote-title .number { font-size: 12pt; color: #666; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-block h3 { font-size: 9pt; text-transform: uppercase; color: #888; margin-bottom: 8px; letter-spacing: 1px; }
    .address-block p { margin-bottom: 4px; }
    .address-block .company-name { font-weight: bold; font-size: 12pt; margin-bottom: 8px; }
    .dates { display: flex; gap: 40px; margin-bottom: 30px; padding: 15px 20px; background: #f0fdf4; border-radius: 8px; }
    .date-item label { font-size: 9pt; text-transform: uppercase; color: #888; display: block; margin-bottom: 4px; }
    .date-item span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead th { background: #059669; color: white; padding: 12px 15px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:first-child { border-radius: 8px 0 0 0; }
    thead th:last-child { border-radius: 0 8px 0 0; text-align: right; }
    thead th.right { text-align: right; }
    tbody td { padding: 12px 15px; border-bottom: 1px solid #e5e7eb; }
    tbody td.right { text-align: right; }
    tbody tr:last-child td { border-bottom: none; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-table { width: 300px; }
    .totals-table .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .totals-table .row.total { border-bottom: none; border-top: 2px solid #059669; margin-top: 8px; padding-top: 16px; font-size: 14pt; font-weight: bold; color: #059669; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .footer-section { margin-bottom: 20px; }
    .footer-section h4 { font-size: 10pt; color: #666; margin-bottom: 8px; }
    .footer-section p { color: #666; white-space: pre-wrap; }
    @media print { .container { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${escapeHtml(company.name)}</div>
      <div class="quote-title">
        <h1>${t.quote}</h1>
        <div class="number">${t.quoteNumber}${escapeHtml(quote.number)}</div>
      </div>
    </div>
    <div class="addresses">
      <div class="address-block">
        <h3>${t.from}</h3>
        <p class="company-name">${escapeHtml(company.legal_name || company.name)}</p>
        ${company.address ? `<p>${escapeHtml(company.address)}</p>` : ''}
        ${company.postal_code || company.city ? `<p>${escapeHtml(company.postal_code || '')} ${escapeHtml(company.city || '')}</p>` : ''}
        ${company.country ? `<p>${escapeHtml(company.country)}</p>` : ''}
        ${company.email ? `<p>${escapeHtml(company.email)}</p>` : ''}
        ${company.phone ? `<p>${escapeHtml(company.phone)}</p>` : ''}
        ${company.vat_number ? `<p>${t.vatNumber}: ${escapeHtml(company.vat_number)}</p>` : ''}
      </div>
      <div class="address-block">
        <h3>${t.billTo}</h3>
        <p class="company-name">${escapeHtml(client.name)}</p>
        ${client.address ? `<p>${escapeHtml(client.address)}</p>` : ''}
        ${client.postal_code || client.city ? `<p>${escapeHtml(client.postal_code || '')} ${escapeHtml(client.city || '')}</p>` : ''}
        ${client.country ? `<p>${escapeHtml(client.country)}</p>` : ''}
        ${client.vat_number ? `<p>${t.vatNumber}: ${escapeHtml(client.vat_number)}</p>` : ''}
      </div>
    </div>
    <div class="dates">
      <div class="date-item">
        <label>${t.date}</label>
        <span>${formatDate(quote.issue_date, lang)}</span>
      </div>
      ${quote.expiry_date ? `
      <div class="date-item">
        <label>${t.expiryDate}</label>
        <span>${formatDate(quote.expiry_date, lang)}</span>
      </div>
      ` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>${t.description}</th>
          <th class="right">${t.quantity}</th>
          <th class="right">${t.unitPrice}</th>
          <th class="right">${t.discount}</th>
          <th class="right">${t.tax}</th>
          <th class="right">${t.total}</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map(line => `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${formatCurrency(line.unit_price, quote.currency_code)}</td>
          <td class="right">${line.discount_rate}%</td>
          <td class="right">${line.tax_rate}%</td>
          <td class="right">${formatCurrency(line.line_total, quote.currency_code)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-table">
        <div class="row">
          <span>${t.subtotal}</span>
          <span>${formatCurrency(quote.subtotal, quote.currency_code)}</span>
        </div>
        ${quote.discount_total > 0 ? `
        <div class="row">
          <span>${t.totalDiscount}</span>
          <span>-${formatCurrency(quote.discount_total, quote.currency_code)}</span>
        </div>
        ` : ''}
        <div class="row">
          <span>${t.totalTax}</span>
          <span>${formatCurrency(quote.tax_total, quote.currency_code)}</span>
        </div>
        <div class="row total">
          <span>${t.total}</span>
          <span>${formatCurrency(quote.total, quote.currency_code)}</span>
        </div>
      </div>
    </div>
    ${quote.notes || quote.terms ? `
    <div class="footer">
      ${quote.notes ? `
      <div class="footer-section">
        <h4>${t.notes}</h4>
        <p>${escapeHtml(quote.notes)}</p>
      </div>
      ` : ''}
      ${quote.terms ? `
      <div class="footer-section">
        <h4>${t.terms}</h4>
        <p>${escapeHtml(quote.terms)}</p>
      </div>
      ` : ''}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, id, lang = 'fr' } = await req.json();

    if (!type || !id) {
      return new Response(JSON.stringify({ error: 'Missing type or id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let html: string;
    let filename: string;

    if (type === 'invoice') {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*, clients(*), companies(*), invoice_lines(*)')
        .eq('id', id)
        .single();

      if (error || !invoice) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      html = generateInvoiceHtml(invoice as Invoice, lang);
      filename = `facture-${invoice.number}.html`;
    } else if (type === 'quote') {
      const { data: quote, error } = await supabase
        .from('quotes')
        .select('*, clients(*), companies(*), quote_lines(*)')
        .eq('id', id)
        .single();

      if (error || !quote) {
        return new Response(JSON.stringify({ error: 'Quote not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      html = generateQuoteHtml(quote as Quote, lang);
      filename = `devis-${quote.number}.html`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ html, filename }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});