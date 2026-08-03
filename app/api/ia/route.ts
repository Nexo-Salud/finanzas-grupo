import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { system, messages } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta configurar ANTHROPIC_API_KEY en las variables de entorno del servidor (Vercel).' },
        { status: 500 }
      )
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        system,
        messages,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Error al conectar con la API de Anthropic.' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno del servidor.' }, { status: 500 })
  }
}
