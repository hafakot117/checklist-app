'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

type Checklist = { id: string; title: string; description: string | null }
type Item = { id: string; checklist_id: string; text: string; checked: boolean; position: number }

export default function ChecklistTool({ userId }: { userId: string }) {
  const supabase = createClient()
  const [tab, setTab] = useState<'admin' | 'execution'>('admin')

  // Checklists
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null)
  const [items, setItems] = useState<Item[]>([])

  // UI state
  const [newTitle, setNewTitle] = useState('')
  const [newItemText, setNewItemText] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [creatingChecklist, setCreatingChecklist] = useState(false)

  const loadChecklists = useCallback(async () => {
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setChecklists(data ?? [])
    if (data && data.length > 0 && !activeChecklist) {
      setActiveChecklist(data[0])
    }
  }, [userId])

  const loadItems = useCallback(async (checklistId: string) => {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('position', { ascending: true })
    setItems(data ?? [])
  }, [])

  useEffect(() => { loadChecklists() }, [loadChecklists])
  useEffect(() => {
    if (activeChecklist) loadItems(activeChecklist.id)
    setSuggestions([])
    setNewItemText('')
  }, [activeChecklist, loadItems])

  async function createChecklist() {
    if (!newTitle.trim()) return
    setCreatingChecklist(true)
    const { data } = await supabase
      .from('checklists')
      .insert({ user_id: userId, title: newTitle.trim() })
      .select()
      .single()
    if (data) {
      setActiveChecklist(data)
      setNewTitle('')
      await loadChecklists()
    }
    setCreatingChecklist(false)
  }

  async function deleteChecklist(id: string) {
    if (!confirm('למחוק את הרשימה?')) return
    await supabase.from('checklists').delete().eq('id', id)
    if (activeChecklist?.id === id) {
      const remaining = checklists.filter(c => c.id !== id)
      setActiveChecklist(remaining[0] ?? null)
      setItems([])
    }
    await loadChecklists()
  }

  async function addItem() {
    if (!newItemText.trim() || !activeChecklist) return
    const position = items.length
    const { data } = await supabase
      .from('checklist_items')
      .insert({ user_id: userId, checklist_id: activeChecklist.id, text: newItemText.trim(), position })
      .select()
      .single()
    if (data) {
      setItems(prev => [...prev, data])
      setNewItemText('')
    }
  }

  async function addItemFromSuggestion(text: string) {
    if (!activeChecklist) return
    const position = items.length
    const { data } = await supabase
      .from('checklist_items')
      .insert({ user_id: userId, checklist_id: activeChecklist.id, text, position })
      .select()
      .single()
    if (data) {
      setItems(prev => [...prev, data])
      setSuggestions(prev => prev.filter(s => s !== text))
    }
  }

  async function deleteItem(id: string) {
    await supabase.from('checklist_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function toggleItem(id: string, checked: boolean) {
    await supabase.from('checklist_items').update({ checked }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i))
  }

  async function resetChecklist() {
    if (!activeChecklist) return
    await supabase
      .from('checklist_items')
      .update({ checked: false })
      .eq('checklist_id', activeChecklist.id)
    setItems(prev => prev.map(i => ({ ...i, checked: false })))
  }

  async function getSuggestions() {
    if (!activeChecklist) return
    setLoadingSuggest(true)
    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeChecklist.title,
          existingItems: items.map(i => i.text),
        }),
      })
      const { suggestions: s } = await res.json()
      setSuggestions(s ?? [])
    } finally {
      setLoadingSuggest(false)
    }
  }

  const checkedCount = items.filter(i => i.checked).length
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
              ← לוח הבקרה
            </Link>
            <span className="text-gray-200">|</span>
            <h1 className="text-lg font-bold text-gray-900">✅ רשימות תיוג</h1>
          </div>
          {/* Tab switcher */}
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setTab('admin')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ניהול
            </button>
            <button
              onClick={() => setTab('execution')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'execution' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ביצוע
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {tab === 'admin' ? (
          <AdminTab
            checklists={checklists}
            activeChecklist={activeChecklist}
            items={items}
            newTitle={newTitle}
            newItemText={newItemText}
            suggestions={suggestions}
            loadingSuggest={loadingSuggest}
            creatingChecklist={creatingChecklist}
            onSelectChecklist={setActiveChecklist}
            onNewTitleChange={setNewTitle}
            onNewItemChange={setNewItemText}
            onCreateChecklist={createChecklist}
            onDeleteChecklist={deleteChecklist}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            onGetSuggestions={getSuggestions}
            onAddFromSuggestion={addItemFromSuggestion}
          />
        ) : (
          <ExecutionTab
            checklists={checklists}
            activeChecklist={activeChecklist}
            items={items}
            checkedCount={checkedCount}
            progress={progress}
            onSelectChecklist={setActiveChecklist}
            onToggleItem={toggleItem}
            onReset={resetChecklist}
          />
        )}
      </div>
    </div>
  )
}

// ─── Admin Tab ────────────────────────────────────────────────────────────────

