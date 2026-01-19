'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CompanyProvider } from '@/lib/context/company-context'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [companies, setCompanies] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const { data: memberships, error: memberError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', session.user.id)

        if (memberError) {
          console.error('Error fetching memberships:', memberError)
          setIsLoading(false)
          return
        }

        if (!memberships || memberships.length === 0) {
          router.replace('/onboarding')
          return
        }

        const companyIds = memberships.map(m => m.company_id)
        const { data: userCompanies, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .in('id', companyIds)

        if (companyError) {
          console.error('Error fetching companies:', companyError)
          setIsLoading(false)
          return
        }

        if (!userCompanies || userCompanies.length === 0) {
          router.replace('/onboarding')
          return
        }

        setCompanies(userCompanies)
        setIsLoading(false)
      } catch (err) {
        console.error('Auth check error:', err)
        setIsLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <CompanyProvider initialCompanies={companies}>
      <DashboardLayout>{children}</DashboardLayout>
    </CompanyProvider>
  )
}
