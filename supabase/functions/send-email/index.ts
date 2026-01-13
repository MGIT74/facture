import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface EmailPayload {
  type: 'invoice' | 'quote';
  id: string;
  recipientEmail: string;
  subject?: string;
  message?: string;
  lang?: 'fr' | 'en';
}

const translations = {
  fr: {
    invoiceSubject: (number: string, company: string) => `Facture ${number} de ${company}`,
    quoteSubject: (number: string, company: string) => `Devis ${number} de ${company}`,
    invoiceGreeting: (clientName: string) => `Bonjour ${clientName},`,
    quoteGreeting: (clientName: string) => `Bonjour ${clientName},`,
    invoiceIntro: (company: string) => `Veuillez trouver ci-joint votre facture de ${company}.`,
    quoteIntro: (company: string) => `Veuillez trouver ci-joint votre devis de ${company}.`,
    invoiceDetails: (number: string, total: string, dueDate: string) => 
      `<strong>Facture N\u00b0:</strong> ${number}<br><strong>Montant:</strong> ${total}<br><strong>\u00c9ch\u00e9ance:</strong> ${dueDate}`,
    quoteDetails: (number: string, total: string, expiryDate: string) => 
      `<strong>Devis N\u00b0:</strong> ${number}<br><strong>Montant:</strong> ${total}<br><strong>Valide jusqu'au:</strong> ${expiryDate}`,
    regards: 'Cordialement,',
    viewDocument: 'Voir le document',
  },
  en: {
    invoiceSubject: (number: string, company: string) => `Invoice ${number} from ${company}`,
    quoteSubject: (number: string, company: string) => `Quote ${number} from ${company}`,
    invoiceGreeting: (clientName: string) => `Hello ${clientName},`,
    quoteGreeting: (clientName: string) => `Hello ${clientName},`,
    invoiceIntro: (company: string) => `Please find attached your invoice from ${company}.`,
    quoteIntro: (company: string) => `Please find attached your quote from ${company}.`,
    invoiceDetails: (number: string, total: string, dueDate: string) => 
      `<strong>Invoice #:</strong> ${number}<br><strong>Amount:</strong> ${total}<br><strong>Due Date:</strong> ${dueDate}`,
    quoteDetails: (number: string, total: string, expiryDate: string) => 
      `<strong>Quote #:</strong> ${number}<br><strong>Amount:</strong> ${total}<br><strong>Valid until:</strong> ${expiryDate}`,
    regards: 'Best regards,',
    viewDocument: 'View Document',
  },
};

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { EUR: '\u20ac', USD: '$', GBP: '\u00a3', CHF: 'CHF' };
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

function generateEmailHtml(
  t: typeof translations.fr,
  type: 'invoice' | 'quote',
  doc: any,
  company: any,
  client: any,
  customMessage: string | undefined,
  lang: string
): string {
  const isInvoice = type === 'invoice';
  const greeting = isInvoice ? t.invoiceGreeting(client.name) : t.quoteGreeting(client.name);
  const intro = isInvoice ? t.invoiceIntro(company.name) : t.quoteIntro(company.name);
  const details = isInvoice
    ? t.invoiceDetails(doc.number, formatCurrency(doc.total, doc.currency_code), formatDate(doc.due_date, lang))
    : t.quoteDetails(doc.number, formatCurrency(doc.total, doc.currency_code), formatDate(doc.expiry_date || doc.issue_date, lang));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, ${isInvoice ? '#1a56db' : '#059669'} 0%, ${isInvoice ? '#1e40af' : '#047857'} 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${company.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">${greeting}</p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">${intro}</p>
              ${customMessage ? `<p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px;">${customMessage}</p>` : ''}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <p style="color: #374151; font-size: 15px; line-height: 2; margin: 0;">${details}</p>
                  </td>
                </tr>
              </table>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">${t.regards}</p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0; font-weight: 600;">${company.name}</p>
              ${company.email ? `<p style="color: #6b7280; font-size: 14px; margin: 5px 0 0;">${company.email}</p>` : ''}
              ${company.phone ? `<p style="color: #6b7280; font-size: 14px; margin: 5px 0 0;">${company.phone}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                ${company.address ? `${company.address}, ` : ''}${company.postal_code || ''} ${company.city || ''}
              </p>
              ${company.vat_number ? `<p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0;">TVA: ${company.vat_number}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendWithResend(to: string, from: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
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

    const payload: EmailPayload = await req.json();
    const { type, id, recipientEmail, subject: customSubject, message: customMessage, lang = 'fr' } = payload;

    if (!type || !id || !recipientEmail) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const t = translations[lang] || translations.fr;
    let doc: any;
    let company: any;
    let client: any;
    let subject: string;

    if (type === 'invoice') {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*, clients(*), companies(*)')
        .eq('id', id)
        .single();

      if (error || !invoice) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      doc = invoice;
      company = invoice.companies;
      client = invoice.clients;
      subject = customSubject || t.invoiceSubject(invoice.number, company.name);
    } else if (type === 'quote') {
      const { data: quote, error } = await supabase
        .from('quotes')
        .select('*, clients(*), companies(*)')
        .eq('id', id)
        .single();

      if (error || !quote) {
        return new Response(JSON.stringify({ error: 'Quote not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      doc = quote;
      company = quote.companies;
      client = quote.clients;
      subject = customSubject || t.quoteSubject(quote.number, company.name);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromEmail = company.email ? `${company.name} <${company.email}>` : `${company.name} <noreply@facturio.app>`;
    const html = generateEmailHtml(t, type, doc, company, client, customMessage, lang);

    const result = await sendWithResend(recipientEmail, fromEmail, subject, html);

    await supabase.from('email_logs').insert({
      company_id: company.id,
      invoice_id: type === 'invoice' ? id : null,
      quote_id: type === 'quote' ? id : null,
      recipient_email: recipientEmail,
      subject,
      body: html,
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error || null,
    });

    if (result.success) {
      const updateTable = type === 'invoice' ? 'invoices' : 'quotes';
      const updateData: any = { sent_at: new Date().toISOString() };
      if (type === 'invoice') {
        updateData.status = 'sent';
      } else {
        updateData.status = 'sent';
      }
      await supabase.from(updateTable).update(updateData).eq('id', id);
    }

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});