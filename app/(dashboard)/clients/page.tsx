'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ClientsTable } from '@/components/clients-table'
import { ClientDialog } from '@/components/client-dialog'
import { useCompany } from '@/lib/context/company-context'

export default function ClientsPage() {
  const { currentCompany } = useCompany()
  const [clients, setClients] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCompany) return

    const supabase = createClient()

    async function fetchClients() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })

      setClients(data || [])
      setIsLoading(false)
    }

    fetchClients()
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
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">Gérez vos clients</p>
        </div>
        <ClientDialog companyId={currentCompany.id}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau client
          </Button>
        </ClientDialog>
      </div>

      <ClientsTable clients={clients} />
    </div>
  )
}
