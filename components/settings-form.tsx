'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { CURRENCIES } from '@/lib/currency'
import { Database } from '@/types/database'

type Company = Database['public']['Tables']['companies']['Row']

interface SettingsFormProps {
  company: Company
  onSuccess?: () => void
}

export function SettingsForm({ company, onSuccess }: SettingsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currency, setCurrency] = useState(company.default_currency)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const updates = {
      name: formData.get('name') as string,
      legal_name: formData.get('legal_name') as string,
      registration_number: formData.get('registration_number') as string,
      vat_number: formData.get('vat_number') as string,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      postal_code: formData.get('postal_code') as string,
      country: formData.get('country') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      website: formData.get('website') as string,
      default_currency: currency,
      invoice_prefix: formData.get('invoice_prefix') as string,
      quote_prefix: formData.get('quote_prefix') as string,
      default_tax_rate: parseFloat(formData.get('default_tax_rate') as string),
      payment_terms_days: parseInt(formData.get('payment_terms_days') as string),
    }

    const { error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', company.id)

    if (error) {
      setMessage('Erreur lors de la sauvegarde')
    } else {
      setMessage('Modifications enregistrees')
      onSuccess?.()
    }

    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className={`p-3 rounded-md text-sm ${message.includes('Erreur') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom de l'entreprise *</Label>
          <Input id="name" name="name" defaultValue={company.name} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal_name">Raison sociale</Label>
          <Input id="legal_name" name="legal_name" defaultValue={company.legal_name || ''} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="registration_number">SIRET / N enregistrement</Label>
          <Input id="registration_number" name="registration_number" defaultValue={company.registration_number || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vat_number">N TVA intracommunautaire</Label>
          <Input id="vat_number" name="vat_number" defaultValue={company.vat_number || ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adresse</Label>
        <Input id="address" name="address" defaultValue={company.address || ''} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" defaultValue={company.city || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postal_code">Code postal</Label>
          <Input id="postal_code" name="postal_code" defaultValue={company.postal_code || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" name="country" defaultValue={company.country} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={company.email || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telephone</Label>
          <Input id="phone" name="phone" defaultValue={company.phone || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Site web</Label>
          <Input id="website" name="website" defaultValue={company.website || ''} />
        </div>
      </div>

      <div className="border-t pt-4 mt-6">
        <h3 className="font-semibold mb-4">Parametres de facturation</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="default_currency">Devise par defaut</Label>
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
            <Label htmlFor="default_tax_rate">TVA par defaut (%)</Label>
            <Input
              id="default_tax_rate"
              name="default_tax_rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={company.default_tax_rate}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="invoice_prefix">Prefixe factures</Label>
            <Input id="invoice_prefix" name="invoice_prefix" defaultValue={company.invoice_prefix} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote_prefix">Prefixe devis</Label>
            <Input id="quote_prefix" name="quote_prefix" defaultValue={company.quote_prefix} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_terms_days">Delai de paiement (jours)</Label>
            <Input
              id="payment_terms_days"
              name="payment_terms_days"
              type="number"
              min="0"
              defaultValue={company.payment_terms_days}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  )
}
