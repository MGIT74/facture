'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CurrencyCode } from '@/lib/currency'
import { DollarSign, FileText, AlertCircle, TrendingUp } from 'lucide-react'
import { useCompany } from '@/lib/context/company-context'

export default function DashboardPage() {
  const { currentCompany } = useCompany()
  const [data, setData] = useState({
    totalRevenue: 0,
    pendingRevenue: 0,
    overdueInvoices: 0,
    sentQuotes: 0,
    recentInvoices: [] as any[],
    recentQuotes: [] as any[],
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCompany) return

    const supabase = createClient()

    async function fetchData() {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', currentCompany.id)

      const { data: quotes } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', currentCompany.id)

      const totalRevenue = invoices
        ?.filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.total), 0) || 0

      const pendingRevenue = invoices
        ?.filter(inv => inv.status === 'sent' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + Number(inv.balance_due), 0) || 0

      const overdueInvoices = invoices
        ?.filter(inv => inv.status === 'overdue')
        .length || 0

      const sentQuotes = quotes
        ?.filter(q => q.status === 'sent')
        .length || 0

      setData({
        totalRevenue,
        pendingRevenue,
        overdueInvoices,
        sentQuotes,
        recentInvoices: invoices?.slice(0, 5) || [],
        recentQuotes: quotes?.slice(0, 5) || [],
      })
      setIsLoading(false)
    }

    fetchData()
  }, [currentCompany])

  if (isLoading || !currentCompany) {
    return (
      <div className="p-8">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-1">Aperçu de votre activité</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Chiffre d'affaires
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalRevenue, currentCompany.default_currency as CurrencyCode)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Factures payées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              En attente
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.pendingRevenue, currentCompany.default_currency as CurrencyCode)}
            </div>
            <p className="text-xs text-gray-500 mt-1">À recevoir</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Factures impayées
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.overdueInvoices}
            </div>
            <p className="text-xs text-gray-500 mt-1">En retard</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Devis envoyés
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.sentQuotes}</div>
            <p className="text-xs text-gray-500 mt-1">En attente</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Factures récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune facture</p>
            ) : (
              <div className="space-y-3">
                {data.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{invoice.number}</p>
                      <p className="text-sm text-gray-500">{invoice.issue_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(Number(invoice.total), invoice.currency_code as CurrencyCode)}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">{invoice.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devis récents</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentQuotes.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucun devis</p>
            ) : (
              <div className="space-y-3">
                {data.recentQuotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{quote.number}</p>
                      <p className="text-sm text-gray-500">{quote.issue_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(Number(quote.total), quote.currency_code as CurrencyCode)}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">{quote.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
