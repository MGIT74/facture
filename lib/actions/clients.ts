'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getClients(companyId: string) {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return clients || []
}

export async function createNewClient(companyId: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    company_id: companyId,
    name: formData.get('name') as string,
    email: formData.get('email') as string || null,
    phone: formData.get('phone') as string || null,
    address: formData.get('address') as string || null,
    city: formData.get('city') as string || null,
    postal_code: formData.get('postal_code') as string || null,
    country: formData.get('country') as string || null,
    vat_number: formData.get('vat_number') as string || null,
    notes: formData.get('notes') as string || null,
  }

  const { data: client, error } = await supabase
    .from('clients')
    .insert(data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  return { data: client }
}

export async function updateClient(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string || null,
    phone: formData.get('phone') as string || null,
    address: formData.get('address') as string || null,
    city: formData.get('city') as string || null,
    postal_code: formData.get('postal_code') as string || null,
    country: formData.get('country') as string || null,
    vat_number: formData.get('vat_number') as string || null,
    notes: formData.get('notes') as string || null,
  }

  const { data: client, error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  return { data: client }
}

export async function deleteClient(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  return { success: true }
}
