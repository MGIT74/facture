'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CompanySwitcher } from '@/components/company-switcher'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Receipt,
  CreditCard,
  Settings,
  LogOut,
  BarChart3,
} from 'lucide-react'
import { signOut } from '@/lib/actions/auth'
import { useCompany } from '@/lib/context/company-context'

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Produits & Services', href: '/items', icon: Package },
  { name: 'Devis', href: '/quotes', icon: FileText },
  { name: 'Factures', href: '/invoices', icon: Receipt },
  { name: 'Paiements', href: '/payments', icon: CreditCard },
  { name: 'Rapports', href: '/reports', icon: BarChart3 },
  { name: 'Paramètres', href: '/settings', icon: Settings },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { currentCompany, isLoading } = useCompany()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Facturio</h1>
          <CompanySwitcher />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-gray-600"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Déconnexion
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  )
}
