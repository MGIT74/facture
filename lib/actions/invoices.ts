'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getInvoices(companyId: string) {
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, clients(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return invoices || []
}

export async function getInvoice(id: string) {
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*), invoice_lines(*), companies(*)')
    .eq('id', id)
    .maybeSingle()

  return invoice
}

async function generateInvoiceNumber(companyId: string) {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('invoice_prefix, next_invoice_number')
    .eq('id', companyId)
    .maybeSingle()

  if (!company) throw new Error('Company not found')

  const number = `${company.invoice_prefix}-${new Date().getFullYear()}-${String(company.next_invoice_number).padStart(4, '0')}`

  await supabase
    .from('companies')
    .update({ next_invoice_number: company.next_invoice_number + 1 })
    .eq('id', companyId)

  return number
}

export async function createInvoice(companyId: string, data: {
  client_id: string
  currency_code: string
  issue_date: string
  due_date: string
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
  const number = await generateInvoiceNumber(companyId)

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: companyId,
      client_id: data.client_id,
      number,
      currency_code: data.currency_code,
      issue_date: data.issue_date,
      due_date: data.due_date,
      subtotal,
      tax_total: taxTotal,
      discount_total: discountTotal,
      total,
      balance_due: total,
      notes: data.notes,
      terms: data.terms,
    })
    .select()
    .single()

  if (invoiceError) {
    return { error: invoiceError.message }
  }

  const linesToInsert = linesWithTotals.map(line => ({
    invoice_id: invoice.id,
    ...line,
  }))

  const { error: linesError } = await supabase
    .from('invoice_lines')
    .insert(linesToInsert)

  if (linesError) {
    return { error: linesError.message }
  }

  revalidatePath('/invoices')
  return { data: invoice }
}

export async function updateInvoice(id: string, updates: {
  status?: string
  paid_date?: string | null
}) {
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/invoices')
  return { data: invoice }
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/invoices')
  return { success: true }
}
