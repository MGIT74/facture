'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getItems(companyId: string) {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return items || []
}

export async function createItem(companyId: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    company_id: companyId,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    unit_price: parseFloat(formData.get('unit_price') as string),
    tax_rate: parseFloat(formData.get('tax_rate') as string) || 20.00,
    unit: formData.get('unit') as string || 'unit',
  }

  const { data: item, error } = await supabase
    .from('items')
    .insert(data)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/items')
  return { data: item }
}

export async function updateItem(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    unit_price: parseFloat(formData.get('unit_price') as string),
    tax_rate: parseFloat(formData.get('tax_rate') as string),
    unit: formData.get('unit') as string,
  }

  const { data: item, error } = await supabase
    .from('items')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/items')
  return { data: item }
}

export async function deleteItem(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/items')
  return { success: true }
}
