'use client'

import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCompany } from '@/lib/context/company-context'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCIES } from '@/lib/currency'
import { useRouter } from 'next/navigation'

export function CompanySwitcher() {
  const { currentCompany, companies, setCurrentCompany } = useCompany()
  const [open, setOpen] = useState(false)
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  async function handleCreateCompany(formData: FormData) {
    setIsCreating(true)

    const response = await fetch('/api/companies', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (result.data) {
      setShowNewCompanyDialog(false)
      router.refresh()
    }

    setIsCreating(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Sélectionner une entreprise"
            className="w-full justify-between"
          >
            <span className="truncate">{currentCompany?.name || 'Sélectionner...'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Rechercher..." />
              <CommandEmpty>Aucune entreprise trouvée.</CommandEmpty>
              <CommandGroup heading="Entreprises">
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    onSelect={() => {
                      setCurrentCompany(company)
                      setOpen(false)
                      router.refresh()
                    }}
                    className="text-sm"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        currentCompany?.id === company.id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {company.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setShowNewCompanyDialog(true)
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Créer une entreprise
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une nouvelle entreprise</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle entreprise à votre compte
            </DialogDescription>
          </DialogHeader>
          <form action={handleCreateCompany}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'entreprise *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ma Nouvelle Société"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_currency">Devise par défaut</Label>
                <Select name="default_currency" defaultValue="EUR">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CURRENCIES).map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.symbol} {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewCompanyDialog(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Création...' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
