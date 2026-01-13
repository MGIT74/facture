import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function PaymentsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
          <p className="text-gray-600 mt-1">Gérez vos paiements</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Enregistrer un paiement
        </Button>
      </div>

      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">Aucun paiement pour le moment</p>
      </div>
    </div>
  )
}
