'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getQuotes(companyId: string) {
  const supabase = await createClient()

  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, clients(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return quotes || []
}

export async function getQuote(id: string) {
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, clients(*), quote_lines(*), companies(*)')
    .eq('id', id)
    .maybeSingle()

  return quote
}

async function generateQuoteNumber(companyId: string) {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('quote_prefix, next_quote_number')
    .eq('id', companyId)
    .maybeSingle()

  if (!company) throw new Error('Company not found')

  const number = `${company.quote_prefix}-${new Date().getFullYear()}-${String(company.next_quote_number).padStart(4, '0')}`

  await supabase
    .from('companies')
    .update({ next_quote_number: company.next_quote_number + 1 })
    .eq('id', companyId)

  return number
}

export async function createQuote(companyId: string, data: {
  client_id: string
  currency_code: string
  issue_date: string
  expiry_date: string
  notes?: string
  terms?: string
  lines: Array<{
    item_id?: string
    description: string
    quantity: number
    unit_price: number
    discount_rate: number
    tax_rate: number
  }>
}) {
  const supabase = await createClient()

  let subtotal = 0
  let taxTotal = 0
  let discountTotal = 0

  const linesWithTotals = data.lines.map((line, index) => {
    const lineSubtotal = line.quantity * line.unit_price
    const lineDiscount = lineSubtotal * (line.discount_rate / 100)
    const lineAfterDiscount = lineSubtotal - lineDiscount
    const lineTax = lineAfterDiscount * (line.tax_rate / 100)
    const lineTotal = lineAfterDiscount + lineTax

    subtotal += lineSubtotal
    discountTotal += lineDiscount
    taxTotal += lineTax

    return {
      ...line,
      line_total: lineTotal,
      sort_order: index,
    }
  })

  const total = subtotal - discountTotal + taxTotal
  const number = await generateQuoteNumber(companyId)

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      company_id: companyId,
      client_id: data.client_id,
      number,
      currency_code: data.currency_code,
      issue_date: data.issue_date,
      expiry_date: data.expiry_date,
      subtotal,
      tax_total: taxTotal,
      discount_total: discountTotal,
      total,
      notes: data.notes,
      terms: data.terms,
    })
    .select()
    .single()

  if (quoteError) {
    return { error: quoteError.message }
  }

  const linesToInsert = linesWithTotals.map(line => ({
    quote_id: quote.id,
    ...line,
  }))

  const { error: linesError } = await supabase
    .from('quote_lines')
    .insert(linesToInsert)

  if (linesError) {
    return { error: linesError.message }
  }

  revalidatePath('/quotes')
  return { data: quote }
}

export async function updateQuote(id: string, updates: {
  status?: string
}) {
  const supabase = await createClient()

  const { data: quote, error } = await supabase
    .from('quotes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/quotes')
  return { data: quote }
}

export async function deleteQuote(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/quotes')
  return { success: true }
}

export async function convertQuoteToInvoice(quoteId: string) {
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, quote_lines(*), companies(*)')
    .eq('id', quoteId)
    .maybeSingle()

  if (!quote) {
    return { error: 'Quote not found' }
  }

  const { data: company } = await supabase
    .from('companies')
    .select('invoice_prefix, next_invoice_number, payment_terms_days')
    .eq('id', quote.company_id)
    .maybeSingle()

  if (!company) {
    return { error: 'Company not found' }
  }

  const invoiceNumber = `${company.invoice_prefix}-${new Date().getFullYear()}-${String(company.next_invoice_number).padStart(4, '0')}`

  await supabase
    .from('companies')
    .update({ next_invoice_number: company.next_invoice_number + 1 })
    .eq('id', quote.company_id)

  const issueDate = new Date()
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + (company.payment_terms_days || 30))

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: quote.company_id,
      client_id: quote.client_id,
      quote_id: quoteId,
      number: invoiceNumber,
      currency_code: quote.currency_code,
      issue_date: issueDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      subtotal: quote.subtotal,
      tax_total: quote.tax_total,
      discount_total: quote.discount_total,
      total: quote.total,
      balance_due: quote.total,
      notes: quote.notes,
      terms: quote.terms,
    })
    .select()
    .single()

  if (invoiceError) {
    return { error: invoiceError.message }
  }

  const invoiceLines = quote.quote_lines.map((line: any) => ({
    invoice_id: invoice.id,
    item_id: line.item_id,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_rate: line.discount_rate,
    tax_rate: line.tax_rate,
    line_total: line.line_total,
    sort_order: line.sort_order,
  }))

  const { error: linesError } = await supabase
    .from('invoice_lines')
    .insert(invoiceLines)

  if (linesError) {
    return { error: linesError.message }
  }

  await supabase
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', quoteId)

  revalidatePath('/quotes')
  revalidatePath('/invoices')
  return { data: invoice }
}
