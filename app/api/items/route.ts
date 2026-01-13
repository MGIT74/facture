import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, unit_price, tax_rate, company_id')
    .eq('company_id', companyId)
    .order('name')

  if (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(items || [])
}
