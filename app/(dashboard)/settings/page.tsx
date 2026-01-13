'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsForm } from '@/components/settings-form'
import { useCompany } from '@/lib/context/company-context'

export default function SettingsPage() {
  const { currentCompany } = useCompany()

  if (!currentCompany) {
    return (
      <div className="p-8">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-600 mt-1">Gérez les paramètres de votre entreprise</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations de l'entreprise</CardTitle>
            <CardDescription>
              Informations légales et coordonnées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm company={currentCompany} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturation</CardTitle>
            <CardDescription>
              Configuration de la numérotation et des paramètres par défaut
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Préfixe des factures:</span>
                <span className="font-medium">{currentCompany.invoice_prefix}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prochain numéro de facture:</span>
                <span className="font-medium">{currentCompany.next_invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Préfixe des devis:</span>
                <span className="font-medium">{currentCompany.quote_prefix}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prochain numéro de devis:</span>
                <span className="font-medium">{currentCompany.next_quote_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">TVA par défaut:</span>
                <span className="font-medium">{currentCompany.default_tax_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Délai de paiement:</span>
                <span className="font-medium">{currentCompany.payment_terms_days} jours</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
