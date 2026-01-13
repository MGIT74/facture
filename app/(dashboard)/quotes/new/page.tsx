'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { createQuote } from '@/lib/actions/quotes'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { useCompany } from '@/lib/context/company-context'

interface Client {
  id: string
  name: string
}

interface Item {
  id: string
  name: string
  unit_price: number
  tax_rate: number
}

interface QuoteLine {
  item_id?: string
  description: string
  quantity: number
  unit_price: number
  discount_rate: number
  tax_rate: number
}

export default function NewQuotePage() {
  const router = useRouter()
  const { selectedCompany } = useCompany()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<Item[]>([])

  const [formData, setFormData] = useState({
    client_id: '',
    currency_code: selectedCompany?.default_currency || 'EUR',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: (() => {
      const date = new Date()
      date.setDate(date.getDate() + 30)
      return date.toISOString().split('T')[0]
    })(),
    notes: '',
    terms: '',
  })

  const [lines, setLines] = useState<QuoteLine[]>([
    {
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_rate: 0,
      tax_rate: selectedCompany?.default_tax_rate || 20,
    },
  ])

  useEffect(() => {
    if (!selectedCompany) return

    fetch(`/api/clients?company_id=${selectedCompany.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClients(data)
        } else if (data.error) {
          console.error('Error fetching clients:', data.error)
          toast.error('Erreur lors du chargement des clients')
        }
      })
      .catch((err) => {
        console.error('Fetch clients error:', err)
        toast.error('Erreur lors du chargement des clients')
      })

    fetch(`/api/items?company_id=${selectedCompany.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data)
        } else if (data.error) {
          console.error('Error fetching items:', data.error)
        }
      })
      .catch((err) => {
        console.error('Fetch items error:', err)
      })
  }, [selectedCompany])

  const addLine = () => {
    setLines([
      ...lines,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_rate: 0,
        tax_rate: selectedCompany?.default_tax_rate || 20,
      },
    ])
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const updateLine = (index: number, field: keyof QuoteLine, value: any) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (item) {
      updateLine(index, 'item_id', itemId)
      updateLine(index, 'description', item.name)
      updateLine(index, 'unit_price', Number(item.unit_price))
      updateLine(index, 'tax_rate', Number(item.tax_rate))
    }
  }

  const calculateLineTotal = (line: QuoteLine) => {
    const subtotal = line.quantity * line.unit_price
    const discount = subtotal * (line.discount_rate / 100)
    const afterDiscount = subtotal - discount
    const tax = afterDiscount * (line.tax_rate / 100)
    return afterDiscount + tax
  }

  const calculateTotals = () => {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0

    lines.forEach((line) => {
      const lineSubtotal = line.quantity * line.unit_price
      const lineDiscount = lineSubtotal * (line.discount_rate / 100)
      const lineAfterDiscount = lineSubtotal - lineDiscount
      const lineTax = lineAfterDiscount * (line.tax_rate / 100)

      subtotal += lineSubtotal
      discountTotal += lineDiscount
      taxTotal += lineTax
    })

    const total = subtotal - discountTotal + taxTotal

    return { subtotal, discountTotal, taxTotal, total }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCompany) {
      toast.error('Aucune entreprise sélectionnée')
      return
    }

    if (!formData.client_id) {
      toast.error('Veuillez sélectionner un client')
      return
    }

    if (lines.length === 0 || !lines[0].description) {
      toast.error('Veuillez ajouter au moins une ligne')
      return
    }

    setLoading(true)

    const result = await createQuote(selectedCompany.id, {
      ...formData,
      lines,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Devis créé avec succès')
      router.push('/quotes')
    }
  }

  const totals = calculateTotals()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Nouveau devis</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="client_id">Client *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, client_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currency_code">Devise</Label>
              <Select
                value={formData.currency_code}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency_code: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="issue_date">Date d'émission</Label>
              <Input
                type="date"
                value={formData.issue_date}
                onChange={(e) =>
                  setFormData({ ...formData, issue_date: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="expiry_date">Date d'expiration</Label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiry_date: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lignes du devis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-4 p-4 border rounded-lg bg-gray-50"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Article (optionnel)</Label>
                      <Select
                        value={line.item_id}
                        onValueChange={(value) => handleItemSelect(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un article" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Description *</Label>
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(index, 'description', e.target.value)
                        }
                        placeholder="Description de la prestation"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-5">
                    <div>
                      <Label>Quantité</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, 'quantity', parseFloat(e.target.value))
                        }
                      />
                    </div>

                    <div>
                      <Label>Prix unitaire</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unit_price}
                        onChange={(e) =>
                          updateLine(index, 'unit_price', parseFloat(e.target.value))
                        }
                      />
                    </div>

                    <div>
                      <Label>Remise (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={line.discount_rate}
                        onChange={(e) =>
                          updateLine(index, 'discount_rate', parseFloat(e.target.value))
                        }
                      />
                    </div>

                    <div>
                      <Label>TVA (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.tax_rate}
                        onChange={(e) =>
                          updateLine(index, 'tax_rate', parseFloat(e.target.value))
                        }
                      />
                    </div>

                    <div>
                      <Label>Total</Label>
                      <div className="flex items-center h-10 px-3 border rounded-md bg-white font-medium">
                        {formatCurrency(calculateLineTotal(line), formData.currency_code)}
                      </div>
                    </div>
                  </div>

                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      className="w-fit text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer la ligne
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addLine}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une ligne
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span className="font-medium">
                  {formatCurrency(totals.subtotal, formData.currency_code)}
                </span>
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Remise:</span>
                  <span className="font-medium">
                    -{formatCurrency(totals.discountTotal, formData.currency_code)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>TVA:</span>
                <span className="font-medium">
                  {formatCurrency(totals.taxTotal, formData.currency_code)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>
                  {formatCurrency(totals.total, formData.currency_code)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes et conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Notes additionnelles..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="terms">Conditions</Label>
              <Textarea
                id="terms"
                value={formData.terms}
                onChange={(e) =>
                  setFormData({ ...formData, terms: e.target.value })
                }
                placeholder="Conditions de vente..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Création...' : 'Créer le devis'}
          </Button>
        </div>
      </form>
    </div>
  )
}
