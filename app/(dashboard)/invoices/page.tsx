'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { InvoicesTable } from '@/components/invoices-table'
import Link from 'next/link'
import { useCompany } from '@/lib/context/company-context'

export default function InvoicesPage() {
  const { currentCompany } = useCompany()
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCompany) return

    const supabase = createClient()

    async function fetchInvoices() {
      const { data } = await supabase
        .from('invoices')
        .select('*, clients(name)')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })

      setInvoices(data || [])
      setIsLoading(false)
    }

    fetchInvoices()
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
          <h1 className="text-3xl font-bold text-gray-900">Factures</h1>
          <p className="text-gray-600 mt-1">Gérez vos factures</p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle facture
          </Button>
        </Link>
      </div>

      <InvoicesTable invoices={invoices} />
    </div>
  )
}
