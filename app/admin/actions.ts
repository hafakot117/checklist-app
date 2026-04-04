'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function updateUserRole(userId: string, role: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  await supabase.from('profiles').update({ role }).eq('id', userId)
}

export async function grantToolAccess(userId: string, toolSlug: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  await supabase
    .from('tool_access')
    .upsert({ user_id: userId, tool_slug: toolSlug }, { onConflict: 'user_id,tool_slug' })
}

export async function revokeToolAccess(userId: string, toolSlug: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  await supabase
    .from('tool_access')
    .delete()
    .eq('user_id', userId)
    .eq('tool_slug', toolSlug)
}
