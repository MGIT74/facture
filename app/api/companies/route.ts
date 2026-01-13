import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const formData = await request.formData()

  const data = {
    name: formData.get('name') as string,
    legal_name: formData.get('legal_name') as string || null,
    email: formData.get('email') as string || null,
    country: formData.get('country') as string || 'FR',
    default_currency: formData.get('default_currency') as string || 'EUR',
    owner_id: user.id,
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert(data)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: company })
}
