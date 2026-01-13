'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ItemsTable } from '@/components/items-table'
import { ItemDialog } from '@/components/item-dialog'
import { useCompany } from '@/lib/context/company-context'

export default function ItemsPage() {
  const { currentCompany } = useCompany()
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCompany) return

    const supabase = createClient()

    async function fetchItems() {
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })

      setItems(data || [])
      setIsLoading(false)
    }

    fetchItems()
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produits & Services</h1>
          <p className="text-gray-600 mt-1">Gérez votre catalogue</p>
        </div>
        <ItemDialog companyId={currentCompany.id} currency={currentCompany.default_currency}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau produit
          </Button>
        </ItemDialog>
      </div>

      <ItemsTable items={items} currency={currentCompany.default_currency} />
    </div>
  )
}
