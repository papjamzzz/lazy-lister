import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const PLATFORM_SCHEMAS: Record<string, { schema: string; tip: string }> = {
  ebay: {
    schema: `{
  "title": "string — 80 chars max, keyword-first, include brand/model/condition",
  "description": "string — detailed HTML-friendly description, 3-4 paragraphs",
  "item_specifics": { "Brand": "string", "Model": "string", "MPN": "string or 'Does Not Apply'", "UPC": "string or 'Does Not Apply'", "Condition": "string", "Color": "string", "Size": "string or omit if n/a" },
  "condition": "New | Like New | Very Good | Good | Acceptable | For parts or not working",
  "price_low": number,
  "price_high": number,
  "category": "string — eBay category path",
  "shipping_note": "string"
}`,
    tip: 'eBay buyers scan item specifics first. Fill every field. Title must be keyword-dense for Cassini search. Condition must match eBay dropdown options exactly.',
  },
  etsy: {
    schema: `{
  "title": "string — 140 chars max, natural language, lead with most searchable noun",
  "description": "string — story-driven, mention handmade/vintage angle, care instructions, dimensions",
  "tags": ["exactly 13 tags", "2-3 word phrases preferred", "no single words"],
  "materials": ["list", "of", "materials"],
  "who_made": "i_did | collective | someone_else",
  "when_made": "made_to_order | 2020_2024 | 2010_2019 | 2000s | before_2000 | 1990s | 1980s | 1970s | 1960s | 1950s | before_1950",
  "price_low": number,
  "price_high": number,
  "category": "string — Etsy category",
  "shipping_note": "string"
}`,
    tip: 'Etsy ranks on recency and relevance. All 13 tags must be used — vary between broad and niche. First 160 chars of description appear in Google search.',
  },
  reverb: {
    schema: `{
  "title": "string — format: Make Model Year (e.g. Gibson Les Paul Standard 2019)",
  "make": "string — brand name",
  "model": "string — exact model name",
  "year": "string — year or decade",
  "condition_grade": "Mint | Excellent | Very Good | Good | Fair | Poor",
  "description": "string — gear-focused: playability, mods, any damage, what's included",
  "whats_included": "string — list case, cables, paperwork, accessories",
  "price_low": number,
  "price_high": number,
  "category": "string — instrument type",
  "shipping_note": "string — mention if willing to ship international"
}`,
    tip: 'Reverb gear buyers want exact specs. Mention serial number location, any mods or repairs, and setup condition. Price against active Reverb comps, not eBay.',
  },
  poshmark: {
    schema: `{
  "title": "string — 80 chars max, include brand, style name, size, color",
  "brand": "string — exact brand name for Poshmark brand tag",
  "size": "string — exact size label as worn",
  "color": "string — primary color, use Poshmark color options",
  "original_price": number,
  "price_low": number,
  "price_high": number,
  "description": "string — measurements in inches, styling notes, condition details, no emojis",
  "hashtags": ["#Brand", "#Style", "#Size", "up to 30 relevant tags"],
  "category": "string — Women/Men/Kids/Home",
  "shipping_note": "string"
}`,
    tip: 'Poshmark is social — description should feel like a friend selling to a friend. Include measurements (bust, waist, length). Share to parties for visibility.',
  },
  offerup: {
    schema: `{
  "title": "string — 50 chars max, ultra-clear, brand + item + condition",
  "description": "string — short and direct, mention pickup city/neighborhood, cash preferred",
  "price_low": number,
  "price_high": number,
  "category": "string",
  "condition": "New | Like New | Good | Fair | Poor",
  "shipping_note": "string — local pickup preferred note"
}`,
    tip: 'OfferUp buyers want fast answers. Keep it short. Mention if you accept offers. Local buyers respond to neighborhood mentions.',
  },
  facebook: {
    schema: `{
  "title": "string — conversational, include key specs and condition",
  "description": "string — friendly tone, bullet points welcome, include location pickup area, price firm or OBO",
  "price_low": number,
  "price_high": number,
  "category": "string — Facebook Marketplace category",
  "condition": "New | Used - Like New | Used - Good | Used - Fair | Used - Poor",
  "shipping_note": "string"
}`,
    tip: 'Facebook buyers are local and casual. Friendly tone converts. Mention cash/Venmo/PayPal accepted. Flag if you can meet halfway.',
  },
  craigslist: {
    schema: `{
  "title": "string — under 70 chars, factual, include price in title",
  "description": "string — plain text, no HTML, structured with line breaks, include 'no scams, local cash only' disclaimer",
  "price_low": number,
  "price_high": number,
  "category": "string — craigslist category",
  "condition": "string",
  "shipping_note": "string"
}`,
    tip: "Craigslist is text-only. Lead with the most important info. State 'local cash only, no PayPal, no shipping' upfront to filter scammers.",
  },
  mercari: {
    schema: `{
  "title": "string — 40 chars max, pack with keywords",
  "description": "string — condition details first, then features, then what's included, end with shipping note",
  "price_low": number,
  "price_high": number,
  "category": "string — Mercari category",
  "condition": "Like New | Good | Fair | Poor",
  "shipping_note": "string — Mercari prepaid label or buyer pays"
}`,
    tip: 'Mercari buyers filter by condition heavily. Be honest — disputes tank your rating. Use all 40 title chars. Fast shipping gets 5-star reviews.',
  },
}

export async function POST(req: NextRequest) {
  const { images, platform } = await req.json()

  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'Server API key not configured' }, { status: 400 })
  if (!images?.length) return NextResponse.json({ error: 'No images provided' }, { status: 400 })

  const platformKey = (platform || 'ebay').toLowerCase()
  const platformConfig = PLATFORM_SCHEMAS[platformKey] || PLATFORM_SCHEMAS.ebay

  const openai = new OpenAI({ apiKey: key })

  const imageContent = images.slice(0, 5).map((img: string) => ({
    type: 'image_url' as const,
    image_url: { url: img, detail: 'high' as const }
  }))

  const universalFields = `
  "item_identified": "string — plain English item name (e.g. 'Sony WH-1000XM4 Headphones')",
  "keywords": ["10-15", "search", "keywords", "for", "this", "item"],
  "platform_tip": "string — one specific actionable tip for selling this exact item on ${platformKey}"`

  const fullSchema = platformConfig.schema.replace(/^(\{)/, `$1${universalFields},`)

  const systemPrompt = `You are a professional marketplace listing expert with 20 years of experience selling on ${platformKey}. Analyze the product images and generate a perfectly optimized listing.

Platform: ${platformKey.toUpperCase()}
Platform note: ${platformConfig.tip}

Return ONLY valid JSON with no markdown fences, no explanation, matching this exact schema:
${fullSchema}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Generate the complete ${platformKey} listing. Be specific about what you see — brand, model, condition, features, color, any wear or damage. Price based on current ${platformKey} market comps.`
            }
          ]
        }
      ]
    })

    const text = response.choices[0].message.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse listing from AI response')
    const listing = JSON.parse(match[0])
    return NextResponse.json(listing)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI generation failed'
    console.error('[listing]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