function AdminTab({
  checklists, activeChecklist, items,
  newTitle, newItemText, suggestions, loadingSuggest, creatingChecklist,
  onSelectChecklist, onNewTitleChange, onNewItemChange,
  onCreateChecklist, onDeleteChecklist, onAddItem, onDeleteItem,
  onGetSuggestions, onAddFromSuggestion,
}: {
  checklists: Checklist[]
  activeChecklist: Checklist | null
  items: Item[]
  newTitle: string
  newItemText: string
  suggestions: string[]
  loadingSuggest: boolean
  creatingChecklist: boolean
  onSelectChecklist: (c: Checklist) => void
  onNewTitleChange: (v: string) => void
  onNewItemChange: (v: string) => void
  onCreateChecklist: () => void
  onDeleteChecklist: (id: string) => void
  onAddItem: () => void
  onDeleteItem: (id: string) => void
  onGetSuggestions: () => void
  onAddFromSuggestion: (text: string) => void
}) {
  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar: checklist list */}
      <aside className="w-64 shrink-0 flex flex-col gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
          <h3 className="font-semibold text-gray-700 text-sm">הרשימות שלי</h3>

          {/* New checklist input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => onNewTitleChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onCreateChecklist()}
              placeholder="שם רשימה חדשה..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            />
            <button
              onClick={onCreateChecklist}
              disabled={!newTitle.trim() || creatingChecklist}
              className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              +
            </button>
          </div>

          {/* List */}
          <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
            {checklists.length === 0 && (
              <p className="text-gray-400 text-xs text-center py-4">אין רשימות עדיין</p>
            )}
            {checklists.map(cl => (
              <div
                key={cl.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                  activeChecklist?.id === cl.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
                onClick={() => onSelectChecklist(cl)}
              >
                <span className="text-sm font-medium truncate">{cl.title}</span>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteChecklist(cl.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs ml-1"
                  title="מחק"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main: items editor */}
      <div className="flex-1 flex flex-col gap-4">
        {!activeChecklist ? (
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-400">
            בחר רשימה או צור חדשה
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{activeChecklist.title}</h2>
                <span className="text-sm text-gray-400">{items.length} פריטים</span>
              </div>

              {/* Add item */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={e => onNewItemChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onAddItem()}
                  placeholder="הוסף פריט חדש..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={onAddItem}
                  disabled={!newItemText.trim()}
                  className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  הוסף
                </button>
                <button
                  onClick={onGetSuggestions}
                  disabled={loadingSuggest}
                  className="bg-purple-50 text-purple-700 border border-purple-100 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="הצע פריטים עם AI"
                >
                  {loadingSuggest ? '...' : '✨ AI'}
                </button>
              </div>

              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <div className="border border-purple-100 bg-purple-50 rounded-xl p-3 flex flex-col gap-2">
                  <p className="text-xs text-purple-600 font-medium">הצעות AI — לחץ להוספה:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => onAddFromSuggestion(s)}
                        className="bg-white border border-purple-200 text-purple-700 rounded-lg px-3 py-1.5 text-sm hover:bg-purple-600 hover:text-white transition-colors"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items list */}
              <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                {items.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">אין פריטים עדיין</p>
                )}
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 group"
                  >
                    <span className="text-gray-300 text-xs w-5 text-center">{idx + 1}</span>
                    <span className="flex-1 text-sm text-gray-800">{item.text}</span>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Execution Tab ────────────────────────────────────────────────────────────

function ExecutionTab({
  checklists, activeChecklist, items, checkedCount, progress,
  onSelectChecklist, onToggleItem, onReset,
}: {
  checklists: Checklist[]
  activeChecklist: Checklist | null
  items: Item[]
  checkedCount: number
  progress: number
  onSelectChecklist: (c: Checklist) => void
  onToggleItem: (id: string, checked: boolean) => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full">
      {/* Checklist selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">בחר רשימה:</label>
        <select
          value={activeChecklist?.id ?? ''}
          onChange={e => {
            const cl = checklists.find(c => c.id === e.target.value)
            if (cl) onSelectChecklist(cl)
          }}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {checklists.length === 0 && <option value="">אין רשימות — צור אחת בטאב ניהול</option>}
          {checklists.map(cl => (
            <option key={cl.id} value={cl.id}>{cl.title}</option>
          ))}
        </select>
      </div>

      {activeChecklist && items.length > 0 && (
        <>
          {/* Progress */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">התקדמות</span>
              <span className="text-gray-500">{checkedCount} / {items.length}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && (
              <p className="text-green-600 text-sm font-medium text-center">🎉 הרשימה הושלמה!</p>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {items.map((item, idx) => (
              <label
                key={item.id}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${
                  item.checked ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={e => onToggleItem(item.id, e.target.checked)}
                  className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {item.text}
                </span>
                <span className="text-xs text-gray-300">{idx + 1}</span>
              </label>
            ))}
          </div>

          <button
            onClick={onReset}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            ↺ איפוס הרשימה
          </button>
        </>
      )}

      {activeChecklist && items.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400 text-sm">
          הרשימה ריקה — הוסף פריטים בטאב ניהול
        </div>
      )}
    </div>
  )
}
