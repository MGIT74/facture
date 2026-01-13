'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getRecurringInvoices(companyId: string) {
  const supabase = await createClient()

  const { data: recurring } = await supabase
    .from('recurring_invoices')
    .select('*, clients(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return recurring || []
}

export async function getRecurringInvoice(id: string) {
  const supabase = await createClient()

  const { data: recurring } = await supabase
    .from('recurring_invoices')
    .select('*, clients(*), recurring_invoice_lines(*)')
    .eq('id', id)
    .maybeSingle()

  return recurring
}

export async function createRecurringInvoice(companyId: string, data: {
  client_id: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  next_issue_date: string
  end_date?: string
  currency_code: string
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

  const { data: recurring, error: recurringError } = await supabase
    .from('recurring_invoices')
    .insert({
      company_id: companyId,
      client_id: data.client_id,
      frequency: data.frequency,
      next_issue_date: data.next_issue_date,
      end_date: data.end_date || null,
      currency_code: data.currency_code,
      notes: data.notes,
      terms: data.terms,
      is_active: true,
    })
    .select()
    .single()

  if (recurringError) {
    return { error: recurringError.message }
  }

  const linesToInsert = data.lines.map((line, index) => ({
    recurring_invoice_id: recurring.id,
    item_id: line.item_id || null,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_rate: line.discount_rate,
    tax_rate: line.tax_rate,
    sort_order: index,
  }))

  const { error: linesError } = await supabase
    .from('recurring_invoice_lines')
    .insert(linesToInsert)

  if (linesError) {
    return { error: linesError.message }
  }

  revalidatePath('/invoices')
  return { data: recurring }
}

export async function updateRecurringInvoice(id: string, updates: {
  is_active?: boolean
  next_issue_date?: string
  end_date?: string | null
  frequency?: string
}) {
  const supabase = await createClient()

  const { data: recurring, error } = await supabase
    .from('recurring_invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/invoices')
  return { data: recurring }
}

export async function deleteRecurringInvoice(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('recurring_invoices')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/invoices')
  return { success: true }
}

function calculateNextIssueDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate)

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }

  return date.toISOString().split('T')[0]
}

export async function generateInvoiceFromRecurring(recurringId: string) {
  const supabase = await createClient()

  const { data: recurring } = await supabase
    .from('recurring_invoices')
    .select('*, recurring_invoice_lines(*), companies(invoice_prefix, next_invoice_number, payment_terms_days)')
    .eq('id', recurringId)
    .maybeSingle()

  if (!recurring) {
    return { error: 'Recurring invoice not found' }
  }

  if (!recurring.is_active) {
    return { error: 'Recurring invoice is not active' }
  }

  const company = recurring.companies
  const invoiceNumber = `${company.invoice_prefix}-${new Date().getFullYear()}-${String(company.next_invoice_number).padStart(4, '0')}`

  await supabase
    .from('companies')
    .update({ next_invoice_number: company.next_invoice_number + 1 })
    .eq('id', recurring.company_id)

  const issueDate = new Date()
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + (company.payment_terms_days || 30))

  let subtotal = 0
  let taxTotal = 0
  let discountTotal = 0

  const linesWithTotals = recurring.recurring_invoice_lines.map((line: any, index: number) => {
    const lineSubtotal = line.quantity * line.unit_price
    const lineDiscount = lineSubtotal * (line.discount_rate / 100)
    const lineAfterDiscount = lineSubtotal - lineDiscount
    const lineTax = lineAfterDiscount * (line.tax_rate / 100)
    const lineTotal = lineAfterDiscount + lineTax

    subtotal += lineSubtotal
    discountTotal += lineDiscount
    taxTotal += lineTax

    return {
      item_id: line.item_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_rate: line.discount_rate,
      tax_rate: line.tax_rate,
      line_total: lineTotal,
      sort_order: index,
    }
  })

  const total = subtotal - discountTotal + taxTotal

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: recurring.company_id,
      client_id: recurring.client_id,
      number: invoiceNumber,
      currency_code: recurring.currency_code,
      issue_date: issueDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      subtotal,
      tax_total: taxTotal,
      discount_total: discountTotal,
      total,
      balance_due: total,
      notes: recurring.notes,
      terms: recurring.terms,
    })
    .select()
    .single()

  if (invoiceError) {
    return { error: invoiceError.message }
  }

  const invoiceLines = linesWithTotals.map((line: any) => ({
    invoice_id: invoice.id,
    ...line,
  }))

  const { error: linesError } = await supabase
    .from('invoice_lines')
    .insert(invoiceLines)

  if (linesError) {
    return { error: linesError.message }
  }

  const nextIssueDate = calculateNextIssueDate(recurring.next_issue_date, recurring.frequency)
  const shouldDeactivate = recurring.end_date && new Date(nextIssueDate) > new Date(recurring.end_date)

  await supabase
    .from('recurring_invoices')
    .update({
      last_issue_date: issueDate.toISOString().split('T')[0],
      next_issue_date: nextIssueDate,
      is_active: !shouldDeactivate,
    })
    .eq('id', recurringId)

  revalidatePath('/invoices')
  return { data: invoice }
}
