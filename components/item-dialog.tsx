'use client'

import { useState, ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']

interface ItemDialogProps {
  children: ReactNode
  companyId: string
  currency: string
  item?: Item
  onSuccess?: () => void
}

export function ItemDialog({ children, companyId, currency, item, onSuccess }: ItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [unit, setUnit] = useState(item?.unit || 'unit')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const data = {
      company_id: companyId,
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      unit_price: parseFloat(formData.get('unit_price') as string),
      tax_rate: parseFloat(formData.get('tax_rate') as string) || 20.00,
      unit: unit,
    }

    let result
    if (item) {
      result = await supabase
        .from('items')
        .update(data)
        .eq('id', item.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('items')
        .insert(data)
        .select()
        .single()
    }

    if (result.data) {
      setOpen(false)
      onSuccess?.()
    }

    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          <DialogDescription>
            {item ? 'Modifiez les informations du produit' : 'Ajoutez un nouveau produit ou service'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={item?.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={item?.description || ''}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_price">Prix unitaire ({currency}) *</Label>
                <Input
                  id="unit_price"
                  name="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item?.unit_price}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_rate">TVA (%) *</Label>
                <Input
                  id="tax_rate"
                  name="tax_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={item?.tax_rate || 20}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unite</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Unite</SelectItem>
                  <SelectItem value="hour">Heure</SelectItem>
                  <SelectItem value="day">Jour</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="year">Annee</SelectItem>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="kg">Kilogramme</SelectItem>
                  <SelectItem value="liter">Litre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
