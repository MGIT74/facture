'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CompanyProvider } from '@/lib/context/company-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Loader2 } from 'lucide-react'

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [companies, setCompanies] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()

    async function checkAuth() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          window.location.href = '/login'
          return
        }

        if (!session) {
          window.location.href = '/login'
          return
        }

        const { data: memberships, error: memberError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', session.user.id)

        if (memberError) {
          console.error('Error fetching memberships:', memberError)
          setError('Erreur lors du chargement des entreprises')
          setIsLoading(false)
          return
        }

        if (!memberships || memberships.length === 0) {
          window.location.href = '/onboarding'
          return
        }

        const companyIds = memberships.map(m => m.company_id)
        const { data: userCompanies, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .in('id', companyIds)

        if (companyError) {
          console.error('Error fetching companies:', companyError)
          setError('Erreur lors du chargement des entreprises')
          setIsLoading(false)
          return
        }

        if (!userCompanies || userCompanies.length === 0) {
          window.location.href = '/onboarding'
          return
        }

        setCompanies(userCompanies)
        setIsLoading(false)
      } catch (err) {
        console.error('Auth check error:', err)
        setError('Une erreur est survenue')
        setIsLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login'
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:underline"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <CompanyProvider initialCompanies={companies}>
      <DashboardLayout>{children}</DashboardLayout>
    </CompanyProvider>
  )
}
