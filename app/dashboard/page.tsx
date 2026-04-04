import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const ALL_TOOLS = [
  {
    slug: 'checklist',
    name: 'רשימות תיוג',
    description: 'ניהול וביצוע רשימות תיוג עם הצעות AI',
    icon: '✅',
    href: '/tools/checklist',
  },
] as const

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export default async function DashboardPage() {
  const { profile } = await requireProfile()
  const supabase = createClient()

  // Admins access everything; others check tool_access table
  let accessibleSlugs: Set<string>
  if (profile.role === 'admin') {
    accessibleSlugs = new Set(ALL_TOOLS.map(t => t.slug))
  } else {
    const { data: rows } = await supabase
      .from('tool_access')
      .select('tool_slug')
      .eq('user_id', profile.id)
    accessibleSlugs = new Set((rows ?? []).map((r: { tool_slug: string }) => r.tool_slug))
  }

  const displayName = profile.full_name || profile.email

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <span className="text-2xl">🛠️</span>
            כלים חכמים
          </div>
          <div className="flex items-center gap-4">
            {profile.role === 'admin' && (
              <Link
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                ניהול משתמשים
              </Link>
            )}
            <span className="text-sm text-gray-500">{displayName}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                יציאה
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">שלום, {displayName?.split(' ')[0]} 👋</h2>
          <p className="text-gray-500 mt-1">הכלים הזמינים עבורך</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALL_TOOLS.map(tool => {
            const hasAccess = accessibleSlugs.has(tool.slug)
            return (
              <div
                key={tool.slug}
                className={`bg-white rounded-2xl shadow-sm border p-6 flex flex-col gap-4 transition-all ${
                  hasAccess
                    ? 'border-gray-100 hover:shadow-md hover:-translate-y-0.5'
                    : 'border-gray-100 opacity-50'
                }`}
              >
                <div className="text-4xl">{hasAccess ? tool.icon : '🔒'}</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                </div>
                {hasAccess ? (
                  <Link
                    href={tool.href}
                    className="mt-auto bg-blue-600 text-white text-sm font-medium rounded-xl px-4 py-2.5 text-center hover:bg-blue-700 transition-colors"
                  >
                    פתח כלי
                  </Link>
                ) : (
                  <button
                    disabled
                    className="mt-auto bg-gray-100 text-gray-400 text-sm font-medium rounded-xl px-4 py-2.5 text-center cursor-not-allowed"
                  >
                    אין גישה
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
