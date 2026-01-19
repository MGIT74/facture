'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader as Loader2 } from 'lucide-react'
import { CURRENCIES } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('EUR')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
        }
      } catch (err) {
        console.error('Auth error:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        window.location.href = '/login'
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    if (!user) {
      setError('Non authentifié. Veuillez vous reconnecter.')
      setIsSubmitting(false)
      return
    }

    const companyData = {
      name: formData.get('name') as string,
      legal_name: formData.get('legal_name') as string || null,
      email: formData.get('email') as string || null,
      country: formData.get('country') as string || 'FR',
      default_currency: currency,
      owner_id: user.id,
    }

    const { error: insertError } = await supabase
      .from('companies')
      .insert(companyData)
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setIsSubmitting(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-gray-600">Vous devez vous connecter pour continuer.</p>
              <Button onClick={() => router.push('/login')}>
                Se connecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Bienvenue sur Facturio</CardTitle>
          <CardDescription>
            Creez votre premiere entreprise pour commencer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'entreprise *</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Ma Société SARL"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal_name">Raison sociale</Label>
                <Input
                  id="legal_name"
                  name="legal_name"
                  type="text"
                  placeholder="Ma Société SARL"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_currency">Devise par défaut *</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CURRENCIES).map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.symbol} {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    name="country"
                    type="text"
                    defaultValue="FR"
                    placeholder="FR"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email de contact</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="contact@maentreprise.com"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Création...' : 'Créer mon entreprise'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Vous pourrez compléter ces informations plus tard dans les paramètres
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
