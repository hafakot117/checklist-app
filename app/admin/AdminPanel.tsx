'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { updateUserRole, grantToolAccess, revokeToolAccess } from './actions'

type Profile = { id: string; email: string; full_name: string | null; role: string }
type ToolAccess = { user_id: string; tool_slug: string }
type Tool = { slug: string; name: string }

const ROLES = ['free', 'basic', 'pro', 'admin'] as const

const ROLE_LABELS: Record<string, string> = {
  free: 'חינמי',
  basic: 'בסיסי',
  pro: 'מקצועי',
  admin: 'מנהל',
}

export default function AdminPanel({
  profiles,
  toolAccess,
  tools,
}: {
  profiles: Profile[]
  toolAccess: ToolAccess[]
  tools: Tool[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const hasAccess = (userId: string, toolSlug: string) =>
    toolAccess.some(ta => ta.user_id === userId && ta.tool_slug === toolSlug)

  const filtered = profiles.filter(p =>
    (p.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleRoleChange = (userId: string, role: string) => {
    startTransition(async () => {
      await updateUserRole(userId, role)
      router.refresh()
    })
  }

  const handleToolToggle = (userId: string, toolSlug: string, currentlyHas: boolean) => {
    startTransition(async () => {
      if (currentlyHas) await revokeToolAccess(userId, toolSlug)
      else await grantToolAccess(userId, toolSlug)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{profiles.length} משתמשים רשומים</p>
        <input
          type="search"
          placeholder="חפש לפי שם או אימייל..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-right px-5 py-3 font-semibold text-gray-600">משתמש</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">תפקיד</th>
              {tools.map(t => (
                <th key={t.slug} className="text-center px-5 py-3 font-semibold text-gray-600">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isPending ? 'opacity-50 pointer-events-none' : ''}>
            {filtered.map(profile => (
              <tr key={profile.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-gray-900">{profile.full_name || '—'}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{profile.email}</div>
                </td>
                <td className="px-5 py-3.5">
                  <select
                    value={profile.role}
                    onChange={e => handleRoleChange(profile.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </td>
                {tools.map(tool => {
                  const access = hasAccess(profile.id, tool.slug)
                  return (
                    <td key={tool.slug} className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleToolToggle(profile.id, tool.slug, access)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          access ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                        title={access ? 'בטל גישה' : 'הענק גישה'}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                            access ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">לא נמצאו משתמשים</div>
        )}
      </div>
    </div>
  )
}
