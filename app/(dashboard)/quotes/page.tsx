'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { QuotesTable } from '@/components/quotes-table'
import { useCompany } from '@/lib/context/company-context'

export default function QuotesPage() {
  const { currentCompany } = useCompany()
  const [quotes, setQuotes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentCompany) return

    const supabase = createClient()

    async function fetchQuotes() {
      const { data } = await supabase
        .from('quotes')
        .select('*, clients(name)')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })

      setQuotes(data || [])
      setIsLoading(false)
    }

    fetchQuotes()
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
          <h1 className="text-3xl font-bold text-gray-900">Devis</h1>
          <p className="text-gray-600 mt-1">Gérez vos devis</p>
        </div>
        <Link href="/quotes/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      <QuotesTable quotes={quotes} />
    </div>
  )
}
