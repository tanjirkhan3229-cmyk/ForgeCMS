import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import type { AiDraft, Module } from '../lib/api'
import { aiApi } from '../lib/api'

const TONES = ['professional', 'casual', 'friendly', 'technical', 'persuasive']
const LENGTHS = [
  { key: 'short', label: 'Short (~400 words)' },
  { key: 'medium', label: 'Medium (~800 words)' },
  { key: 'long', label: 'Long (~1700 words)' },
]

interface Props {
  module: Module
  onDraft: (draft: AiDraft) => void
}

export default function AiWriterPanel({ module, onDraft }: Props) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('professional')
  const [length, setLength] = useState('medium')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [lastModel, setLastModel] = useState('')

  const generate = async () => {
    if (!prompt.trim()) {
      setError('Describe what you want the article to be about')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const draft = await aiApi.generate({ prompt, module, tone, length })
      setLastModel(draft.model)
      onDraft(draft)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-indigo-500 uppercase">
        <Sparkles size={13} />
        AI Writer
      </h3>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        disabled={generating}
        placeholder="What should this article be about? E.g. “A beginner's guide to chemical inventory management”"
        className="w-full resize-none rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 disabled:opacity-60"
      />

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={generating}
            className="w-full rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5 text-sm capitalize outline-none focus:border-indigo-300"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Length</span>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value)}
            disabled={generating}
            className="w-full rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
          >
            {LENGTHS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
      >
        {generating ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Writing… this can take a minute
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Generate draft
          </>
        )}
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {lastModel && !error && !generating && (
        <p className="mt-2 text-xs text-zinc-400">Draft generated with {lastModel}. Review before publishing.</p>
      )}
    </div>
  )
}
