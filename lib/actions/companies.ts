'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCompanies() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: memberships } = await supabase
    .from('company_members')
    .select('*, companies(*)')
    .eq('user_id', user.id)

  return memberships?.map(m => m.companies) || []
}

export async function getCompany(companyId: string) {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle()

  return company
}

export async function createCompany(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const data = {
    name: formData.get('name') as string,
    legal_name: formData.get('legal_name') as string,
    default_currency: formData.get('default_currency') as string || 'EUR',
    owner_id: user.id,
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert(data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { data: company }
}

export async function updateCompany(companyId: string, updates: Partial<{
  name: string
  legal_name: string
  registration_number: string
  vat_number: string
  address: string
  city: string
  postal_code: string
  country: string
  email: string
  phone: string
  website: string
  default_currency: string
  invoice_prefix: string
  quote_prefix: string
  default_tax_rate: number
  payment_terms_days: number
}>) {
  const supabase = await createClient()

  const { data: company, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/settings')
  return { data: company }
}
