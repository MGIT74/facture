'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Eye, Download, Trash } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { deleteInvoice } from '@/lib/actions/invoices'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatShortDate, CurrencyCode } from '@/lib/currency'
import Link from 'next/link'

interface Invoice {
  id: string
  number: string
  status: string
  total: number
  currency_code: string
  issue_date: string
  due_date: string
  clients: { name: string } | null
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
    if (confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      await deleteInvoice(id)
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${invoice.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(invoice.id)}
                        className="text-red-600"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
