import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, existingItems } = await req.json()

  const existing = (existingItems as string[]).length > 0
    ? `\n\nפריטים קיימים ברשימה:\n${(existingItems as string[]).map((i: string) => `- ${i}`).join('\n')}`
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `אתה עוזר ליצירת רשימות תיוג בעברית.

שם הרשימה: "${title}"${existing}

הצע 5 פריטים נוספים מתאימים לרשימה זו.
החזר רק את הפריטים עצמם, כל פריט בשורה נפרדת, ללא מספור ורק בעברית.`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const suggestions = text
    .split('\n')
    .map((s: string) => s.replace(/^[-•*]\s*/, '').trim())
    .filter((s: string) => s.length > 0)
    .slice(0, 5)

  return NextResponse.json({ suggestions })
}
