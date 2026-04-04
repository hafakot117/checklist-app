import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'pro' | 'basic' | 'free'
  created_at: string
}

export async function requireProfile(): Promise<{ user: { id: string; email?: string }; profile: Profile }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Upsert profile (handles first login), including default role
  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    role: 'free',
  }, { onConflict: 'id', ignoreDuplicates: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If profile is still missing, something is wrong with DB/RLS — don't loop back to login
  if (!profile) throw new Error(`Profile not found for user ${user.id}`)
  return { user, profile: profile as Profile }
}

export async function requireAdmin() {
  const { user, profile } = await requireProfile()
  if (profile.role !== 'admin') redirect('/dashboard')
  return { user, profile }
}
