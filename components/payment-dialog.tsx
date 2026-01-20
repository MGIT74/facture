'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createPayment } from '@/lib/actions/payments'
import { formatCurrency } from '@/lib/currency'

interface Invoice {
  id: string
  number: string
  total: number
  balance_due: number
  currency_code: string
  client: { name: string } | null
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  unpaidInvoices: Invoice[]
  currency: string
}

const paymentMethods = [
  { value: 'card', label: 'Carte bancaire' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Espèces' },
  { value: 'check', label: 'Chèque' },
  { value: 'other', label: 'Autre' },
]

export function PaymentDialog({ open, onOpenChange, companyId, unpaidInvoices, currency }: PaymentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [invoiceId, setInvoiceId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const selectedInvoice = unpaidInvoices.find(inv => inv.id === invoiceId)

  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id)
    const invoice = unpaidInvoices.find(inv => inv.id === id)
    if (invoice) {
      setAmount(invoice.balance_due.toString())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await createPayment({
        company_id: companyId,
        invoice_id: invoiceId || undefined,
        amount: parseFloat(amount),
        currency: selectedInvoice?.currency_code || currency,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference: reference || undefined,
        notes: notes || undefined,
      })
      onOpenChange(false)
      setInvoiceId('')
      setAmount('')
      setReference('')
      setNotes('')
    } catch (error) {
      console.error('Error creating payment:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice">Facture (optionnel)</Label>
            <Select value={invoiceId || 'none'} onValueChange={(val) => handleInvoiceChange(val === 'none' ? '' : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une facture" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Paiement sans facture</SelectItem>
                {unpaidInvoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.number} - {invoice.client?.name} ({formatCurrency(invoice.balance_due, invoice.currency_code)} restant)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Date de paiement *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Moyen de paiement *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Référence</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: Virement #12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes additionnelles..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !amount}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
