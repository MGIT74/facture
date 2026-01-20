'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPayments(companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      invoice:invoices(id, number, client:clients(name))
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createPayment(data: {
  company_id: string
  invoice_id?: string
  amount: number
  currency: string
  payment_method: string
  payment_date: string
  reference?: string
  notes?: string
  provider?: string
  payment_status?: string
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('payments')
    .insert({
      company_id: data.company_id,
      invoice_id: data.invoice_id || null,
      amount: data.amount,
      currency: data.currency,
      payment_method: data.payment_method,
      payment_date: data.payment_date,
      reference: data.reference || null,
      notes: data.notes || null,
      provider: data.provider || 'manual',
      payment_status: data.payment_status || 'completed',
      paid_at: new Date().toISOString(),
    })

  if (error) throw error

  if (data.invoice_id) {
    await updateInvoicePayment(data.invoice_id, data.amount)
  }

  revalidatePath('/payments')
}

export async function updatePayment(id: string, data: {
  amount?: number
  payment_method?: string
  payment_date?: string
  reference?: string
  notes?: string
  payment_status?: string
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('payments')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/payments')
}

export async function deletePayment(id: string) {
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('invoice_id, amount')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)

  if (error) throw error

  if (payment?.invoice_id) {
    await updateInvoicePayment(payment.invoice_id, -payment.amount)
  }

  revalidatePath('/payments')
}

async function updateInvoicePayment(invoiceId: string, amount: number) {
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('amount_paid, total')
    .eq('id', invoiceId)
    .single()

  if (invoice) {
    const newAmountPaid = (invoice.amount_paid || 0) + amount
    const newBalanceDue = invoice.total - newAmountPaid
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'sent'

    await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        status: newStatus,
        paid_date: newBalanceDue <= 0 ? new Date().toISOString().split('T')[0] : null,
      })
      .eq('id', invoiceId)
  }
}

export async function getPaymentIntegrations(companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payment_integrations')
    .select('*')
    .eq('company_id', companyId)

  if (error) throw error
  return data
}

export async function savePaymentIntegration(data: {
  company_id: string
  provider: 'stripe' | 'wise'
  is_enabled: boolean
  config: Record<string, string>
}) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('payment_integrations')
    .select('id')
    .eq('company_id', data.company_id)
    .eq('provider', data.provider)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('payment_integrations')
      .update({
        is_enabled: data.is_enabled,
        config: data.config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('payment_integrations')
      .insert({
        company_id: data.company_id,
        provider: data.provider,
        is_enabled: data.is_enabled,
        config: data.config,
      })

    if (error) throw error
  }

  revalidatePath('/payments')
}

export async function toggleIntegration(companyId: string, provider: 'stripe' | 'wise', enabled: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('payment_integrations')
    .update({
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('provider', provider)

  if (error) throw error
  revalidatePath('/payments')
}

export async function getUnpaidInvoices(companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      number,
      total,
      balance_due,
      currency_code,
      client:clients(name)
    `)
    .eq('company_id', companyId)
    .gt('balance_due', 0)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data
}
