'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DocumentActions } from '@/components/document-actions'
import { deleteInvoice, updateInvoice } from '@/lib/actions/invoices'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatShortDate, CurrencyCode } from '@/lib/currency'
import { toast } from 'sonner'

interface Invoice {
  id: string
  number: string
  status: string
  total: number
  currency_code: string
  issue_date: string
  due_date: string
  clients: { name: string; email?: string } | null
}

const statusConfig = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Envoyée', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Payée', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'En retard', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
}

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter()

  async function handleDelete(id: string) {
    const result = await deleteInvoice(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Facture supprimée')
      router.refresh()
    }
  }

  async function handleStatusChange(id: string, status: string) {
    const updates: { status: string; paid_date?: string } = { status }
    if (status === 'paid') {
      updates.paid_date = new Date().toISOString().split('T')[0]
    }
    const result = await updateInvoice(id, updates)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Statut mis à jour')
      router.refresh()
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">Aucune facture pour le moment</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numéro</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const status = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.draft
            return (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.number}</TableCell>
                <TableCell>{invoice.clients?.name || '-'}</TableCell>
                <TableCell>{formatShortDate(invoice.issue_date)}</TableCell>
                <TableCell>{formatShortDate(invoice.due_date)}</TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(Number(invoice.total), invoice.currency_code as CurrencyCode)}
                </TableCell>
                <TableCell>
                  <Badge className={status.color}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <DocumentActions
                    type="invoice"
                    document={{
                      id: invoice.id,
                      number: invoice.number,
                      status: invoice.status,
                      client_email: invoice.clients?.email,
                      client_name: invoice.clients?.name,
                    }}
                    onStatusChange={(status) => handleStatusChange(invoice.id, status)}
                    onDelete={() => handleDelete(invoice.id)}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
