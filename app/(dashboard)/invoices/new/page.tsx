'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CURRENCIES, formatCurrency, CurrencyCode } from '@/lib/currency'
import { useCompany } from '@/lib/context/company-context'

interface LineItem {
  item_id?: string
  description: string
  quantity: number
  unit_price: number
  discount_rate: number
  tax_rate: number
}

export default function NewInvoicePage() {
  const router = useRouter()
  const { currentCompany } = useCompany()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [currency, setCurrency] = useState<string>(currentCompany?.default_currency || 'EUR')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + (currentCompany?.payment_terms_days || 30))
    return date.toISOString().split('T')[0]
  })
  const [lines, setLines] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, discount_rate: 0, tax_rate: currentCompany?.default_tax_rate || 20 }
  ])

  useEffect(() => {
    if (!currentCompany) return

    const supabase = createClient()

    async function fetchData() {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name')
      setClients(clientsData || [])

      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name')
      setItems(itemsData || [])
    }

    fetchData()
  }, [currentCompany])

  function addLine() {
    setLines([...lines, {
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_rate: 0,
      tax_rate: currentCompany?.default_tax_rate || 20
    }])
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof LineItem, value: any) {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find(i => i.id === itemId)
    if (item) {
      updateLine(index, 'item_id', itemId)
      updateLine(index, 'description', item.name)
      updateLine(index, 'unit_price', item.unit_price)
      updateLine(index, 'tax_rate', item.tax_rate)
    }
  }

  function calculateLineTotal(line: LineItem) {
    const subtotal = line.quantity * line.unit_price
    const discount = subtotal * (line.discount_rate / 100)
    const afterDiscount = subtotal - discount
    const tax = afterDiscount * (line.tax_rate / 100)
    return afterDiscount + tax
  }

  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0)
  const totalDiscount = lines.reduce((sum, line) => {
    const lineSubtotal = line.quantity * line.unit_price
    return sum + (lineSubtotal * (line.discount_rate / 100))
  }, 0)
  const afterDiscount = subtotal - totalDiscount
  const totalTax = lines.reduce((sum, line) => {
    const lineSubtotal = line.quantity * line.unit_price
    const lineDiscount = lineSubtotal * (line.discount_rate / 100)
    const lineAfterDiscount = lineSubtotal - lineDiscount
    return sum + (lineAfterDiscount * (line.tax_rate / 100))
  }, 0)
  const total = afterDiscount + totalTax

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentCompany || !selectedClient) return

    setIsSubmitting(true)
    const supabase = createClient()

    let calcSubtotal = 0
    let calcTaxTotal = 0
    let calcDiscountTotal = 0

    const linesWithTotals = lines.map((line, index) => {
      const lineSubtotal = line.quantity * line.unit_price
      const lineDiscount = lineSubtotal * (line.discount_rate / 100)
      const lineAfterDiscount = lineSubtotal - lineDiscount
      const lineTax = lineAfterDiscount * (line.tax_rate / 100)
      const lineTotal = lineAfterDiscount + lineTax

      calcSubtotal += lineSubtotal
      calcDiscountTotal += lineDiscount
      calcTaxTotal += lineTax

      return {
        ...line,
        line_total: lineTotal,
        sort_order: index,
      }
    })

    const calcTotal = calcSubtotal - calcDiscountTotal + calcTaxTotal

    const { data: company } = await supabase
      .from('companies')
      .select('invoice_prefix, next_invoice_number')
      .eq('id', currentCompany.id)
      .maybeSingle()

    if (!company) {
      setIsSubmitting(false)
      return
    }

    const invoiceNumber = `${company.invoice_prefix}-${new Date().getFullYear()}-${String(company.next_invoice_number).padStart(4, '0')}`

    await supabase
      .from('companies')
      .update({ next_invoice_number: company.next_invoice_number + 1 })
      .eq('id', currentCompany.id)

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        company_id: currentCompany.id,
        client_id: selectedClient,
        number: invoiceNumber,
        currency_code: currency,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: calcSubtotal,
        tax_total: calcTaxTotal,
        discount_total: calcDiscountTotal,
        total: calcTotal,
        balance_due: calcTotal,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      setIsSubmitting(false)
      return
    }

    const linesToInsert = linesWithTotals.map(line => ({
      invoice_id: invoice.id,
      item_id: line.item_id || null,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_rate: line.discount_rate,
      tax_rate: line.tax_rate,
      line_total: line.line_total,
      sort_order: line.sort_order,
    }))

    await supabase
      .from('invoice_lines')
      .insert(linesToInsert)

    router.push('/invoices')
    setIsSubmitting(false)
  }

  if (!currentCompany) return null

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Nouvelle facture</h1>
        <p className="text-gray-600 mt-1">Créez une nouvelle facture</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CURRENCIES).map(curr => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.symbol} {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issue_date">Date d'émission</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Date d'échéance</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lignes de facturation</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une ligne
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <Label className="text-xs">Produit/Description</Label>
                    <Select value={line.item_id} onValueChange={(value) => selectItem(index, value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Ou saisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(item => (
                          <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      className="mt-1 h-9"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs">Quantité</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="h-9"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-xs">Prix unitaire</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="h-9"
                      required
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="text-xs">Remise %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={line.discount_rate}
                      onChange={(e) => updateLine(index, 'discount_rate', parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="text-xs">TVA %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={line.tax_rate}
                      onChange={(e) => updateLine(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-1">
                    <Label className="text-xs">Total</Label>
                    <div className="h-9 flex items-center text-sm font-medium">
                      {formatCurrency(calculateLineTotal(line), currency as CurrencyCode)}
                    </div>
                  </div>

                  <div className="col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      className="h-9"
                      disabled={lines.length === 1}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total:</span>
                    <span className="font-medium">{formatCurrency(subtotal, currency as CurrencyCode)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Remise:</span>
                      <span>-{formatCurrency(totalDiscount, currency as CurrencyCode)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>TVA:</span>
                    <span className="font-medium">{formatCurrency(totalTax, currency as CurrencyCode)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(total, currency as CurrencyCode)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting || !selectedClient || lines.length === 0}>
            {isSubmitting ? 'Création...' : 'Créer la facture'}
          </Button>
        </div>
      </form>
    </div>
  )
}
