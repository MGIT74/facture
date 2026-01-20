'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Wallet, TrendingUp, Clock, CreditCard } from 'lucide-react'
import { useCompany } from '@/lib/context/company-context'
import { getPayments, getPaymentIntegrations, getUnpaidInvoices } from '@/lib/actions/payments'
import { PaymentsTable } from '@/components/payments-table'
import { PaymentDialog } from '@/components/payment-dialog'
import { IntegrationSettings } from '@/components/integration-settings'
import { formatCurrency } from '@/lib/currency'

interface Payment {
  id: string
  amount: number
  currency: string
  payment_status: string
  provider: string
  payment_method: string
  payment_date: string
  reference: string | null
  notes: string | null
  created_at: string
  invoice: {
    id: string
    number: string
    client: { name: string } | null
  } | null
}

interface Integration {
  id: string
  provider: string
  is_enabled: boolean
  config: Record<string, string>
}

interface UnpaidInvoice {
  id: string
  number: string
  total: number
  balance_due: number
  currency_code: string
  client: { name: string } | null
}

export default function PaymentsPage() {
  const { selectedCompany } = useCompany()
  const [payments, setPayments] = useState<Payment[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (selectedCompany?.id) {
      loadData()
    }
  }, [selectedCompany?.id])

  const loadData = async () => {
    if (!selectedCompany?.id) return
    setLoading(true)
    try {
      const [paymentsData, integrationsData, invoicesData] = await Promise.all([
        getPayments(selectedCompany.id),
        getPaymentIntegrations(selectedCompany.id),
        getUnpaidInvoices(selectedCompany.id),
      ])
      setPayments(paymentsData || [])
      setIntegrations(integrationsData || [])
      setUnpaidInvoices(invoicesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalReceived = payments
    .filter(p => p.payment_status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const pendingPayments = payments.filter(p => p.payment_status === 'pending')
  const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const thisMonthPayments = payments.filter(p => {
    const paymentDate = new Date(p.payment_date)
    const now = new Date()
    return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear()
  })
  const thisMonthTotal = thisMonthPayments
    .filter(p => p.payment_status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const activeIntegrations = integrations.filter(i => i.is_enabled).length

  const currency = selectedCompany?.default_currency || 'EUR'

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
          <p className="text-gray-600 mt-1">Gérez vos paiements et intégrations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Enregistrer un paiement
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total reçu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalReceived, currency)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {payments.filter(p => p.payment_status === 'completed').length} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Ce mois
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(thisMonthTotal, currency)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {thisMonthPayments.length} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En attente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(totalPending, currency)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {pendingPayments.length} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Intégrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {activeIntegrations}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {activeIntegrations === 0 ? 'Aucune active' : activeIntegrations === 1 ? 'intégration active' : 'intégrations actives'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentsTable payments={payments} />
        </TabsContent>

        <TabsContent value="integrations">
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connectez vos services de paiement
              </h3>
              <p className="text-gray-600">
                Intégrez Stripe pour accepter les cartes bancaires ou Wise pour recevoir des virements internationaux à moindre frais.
              </p>
            </div>

            <IntegrationSettings
              companyId={selectedCompany?.id || ''}
              integrations={integrations}
            />
          </div>
        </TabsContent>
      </Tabs>

      {selectedCompany && (
        <PaymentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={selectedCompany.id}
          unpaidInvoices={unpaidInvoices}
          currency={currency}
        />
      )}
    </div>
  )
}
