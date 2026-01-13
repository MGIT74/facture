import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('company_id')

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: quotes } = await supabase
    .from('quotes')
    .select('*')
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false })

  return NextResponse.json(quotes || [])
}
