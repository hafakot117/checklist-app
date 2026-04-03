'use client'

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type ChecklistItem = {
  id: string
  content: string
  is_complete: boolean
  created_at: string
}

type Checklist = {
  id: string
  title: string
  created_at: string
  checklist_items: ChecklistItem[]
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newItems, setNewItems] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [expandedList, setExpandedList] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({})
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
      } else {
        setUserEmail(session.user.email ?? '')
        setUserId(session.user.id)
        fetchChecklists()
      }
    })
  }, [])

  const fetchChecklists = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('checklists')
      .select('*, checklist_items(*)')
      .order('created_at', { ascending: false })
    if (!error && data) setChecklists(data as Checklist[])
    setLoading(false)
  }

  const fetchSuggestions = async (checklistId: string, title: string) => {
    setSuggestionsLoading(prev => ({ ...prev, [checklistId]: true }))
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listName: title }),
      })
      const json = await res.json()
      if (json.suggestions) {
        setSuggestions(prev => ({ ...prev, [checklistId]: json.suggestions }))
      }
    } catch {}
    setSuggestionsLoading(prev => ({ ...prev, [checklistId]: false }))
  }

  const addChecklist = async () => {
    if (!newTitle.trim()) return
    const title = newTitle.trim()
    const { data, error } = await supabase
      .from('checklists')
      .insert({ title, user_id: userId })
      .select('*, checklist_items(*)')
      .single()
    if (!error && data) {
      setChecklists([data as Checklist, ...checklists])
      setNewTitle('')
      setExpandedList(data.id)
      fetchSuggestions(data.id, title)
    }
  }

  const deleteChecklist = async (id: string) => {
    await supabase.from('checklists').delete().eq('id', id)
    setChecklists(checklists.filter(c => c.id !== id))
  }

  const addItem = async (checklistId: string) => {
    const content = newItems[checklistId]?.trim()
    if (!content) return
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ checklist_id: checklistId, content, user_id: userId })
      .select()
      .single()
    if (!error && data) {
      setChecklists(checklists.map(c =>
        c.id === checklistId
          ? { ...c, checklist_items: [...c.checklist_items, data as ChecklistItem] }
          : c
      ))
      setNewItems({ ...newItems, [checklistId]: '' })
    }
  }

  const addSuggestedItem = async (checklistId: string, content: string) => {
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ checklist_id: checklistId, content, user_id: userId })
      .select()
      .single()
    if (!error && data) {
      setChecklists(prev => prev.map(c =>
        c.id === checklistId
          ? { ...c, checklist_items: [...c.checklist_items, data as ChecklistItem] }
          : c
      ))
      setSuggestions(prev => ({
        ...prev,
        [checklistId]: prev[checklistId].filter(s => s !== content),
      }))
    }
  }

  const toggleItem = async (checklistId: string, itemId: string, current: boolean) => {
    await supabase
      .from('checklist_items')
      .update({ is_complete: !current })
      .eq('id', itemId)
    setChecklists(checklists.map(c =>
      c.id === checklistId
        ? {
            ...c,
            checklist_items: c.checklist_items.map(item =>
              item.id === itemId ? { ...item, is_complete: !current } : item
            ),
          }
        : c
    ))
  }

  const deleteItem = async (checklistId: string, itemId: string) => {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    setChecklists(checklists.map(c =>
      c.id === checklistId
        ? { ...c, checklist_items: c.checklist_items.filter(item => item.id !== itemId) }
        : c
    ))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <span className="text-xl font-bold text-gray-800">CheckList App</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-8 space-y-6">
        {/* New checklist input */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Create a new checklist</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChecklist()}
              placeholder="e.g. Grocery list, Work tasks..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={addChecklist}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Checklists */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading your checklists...</div>
        ) : checklists.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <span className="text-5xl block mb-3">📋</span>
            No checklists yet. Create your first one above!
          </div>
        ) : (
          checklists.map(checklist => {
            const total = checklist.checklist_items.length
            const done = checklist.checklist_items.filter(i => i.is_complete).length
            const isOpen = expandedList === checklist.id
            const hasSuggestions = (suggestions[checklist.id]?.length ?? 0) > 0
            const isLoadingSuggestions = suggestionsLoading[checklist.id]

            return (
              <div key={checklist.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
                {/* Checklist header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedList(isOpen ? null : checklist.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{isOpen ? '▼' : '▶'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-800">{checklist.title}</h3>
                      <p className="text-xs text-gray-400">{done}/{total} completed</p>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteChecklist(checklist.id) }}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg"
                    title="Delete checklist"
                  >
                    🗑
                  </button>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="h-1 bg-gray-100">
                    <div
                      className="h-1 bg-indigo-500 transition-all"
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                )}

                {/* Items */}
                {isOpen && (
                  <div className="px-5 py-3 space-y-2">
                    {checklist.checklist_items.length === 0 && !isLoadingSuggestions && !hasSuggestions && (
                      <p className="text-gray-400 text-sm text-center py-2">No items yet. Add one below!</p>
                    )}
                    {checklist.checklist_items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 group"
                      >
                        <input
                          type="checkbox"
                          checked={item.is_complete}
                          onChange={() => toggleItem(checklist.id, item.id, item.is_complete)}
                          className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                        />
                        <span className={`flex-1 text-sm ${item.is_complete ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {item.content}
                        </span>
                        <button
                          onClick={() => deleteItem(checklist.id, item.id)}
                          className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* AI Suggestions */}
                    {(isLoadingSuggestions || hasSuggestions) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-indigo-400 font-medium mb-2">✨ AI suggestions</p>
                        {isLoadingSuggestions ? (
                          <p className="text-xs text-gray-400">Generating suggestions...</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {suggestions[checklist.id].map(suggestion => (
                              <button
                                key={suggestion}
                                onClick={() => addSuggestedItem(checklist.id, suggestion)}
                                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full transition-colors"
                              >
                                + {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add item input */}
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        value={newItems[checklist.id] ?? ''}
                        onChange={e => setNewItems({ ...newItems, [checklist.id]: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && addItem(checklist.id)}
                        placeholder="Add a new item..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        onClick={() => addItem(checklist.id)}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
