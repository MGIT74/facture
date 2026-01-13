'use server'

import { createClient } from '@/lib/supabase/server'

interface ExportOptions {
  companyId: string
  startDate: string
  endDate: string
  includeInvoices: boolean
  includePayments: boolean
  format: 'csv' | 'json'
}

function formatDateForExport(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toISOString().split('T')[0]
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function generateAccountingExport(options: ExportOptions) {
  const supabase = await createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) {
    return { error: 'Not authenticated' }
  }

  const result: {
    invoices: any[]
    payments: any[]
    summary: {
      totalInvoiced: number
      totalPaid: number
      totalTax: number
      invoiceCount: number
      paymentCount: number
    }
  } = {
    invoices: [],
    payments: [],
    summary: {
      totalInvoiced: 0,
      totalPaid: 0,
      totalTax: 0,
      invoiceCount: 0,
      paymentCount: 0,
    },
  }

  if (options.includeInvoices) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, clients(name)')
      .eq('company_id', options.companyId)
      .gte('issue_date', options.startDate)
      .lte('issue_date', options.endDate)
      .order('issue_date', { ascending: true })

    if (invoices) {
      result.invoices = invoices.map((inv) => ({
        date: formatDateForExport(inv.issue_date),
        number: inv.number,
        client: inv.clients?.name || '',
        subtotal: inv.subtotal,
        tax: inv.tax_total,
        discount: inv.discount_total,
        total: inv.total,
        status: inv.status,
        currency: inv.currency_code,
        dueDate: formatDateForExport(inv.due_date),
        paidDate: inv.paid_date ? formatDateForExport(inv.paid_date) : '',
      }))

      result.summary.totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total), 0)
      result.summary.totalTax = invoices.reduce((sum, inv) => sum + Number(inv.tax_total), 0)
      result.summary.invoiceCount = invoices.length
    }
  }

  if (options.includePayments) {
    const { data: payments } = await supabase
      .from('payments')
      .select('*, invoices(number, clients(name))')
      .eq('company_id', options.companyId)
      .gte('payment_date', options.startDate)
      .lte('payment_date', options.endDate)
      .order('payment_date', { ascending: true })

    if (payments) {
      result.payments = payments.map((pay) => ({
        date: formatDateForExport(pay.payment_date),
        invoiceNumber: pay.invoices?.number || '',
        client: pay.invoices?.clients?.name || '',
        amount: pay.amount,
        method: pay.payment_method,
        reference: pay.reference || '',
      }))

      result.summary.totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0)
      result.summary.paymentCount = payments.length
    }
  }

  if (options.format === 'csv') {
    let csv = ''

    if (options.includeInvoices && result.invoices.length > 0) {
      csv += 'FACTURES\n'
      csv += 'Date,Numero,Client,Sous-total,TVA,Remise,Total,Statut,Devise,Echeance,Date paiement\n'
      result.invoices.forEach((inv) => {
        csv += `${escapeCSV(inv.date)},${escapeCSV(inv.number)},${escapeCSV(inv.client)},${escapeCSV(inv.subtotal)},${escapeCSV(inv.tax)},${escapeCSV(inv.discount)},${escapeCSV(inv.total)},${escapeCSV(inv.status)},${escapeCSV(inv.currency)},${escapeCSV(inv.dueDate)},${escapeCSV(inv.paidDate)}\n`
      })
      csv += '\n'
    }

    if (options.includePayments && result.payments.length > 0) {
      csv += 'PAIEMENTS\n'
      csv += 'Date,Facture,Client,Montant,Mode,Reference\n'
      result.payments.forEach((pay) => {
        csv += `${escapeCSV(pay.date)},${escapeCSV(pay.invoiceNumber)},${escapeCSV(pay.client)},${escapeCSV(pay.amount)},${escapeCSV(pay.method)},${escapeCSV(pay.reference)}\n`
      })
      csv += '\n'
    }

    csv += 'RESUME\n'
    csv += `Total facture,${result.summary.totalInvoiced}\n`
    csv += `Total TVA,${result.summary.totalTax}\n`
    csv += `Total encaisse,${result.summary.totalPaid}\n`
    csv += `Nombre factures,${result.summary.invoiceCount}\n`
    csv += `Nombre paiements,${result.summary.paymentCount}\n`

    return { data: csv, filename: `export-comptable-${options.startDate}-${options.endDate}.csv` }
  }

  return { data: JSON.stringify(result, null, 2), filename: `export-comptable-${options.startDate}-${options.endDate}.json` }
}

export async function getReportData(companyId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) {
    return { error: 'Not authenticated' }
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, clients(name)')
    .eq('company_id', companyId)
    .gte('issue_date', startDate)
    .lte('issue_date', endDate)

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('company_id', companyId)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)

  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, clients(name)')
    .eq('company_id', companyId)
    .gte('issue_date', startDate)
    .lte('issue_date', endDate)

  const monthlyData: Record<string, { month: string; revenue: number; invoiced: number; quotes: number }> = {}

  invoices?.forEach((inv) => {
    const month = inv.issue_date.substring(0, 7)
    if (!monthlyData[month]) {
      monthlyData[month] = { month, revenue: 0, invoiced: 0, quotes: 0 }
    }
    monthlyData[month].invoiced += Number(inv.total)
    if (inv.status === 'paid') {
      monthlyData[month].revenue += Number(inv.total)
    }
  })

  quotes?.forEach((quote) => {
    const month = quote.issue_date.substring(0, 7)
    if (!monthlyData[month]) {
      monthlyData[month] = { month, revenue: 0, invoiced: 0, quotes: 0 }
    }
    monthlyData[month].quotes += Number(quote.total)
  })

  const byClient: Record<string, { client: string; total: number; count: number }> = {}
  invoices?.forEach((inv) => {
    const clientName = inv.clients?.name || 'Unknown'
    if (!byClient[clientName]) {
      byClient[clientName] = { client: clientName, total: 0, count: 0 }
    }
    byClient[clientName].total += Number(inv.total)
    byClient[clientName].count += 1
  })

  const byStatus = {
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  }

  invoices?.forEach((inv) => {
    if (byStatus.hasOwnProperty(inv.status)) {
      byStatus[inv.status as keyof typeof byStatus] += 1
    }
  })

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const totalPaid = invoices?.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const totalOverdue = invoices?.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const totalQuotes = quotes?.reduce((sum, q) => sum + Number(q.total), 0) || 0
  const acceptedQuotes = quotes?.filter((q) => q.status === 'accepted').reduce((sum, q) => sum + Number(q.total), 0) || 0

  return {
    data: {
      summary: {
        totalInvoiced,
        totalPaid,
        totalOverdue,
        totalQuotes,
        acceptedQuotes,
        invoiceCount: invoices?.length || 0,
        quoteCount: quotes?.length || 0,
        paymentCount: payments?.length || 0,
        conversionRate: quotes?.length ? ((quotes.filter((q) => q.status === 'accepted').length / quotes.length) * 100).toFixed(1) : 0,
      },
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      byClient: Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 10),
      byStatus,
    },
  }
}
