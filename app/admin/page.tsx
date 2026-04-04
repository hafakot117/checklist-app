import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import AdminPanel from './AdminPanel'

const TOOLS = [
  { slug: 'checklist', name: 'רשימות תיוג' },
]

export default async function AdminPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })

  const { data: toolAccess } = await supabase
    .from('tool_access')
    .select('user_id, tool_slug')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
              ← לוח הבקרה
            </Link>
            <span className="text-gray-200">|</span>
            <h1 className="text-lg font-bold text-gray-900">ניהול משתמשים</h1>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Admin</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <AdminPanel
          profiles={profiles ?? []}
          toolAccess={toolAccess ?? []}
          tools={TOOLS}
        />
      </main>
    </div>
  )
}
