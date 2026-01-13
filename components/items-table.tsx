'use client'

import { Database } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Pencil, Trash } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ItemDialog } from '@/components/item-dialog'
import { deleteItem } from '@/lib/actions/items'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatCurrency, CurrencyCode } from '@/lib/currency'

type Item = Database['public']['Tables']['items']['Row']

export function ItemsTable({ items, currency }: { items: Item[]; currency: string }) {
  const router = useRouter()
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  async function handleDelete(id: string) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      await deleteItem(id)
      router.refresh()
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">Aucun produit pour le moment</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Prix unitaire</TableHead>
              <TableHead>TVA</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="max-w-xs truncate">{item.description || '-'}</TableCell>
                <TableCell>{formatCurrency(Number(item.unit_price), currency as CurrencyCode)}</TableCell>
                <TableCell>{item.tax_rate}%</TableCell>
                <TableCell className="capitalize">{item.unit}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingItem(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingItem && (
        <ItemDialog
          companyId={editingItem.company_id}
          currency={currency}
          item={editingItem}
        >
          <div />
        </ItemDialog>
      )}
    </>
  )
}
