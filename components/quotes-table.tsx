'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DocumentActions } from '@/components/document-actions'
import { deleteQuote, updateQuote, convertQuoteToInvoice, duplicateQuote } from '@/lib/actions/quotes'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Quote {
  id: string
  number: string
  issue_date: string
  expiry_date: string
  status: string
  total: number
  currency_code: string
  clients: { name: string; email?: string }
}

interface QuotesTableProps {
  quotes: Quote[]
}

const statusConfig = {
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
  sent: { label: 'Envoyé', className: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepté', className: 'bg-green-100 text-green-800' },
  declined: { label: 'Refusé', className: 'bg-red-100 text-red-800' },
  expired: { label: 'Expiré', className: 'bg-orange-100 text-orange-800' },
}

export function QuotesTable({ quotes }: QuotesTableProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setLoading(id)
    const result = await deleteQuote(id)
    setLoading(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Devis supprimé')
      router.refresh()
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    setLoading(id)
    const result = await updateQuote(id, { status })
    setLoading(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Statut mis à jour')
      router.refresh()
    }
  }

  const handleConvertToInvoice = async (id: string) => {
    setLoading(id)
    const result = await convertQuoteToInvoice(id)
    setLoading(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Devis converti en facture')
      router.push('/invoices')
    }
  }

  const handleDuplicate = async (id: string) => {
    setLoading(id)
    const result = await duplicateQuote(id)
    setLoading(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Devis dupliqué')
      router.refresh()
    }
  }

  return (
    <div className="border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numéro</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Expiration</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                Aucun devis pour le moment
              </TableCell>
            </TableRow>
          ) : (
            quotes.map((quote) => {
              const config = statusConfig[quote.status as keyof typeof statusConfig]
              return (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.number}</TableCell>
                  <TableCell>{quote.clients.name}</TableCell>
                  <TableCell>
                    {new Date(quote.issue_date).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    {new Date(quote.expiry_date).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <Badge className={config.className}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(quote.total), quote.currency_code)}
                  </TableCell>
                  <TableCell>
                    <DocumentActions
                      type="quote"
                      document={{
                        id: quote.id,
                        number: quote.number,
                        status: quote.status,
                        client_email: quote.clients.email,
                        client_name: quote.clients.name,
                      }}
                      onStatusChange={(status) => handleStatusChange(quote.id, status)}
                      onDelete={() => handleDelete(quote.id)}
                      onDuplicate={() => handleDuplicate(quote.id)}
                      onConvertToInvoice={() => handleConvertToInvoice(quote.id)}
                    />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
