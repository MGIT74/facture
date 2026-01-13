'use client'

import { useState, ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientDialogProps {
  children: ReactNode
  companyId: string
  client?: Client
  onSuccess?: () => void
}

export function ClientDialog({ children, companyId, client, onSuccess }: ClientDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const data = {
      company_id: companyId,
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      address: formData.get('address') as string || null,
      city: formData.get('city') as string || null,
      postal_code: formData.get('postal_code') as string || null,
      country: formData.get('country') as string || null,
      vat_number: formData.get('vat_number') as string || null,
      notes: formData.get('notes') as string || null,
    }

    let result
    if (client) {
      result = await supabase
        .from('clients')
        .update(data)
        .eq('id', client.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('clients')
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
          <DialogDescription>
            {client ? 'Modifiez les informations du client' : 'Ajoutez un nouveau client'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={client?.name}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={client?.email || ''}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telephone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={client?.phone || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vat_number">N TVA</Label>
                <Input
                  id="vat_number"
                  name="vat_number"
                  defaultValue={client?.vat_number || ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                name="address"
                defaultValue={client?.address || ''}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={client?.city || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Code postal</Label>
                <Input
                  id="postal_code"
                  name="postal_code"
                  defaultValue={client?.postal_code || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  name="country"
                  defaultValue={client?.country || ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={client?.notes || ''}
              />
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
