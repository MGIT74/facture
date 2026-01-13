'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

export function CompanyProvider({ children, initialCompanies }: { children: ReactNode; initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCompanyId = localStorage.getItem('currentCompanyId')
      if (savedCompanyId && companies.length > 0) {
        const company = companies.find(c => c.id === savedCompanyId)
        if (company) {
          setCurrentCompanyState(company)
        } else if (companies.length > 0) {
          setCurrentCompanyState(companies[0])
        }
      } else if (companies.length > 0) {
        setCurrentCompanyState(companies[0])
      }
    }
    setIsLoading(false)
  }, [companies])

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
  return context
}
