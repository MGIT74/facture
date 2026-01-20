'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CreditCard, Building2, Check, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { savePaymentIntegration, toggleIntegration } from '@/lib/actions/payments'

interface Integration {
  id: string
  provider: string
  is_enabled: boolean
  config: Record<string, string>
}

interface IntegrationSettingsProps {
  companyId: string
  integrations: Integration[]
}

export function IntegrationSettings({ companyId, integrations }: IntegrationSettingsProps) {
  const [configDialog, setConfigDialog] = useState<'stripe' | 'wise' | null>(null)

  const stripeIntegration = integrations.find(i => i.provider === 'stripe')
  const wiseIntegration = integrations.find(i => i.provider === 'wise')

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <IntegrationCard
          provider="stripe"
          title="Stripe"
          description="Acceptez les paiements par carte bancaire via Stripe"
          icon={<CreditCard className="h-6 w-6" />}
          integration={stripeIntegration}
          companyId={companyId}
          onConfigure={() => setConfigDialog('stripe')}
          color="bg-[#635BFF]"
        />
        <IntegrationCard
          provider="wise"
          title="Wise"
          description="Recevez des virements internationaux via Wise"
          icon={<Building2 className="h-6 w-6" />}
          integration={wiseIntegration}
          companyId={companyId}
          onConfigure={() => setConfigDialog('wise')}
          color="bg-[#9FE870]"
        />
      </div>

      <StripeConfigDialog
        open={configDialog === 'stripe'}
        onOpenChange={(open) => !open && setConfigDialog(null)}
        companyId={companyId}
        integration={stripeIntegration}
      />

      <WiseConfigDialog
        open={configDialog === 'wise'}
        onOpenChange={(open) => !open && setConfigDialog(null)}
        companyId={companyId}
        integration={wiseIntegration}
      />
    </>
  )
}

interface IntegrationCardProps {
  provider: 'stripe' | 'wise'
  title: string
  description: string
  icon: React.ReactNode
  integration?: Integration
  companyId: string
  onConfigure: () => void
  color: string
}

function IntegrationCard({ provider, title, description, icon, integration, companyId, onConfigure, color }: IntegrationCardProps) {
  const [toggling, setToggling] = useState(false)
  const isConfigured = integration && Object.keys(integration.config).length > 0
  const isEnabled = integration?.is_enabled || false

  const handleToggle = async (enabled: boolean) => {
    if (!isConfigured) {
      onConfigure()
      return
    }

    setToggling(true)
    try {
      await toggleIntegration(companyId, provider, enabled)
    } catch (error) {
      console.error('Error toggling integration:', error)
    } finally {
      setToggling(false)
    }
  }

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color} text-white`}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {title}
                {isConfigured && isEnabled && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <Check className="h-3 w-3 mr-1" />
                    Actif
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {isConfigured ? (
              <span className="text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                Configuré
              </span>
            ) : (
              <span>Non configuré</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onConfigure}>
            {isConfigured ? 'Modifier' : 'Configurer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  integration?: Integration
}

function StripeConfigDialog({ open, onOpenChange, companyId, integration }: ConfigDialogProps) {
  const [loading, setLoading] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [secretKey, setSecretKey] = useState(integration?.config?.secret_key || '')
  const [publishableKey, setPublishableKey] = useState(integration?.config?.publishable_key || '')
  const [webhookSecret, setWebhookSecret] = useState(integration?.config?.webhook_secret || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await savePaymentIntegration({
        company_id: companyId,
        provider: 'stripe',
        is_enabled: true,
        config: {
          secret_key: secretKey,
          publishable_key: publishableKey,
          webhook_secret: webhookSecret,
        },
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving Stripe config:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#635BFF] text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            Configuration Stripe
          </DialogTitle>
          <DialogDescription>
            Connectez votre compte Stripe pour accepter les paiements par carte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">Comment obtenir vos clés API ?</p>
            <p className="text-blue-600">
              Rendez-vous sur{' '}
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                dashboard.stripe.com/apikeys
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publishableKey">Clé publique (Publishable key) *</Label>
            <Input
              id="publishableKey"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_live_..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretKey">Clé secrète (Secret key) *</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_..."
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Secret du webhook (optionnel)</Label>
            <Input
              id="webhookSecret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_..."
            />
            <p className="text-xs text-gray-500">
              Nécessaire pour recevoir les notifications de paiement automatiquement.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !secretKey || !publishableKey}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WiseConfigDialog({ open, onOpenChange, companyId, integration }: ConfigDialogProps) {
  const [loading, setLoading] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKey, setApiKey] = useState(integration?.config?.api_key || '')
  const [profileId, setProfileId] = useState(integration?.config?.profile_id || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await savePaymentIntegration({
        company_id: companyId,
        provider: 'wise',
        is_enabled: true,
        config: {
          api_key: apiKey,
          profile_id: profileId,
        },
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving Wise config:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#9FE870] text-gray-900">
              <Building2 className="h-5 w-5" />
            </div>
            Configuration Wise
          </DialogTitle>
          <DialogDescription>
            Connectez votre compte Wise pour recevoir des virements internationaux.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
            <p className="font-medium mb-1">Comment obtenir vos identifiants API ?</p>
            <p className="text-green-600">
              Rendez-vous sur{' '}
              <a
                href="https://wise.com/settings/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                wise.com/settings/api-tokens
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Clé API *</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Votre clé API Wise"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profileId">ID du profil (Profile ID) *</Label>
            <Input
              id="profileId"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="Ex: 12345678"
              required
            />
            <p className="text-xs text-gray-500">
              Trouvez votre Profile ID dans les paramètres de votre compte Wise.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !apiKey || !profileId}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
