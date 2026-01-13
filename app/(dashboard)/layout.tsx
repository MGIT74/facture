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
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: memberships } = await supabase
        .from('company_members')
        .select('*, companies(*)')
        .eq('user_id', session.user.id)

      const userCompanies = memberships?.map(m => m.companies).filter(Boolean) || []

      if (userCompanies.length === 0) {
        router.replace('/onboarding')
        return
      }

      setCompanies(userCompanies)
      setIsLoading(false)
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
