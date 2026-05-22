'use client'
import { useState, useRef, useCallback, DragEvent, useEffect } from 'react'

type Step = 'upload' | 'generating' | 'result'

export type Platform = 'ebay' | 'facebook' | 'craigslist' | 'mercari' | 'offerup' | 'etsy' | 'reverb' | 'poshmark'

export interface Listing {
  item_identified: string
  title: string
  description: string
  condition: string
  category: string
  price_low: number
  price_high: number
  keywords: string[]
  shipping_note: string
  platform_tip: string
  // eBay
  item_specifics?: Record<string, string>
  // Etsy
  tags?: string[]
  materials?: string[]
  who_made?: string
  when_made?: string
  // Reverb
  make?: string
  model?: string
  year?: string
  condition_grade?: string
  whats_included?: string
  // Poshmark / Mercari
  brand?: string
  size?: string
  color?: string
  original_price?: number
  hashtags?: string[]
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

const PLATFORMS: { id: Platform; label: string; color: string; sub: string }[] = [
  { id: 'ebay',       label: 'eBay',       color: '#E53238', sub: 'Auction & BIN'    },
  { id: 'facebook',   label: 'Facebook',   color: '#1877F2', sub: 'Marketplace'      },
  { id: 'craigslist', label: 'Craigslist', color: '#8B5CF6', sub: 'Local Classifieds' },
  { id: 'mercari',    label: 'Mercari',    color: '#FF4F00', sub: 'Ship or Local'     },
  { id: 'offerup',    label: 'OfferUp',    color: '#088557', sub: 'Buy & Sell Local'  },
  { id: 'etsy',       label: 'Etsy',       color: '#F16521', sub: 'Handmade & Vintage' },
  { id: 'reverb',     label: 'Reverb',     color: '#0066CC', sub: 'Music Gear'        },
  { id: 'poshmark',   label: 'Poshmark',   color: '#C13584', sub: 'Fashion & Style'   },
]

export default function Home() {
  const [step, setStep] = useState<Step>('upload')
  const [images, setImages] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [platform, setPlatform] = useState<Platform>('ebay')
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState('')
  const [copiedField, setCopiedField] = useState('')

  // Chat
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).slice(0, 5 - images.length).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        const result = e.target?.result as string
        setImages(prev => [...prev, result].slice(0, 5))
      }
      reader.readAsDataURL(file)
    })
  }

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [images])  // eslint-disable-line

  const generate = async () => {
    if (images.length === 0) return
    setStep('generating')
    setError('')
    try {
      const res = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, platform })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed')
      setListing(data)
      setStep('result')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setStep('upload')
    }
  }

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const copyAll = () => {
    if (!listing) return
    const lines = [
      `TITLE:\n${listing.title}`,
      `\nDESCRIPTION:\n${listing.description}`,
      `\nPRICE: $${listing.price_low}–$${listing.price_high}`,
      `\nCATEGORY: ${listing.category}`,
      `\nCONDITION: ${listing.condition}`,
      `\nKEYWORDS: ${listing.keywords.join(', ')}`,
      `\nSHIPPING: ${listing.shipping_note}`,
      `\nPLATFORM TIP: ${listing.platform_tip}`,
    ]
    if (listing.tags) lines.push(`\nETSY TAGS: ${listing.tags.join(', ')}`)
    if (listing.materials) lines.push(`\nMATERIALS: ${listing.materials.join(', ')}`)
    if (listing.item_specifics) lines.push(`\nITEM SPECIFICS:\n${Object.entries(listing.item_specifics).map(([k,v]) => `  ${k}: ${v}`).join('\n')}`)
    copy(lines.join(''), 'all')
  }

  const reset = () => {
    setStep('upload')
    setImages([])
    setListing(null)
    setError('')
  }

  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    const newMsgs: ChatMsg[] = [...chatMsgs, { role: 'user', content: msg }]
    setChatMsgs(newMsgs)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs, listing, platform })
      })
      const data = await res.json()
      setChatMsgs(prev => [...prev, { role: 'assistant', content: data.reply || 'Something went wrong.' }])
    } catch {
      setChatMsgs(prev => [...prev, { role: 'assistant', content: "Can't connect right now. Try again." }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs])

  const activePlatform = PLATFORMS.find(p => p.id === platform)!

  const S: Record<string, React.CSSProperties> = {
    card:   { background: 'var(--card)',  border: '1px solid var(--border)',  borderRadius: 16, padding: '16px 18px' },
    card2:  { background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: 16, padding: '16px 18px' },
    label:  { fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 8, display: 'block' },
    copyBtn:{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', transition: 'all .2s' },
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(20px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3, color: 'var(--gold)' }}>LAZY LISTER</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase' }}>AI Marketplace Aggregator</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {step === 'result' && (
            <button onClick={reset} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--dim2)', background: 'none', border: '1px solid var(--border2)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}>
              ← New Listing
            </button>
          )}
          <button
            onClick={() => setChatOpen(v => !v)}
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: chatOpen ? '#000' : 'var(--gold)', background: chatOpen ? 'var(--gold)' : 'rgba(212,168,67,0.1)', border: '1px solid var(--gold)', borderRadius: 20, padding: '7px 16px', cursor: 'pointer', transition: 'all .2s' }}
          >
            🎙 Ask A Pawn Shop Owner
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', maxWidth: 1100, margin: '0 auto', padding: '0 20px', gap: 24 }}>

        {/* ── MAIN CONTENT ──────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 36, paddingBottom: 60 }}>

          {/* STEP INDICATOR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            {(['Upload', 'Generating', 'Listing Ready'] as const).map((label, i) => {
              const states = ['upload', 'generating', 'result']
              const idx = states.indexOf(step)
              const active = i === idx
              const done = i < idx
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? 'var(--green)' : active ? 'var(--gold)' : 'var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: (done || active) ? '#000' : 'var(--dim)', transition: 'all .3s', flexShrink: 0 }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--gold)' : done ? 'var(--green)' : 'var(--dim)', letterSpacing: '0.06em' }}>{label}</span>
                  </div>
                  {i < 2 && <div style={{ width: 28, height: 1, background: i < idx ? 'var(--green)' : 'var(--border)' }} />}
                </div>
              )
            })}
          </div>

          {/* ── STEP: UPLOAD ────────────────────────────────────── */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Platform selector */}
              <div>
                <div style={{ ...S.label, marginBottom: 12 }}>Select Platform</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => setPlatform(p.id)} style={{ padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${platform === p.id ? p.color : 'var(--border)'}`, background: platform === p.id ? p.color + '14' : 'var(--card)', cursor: 'pointer', transition: 'all .18s', textAlign: 'left' as const }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: platform === p.id ? p.color : 'var(--text)', marginBottom: 2 }}>{p.label}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--dim)', letterSpacing: '0.06em' }}>{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--border2)'}`, borderRadius: 18, padding: images.length ? '24px' : '60px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all .22s', background: dragging ? 'rgba(212,168,67,0.04)' : 'var(--card)' }}
              >
                {images.length === 0 ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.6 }}>📦</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Drop product photos here</div>
                    <div style={{ fontSize: 12, color: 'var(--dim)' }}>Click to browse · up to 5 images · JPG, PNG, WEBP</div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {images.map((img, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border2)' }} />
                        <button onClick={e => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)) }} style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%', background: 'var(--red)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                    {images.length < 5 && (
                      <div style={{ width: 88, height: 88, borderRadius: 10, border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', fontSize: 24 }}>+</div>
                    )}
                  </div>
                )}
                <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
              </div>

              {error && (
                <div style={{ background: 'rgba(224,69,90,0.1)', border: '1px solid rgba(224,69,90,0.25)', borderRadius: 12, padding: '12px 16px', color: 'var(--red)', fontSize: 13 }}>{error}</div>
              )}

              <button
                onClick={generate}
                disabled={images.length === 0}
                style={{ padding: '17px', borderRadius: 14, background: images.length ? 'var(--gold)' : 'var(--border2)', color: images.length ? '#000' : 'var(--dim)', border: 'none', fontSize: 15, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: images.length ? 'pointer' : 'not-allowed', transition: 'all .2s' }}
              >
                Generate {activePlatform.label} Listing →
              </button>
            </div>
          )}

          {/* ── STEP: GENERATING ────────────────────────────────── */}
          {step === 'generating' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: '70px 0' }}>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--border2)', borderTop: `2px solid var(--gold)`, animation: 'spin 0.9s linear infinite' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: 'var(--text)' }}>Analyzing your item…</div>
                <div style={{ fontSize: 13, color: 'var(--dim)' }}>GPT-4o Vision is identifying the item and building your {activePlatform.label} listing</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, opacity: 0.5, border: '1px solid var(--border)', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: RESULT ────────────────────────────────────── */}
          {step === 'result' && listing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: activePlatform.color, marginBottom: 6 }}>
                    {activePlatform.label} Listing Ready
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{listing.item_identified}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={copyAll} style={{ padding: '10px 18px', borderRadius: 10, background: copiedField === 'all' ? 'var(--green)' : 'var(--gold)', color: '#000', border: 'none', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap' }}>
                    {copiedField === 'all' ? '✓ Copied' : 'Copy All'}
                  </button>
                </div>
              </div>

              {/* Images + price row */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                ))}
                <div style={{ marginLeft: 'auto', textAlign: 'right' as const }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)', letterSpacing: -1, lineHeight: 1 }}>${listing.price_low}–${listing.price_high}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>Suggested range</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Switch platform pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => { setPlatform(p.id); setStep('upload'); }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: `1px solid ${p.id === platform ? p.color : 'var(--border)'}`, background: p.id === platform ? p.color + '18' : 'none', color: p.id === platform ? p.color : 'var(--dim)', cursor: 'pointer' }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Field cards */}
              {buildResultFields(listing, platform).map(f => (
                <div key={f.key} style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={S.label as React.CSSProperties}>{f.label}</span>
                    <button onClick={() => copy(f.copyValue, f.key)} style={{ ...S.copyBtn, background: copiedField === f.key ? 'rgba(0,201,122,0.12)' : 'rgba(212,168,67,0.08)', color: copiedField === f.key ? 'var(--green)' : 'var(--gold)' }}>
                      {copiedField === f.key ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  {f.render}
                </div>
              ))}

              {/* Platform tip */}
              <div style={{ background: `${activePlatform.color}10`, border: `1px solid ${activePlatform.color}30`, borderRadius: 14, padding: '14px 16px' }}>
                <span style={{ ...S.label as React.CSSProperties, color: activePlatform.color }}>{activePlatform.label} Tip</span>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{listing.platform_tip}</p>
              </div>

              {/* Condition + category */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ ...S.card, flex: 1 }}>
                  <span style={S.label as React.CSSProperties}>Condition</span>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{listing.condition_grade || listing.condition}</div>
                </div>
                <div style={{ ...S.card, flex: 1 }}>
                  <span style={S.label as React.CSSProperties}>Category</span>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{listing.category}</div>
                </div>
                <div style={{ ...S.card, flex: 1 }}>
                  <span style={S.label as React.CSSProperties}>Shipping</span>
                  <div style={{ fontSize: 12, color: 'var(--dim2)', lineHeight: 1.5 }}>{listing.shipping_note}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── PAWN SHOP CHAT PANEL ────────────────────────────── */}
        {chatOpen && (
          <div style={{ width: 340, flexShrink: 0, paddingTop: 36 }}>
            <div style={{ position: 'sticky', top: 80, background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxHeight: 640 }}>
              {/* Chat header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(212,168,67,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.06em', color: 'var(--gold)' }}>🎙 Ask A Pawn Shop Owner</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>30 years behind the counter. Ask anything.</div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatMsgs.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {["What's this worth?", "eBay or Mercari for this?", "How do I ship it?", "What condition should I list?"].map(q => (
                      <button key={q} onClick={() => { setChatInput(q); }} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 10, background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--dim2)', fontSize: 12, cursor: 'pointer', fontStyle: 'italic' }}>
                        "{q}"
                      </button>
                    ))}
                    <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center', marginTop: 8 }}>or type your own question</div>
                  </div>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '9px 12px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? 'rgba(212,168,67,0.15)' : 'var(--card2)', border: `1px solid ${m.role === 'user' ? 'rgba(212,168,67,0.2)' : 'var(--border)'}`, fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>
                      {m.role === 'assistant' && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--gold)', display: 'block', marginBottom: 4 }}>THE OWNER</span>}
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--card2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--dim)' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--gold)', display: 'block', marginBottom: 4 }}>THE OWNER</span>
                      thinking…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Ask the owner…"
                  style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} style={{ padding: '0 14px', borderRadius: 10, background: chatInput.trim() ? 'var(--gold)' : 'var(--border)', color: chatInput.trim() ? '#000' : 'var(--dim)', border: 'none', fontWeight: 900, fontSize: 16, cursor: chatInput.trim() ? 'pointer' : 'not-allowed' }}>→</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ textAlign: 'center', padding: 24, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--dim)', opacity: 0.5 }}>
        © Lazy Lister — AI Marketplace Aggregator
      </footer>
    </main>
  )
}

// ── Build result field cards per platform ──────────────────────
function buildResultFields(listing: Listing, platform: Platform) {
  type Field = { key: string; label: string; copyValue: string; render: React.ReactNode }
  const fields: Field[] = []

  const text = (content: string, large = false) => (
    <p style={{ fontSize: large ? 16 : 13, fontWeight: large ? 700 : 400, color: 'var(--text)', lineHeight: 1.65, wordBreak: 'break-word' }}>{content}</p>
  )

  // Title — always
  fields.push({ key: 'title', label: 'Title', copyValue: listing.title, render: text(listing.title, true) })

  // Platform-specific extras before description
  if (platform === 'reverb') {
    const specs = [listing.make, listing.model, listing.year].filter(Boolean).join(' · ')
    if (specs) fields.push({ key: 'specs', label: 'Make / Model / Year', copyValue: specs, render: text(specs, true) })
    if (listing.whats_included) fields.push({ key: 'included', label: "What's Included", copyValue: listing.whats_included, render: text(listing.whats_included) })
  }

  if (platform === 'poshmark') {
    const details = [listing.brand, listing.size, listing.color].filter(Boolean).join(' · ')
    if (details) fields.push({ key: 'details', label: 'Brand · Size · Color', copyValue: details, render: text(details, true) })
    if (listing.original_price) fields.push({ key: 'orig', label: 'Original Retail Price', copyValue: `$${listing.original_price}`, render: <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--dim2)', textDecoration: 'line-through' }}>${listing.original_price}</p> })
  }

  if (platform === 'etsy') {
    if (listing.materials?.length) fields.push({ key: 'materials', label: 'Materials', copyValue: listing.materials.join(', '), render: <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{listing.materials.map(m => <span key={m} style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--card2)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--dim2)' }}>{m}</span>)}</div> })
    if (listing.who_made || listing.when_made) fields.push({ key: 'etsy_meta', label: 'Who Made · When Made', copyValue: [listing.who_made, listing.when_made].filter(Boolean).join(' / '), render: text([listing.who_made, listing.when_made].filter(Boolean).join(' / ')) })
  }

  if (platform === 'ebay' && listing.item_specifics && Object.keys(listing.item_specifics).length > 0) {
    const specificsText = Object.entries(listing.item_specifics).map(([k,v]) => `${k}: ${v}`).join('\n')
    fields.push({ key: 'specifics', label: 'Item Specifics', copyValue: specificsText, render: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {Object.entries(listing.item_specifics).map(([k, v]) => (
          <div key={k} style={{ background: 'var(--card2)', borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>
    )})
  }

  // Description — always
  fields.push({ key: 'description', label: 'Description', copyValue: listing.description, render: text(listing.description) })

  // Keywords / Tags / Hashtags
  const etsyTags = platform === 'etsy' && listing.tags
  const poshTags = platform === 'poshmark' && listing.hashtags
  const activeTags = etsyTags ? listing.tags! : poshTags ? listing.hashtags! : listing.keywords
  const kwValue = activeTags.join(', ')
  fields.push({ key: 'keywords', label: platform === 'etsy' ? 'Tags (13 max)' : platform === 'poshmark' ? 'Hashtags' : 'Keywords / Tags', copyValue: kwValue, render: (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {activeTags.map(k => (
        <span key={k} style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--card2)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--dim2)', fontFamily: 'monospace' }}>
          {(etsyTags || poshTags) ? k : `#${k}`}
        </span>
      ))}
    </div>
  )})

  return fields
}
