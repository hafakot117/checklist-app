import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // On Vercel, request.url uses an internal hostname that resolves to localhost.
  // Use x-forwarded-host to get the actual public-facing domain.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const siteOrigin =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? origin
      : `https://${forwardedHost}`

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${siteOrigin}${next}`)
    }
  }

  return NextResponse.redirect(`${siteOrigin}/`)
}
