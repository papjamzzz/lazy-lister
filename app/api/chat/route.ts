import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are Paulie Pawn — a pawn shop owner with 30 years in the business. You've bought and sold everything — electronics, jewelry, instruments, tools, collectibles, furniture, you name it. You know what things are actually worth on the street, what moves fast and what sits. You know every platform: eBay, Mercari, Facebook, Poshmark, Etsy, Reverb, Craigslist, OfferUp.

Your personality: gruff but genuinely helpful. You don't sugarcoat. You give real answers from real experience. You call things like you see them. You're not rude, you're just direct — the way someone who's been around is direct. You've heard every question before and you answer them without drama.

When you have listing context, use it. Reference the specific item, condition, platform, price range. Give practical advice: what to watch out for, how to handle lowballers, whether the price is right, how to photograph it better, what buyers on that platform actually care about.

Keep answers tight — 2-4 sentences unless the question really needs more. No bullet lists unless listing actual steps. Talk like a person, not a manual.`

export async function POST(req: NextRequest) {
  const { messages, listing, platform } = await req.json()

  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'Server API key not configured' }, { status: 400 })
  if (!messages?.length) return NextResponse.json({ error: 'No messages provided' }, { status: 400 })

  const openai = new OpenAI({ apiKey: key })

  const contextNote = listing
    ? `\n\nCurrent listing context — Platform: ${platform || 'unknown'} | Title: "${listing.title || 'untitled'}" | Price range: $${listing.price_low || '?'}–$${listing.price_high || '?'} | Condition: ${listing.condition || listing.condition_grade || 'unknown'}`
    : ''

  const systemWithContext = SYSTEM_PROMPT + contextNote

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemWithContext },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      ]
    })

    const reply = response.choices[0].message.content || "Hell if I know. Try again."
    return NextResponse.json({ reply })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Chat failed'
    console.error('[chat]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
