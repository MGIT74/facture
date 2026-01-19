'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { Database } from '@/types/database'

type Company = Database['public']['Tables']['companies']['Row']

interface CompanyContextType {
  currentCompany: Company | null
  companies: Company[]
  setCurrentCompany: (company: Company) => void
  setCompanies: (companies: Company[]) => void
  isLoading: boolean
}

const CompanyContext = createContext<CompanyContextType>({
  currentCompany: null,
  companies: [],
  setCurrentCompany: () => {},
  setCompanies: () => {},
  isLoading: true,
})

function getInitialCompany(companies: Company[]): Company | null {
  if (typeof window === 'undefined' || companies.length === 0) return companies[0] || null
  const savedCompanyId = localStorage.getItem('currentCompanyId')
  if (savedCompanyId) {
    const company = companies.find(c => c.id === savedCompanyId)
    if (company) return company
  }
  return companies[0] || null
}

export function CompanyProvider({ children, initialCompanies }: { children: ReactNode; initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(() => getInitialCompany(initialCompanies))
  const [isLoading, setIsLoading] = useState(false)

  const setCurrentCompany = (company: Company) => {
    setCurrentCompanyState(company)
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentCompanyId', company.id)
    }
  }

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        companies,
        setCurrentCompany,
        setCompanies,
        isLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return {
    ...context,
    selectedCompany: context.currentCompany,
  }
}
