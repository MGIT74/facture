'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { MoreHorizontal, Trash2, CreditCard, Building2, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { deletePayment } from '@/lib/actions/payments'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Payment {
  id: string
  amount: number
  currency: string
  payment_status: string
  provider: string
  payment_method: string
  payment_date: string
  reference: string | null
  notes: string | null
  created_at: string
  invoice: {
    id: string
    number: string
    client: { name: string } | null
  } | null
}

interface PaymentsTableProps {
  payments: Payment[]
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'En attente', variant: 'secondary' },
  completed: { label: 'Complété', variant: 'default' },
  failed: { label: 'Échoué', variant: 'destructive' },
  refunded: { label: 'Remboursé', variant: 'outline' },
}

const methodLabels: Record<string, string> = {
  card: 'Carte bancaire',
  bank_transfer: 'Virement',
  cash: 'Espèces',
  check: 'Chèque',
  other: 'Autre',
}

const providerIcons: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-4 w-4 text-[#635BFF]" />,
  wise: <Building2 className="h-4 w-4 text-[#9FE870]" />,
  manual: <Wallet className="h-4 w-4 text-gray-500" />,
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deletePayment(deleteId)
    } catch (error) {
      console.error('Error deleting payment:', error)
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Aucun paiement pour le moment</p>
        <p className="text-sm text-gray-400 mt-1">Les paiements apparaîtront ici</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Date</TableHead>
              <TableHead>Facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const status = statusLabels[payment.payment_status] || statusLabels.completed
              return (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    {payment.invoice ? (
                      <span className="text-blue-600">{payment.invoice.number}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {payment.invoice?.client?.name || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>{methodLabels[payment.payment_method] || payment.payment_method}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {providerIcons[payment.provider]}
                      <span className="capitalize">{payment.provider}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteId(payment.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le paiement sera supprimé et le solde de la facture associée sera mis à jour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
