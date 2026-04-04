import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChecklistTool from './ChecklistTool'

export default async function ChecklistPage() {
  const { profile } = await requireProfile()

  if (profile.role !== 'admin') {
    const supabase = createClient()
    const { data: access } = await supabase
      .from('tool_access')
      .select('id')
      .eq('user_id', profile.id)
      .eq('tool_slug', 'checklist')
      .single()
    if (!access) redirect('/dashboard')
  }

  return <ChecklistTool userId={profile.id} />
}
