import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Loader2, Sparkles, Wand2 } from 'lucide-react'
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
  const [useKnowledge, setUseKnowledge] = useState(true)
  const [useHouseTone, setUseHouseTone] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ model: string; sources: string[] } | null>(null)

  const generate = async () => {
    if (!prompt.trim()) {
      setError('Describe what you want the article to be about')
      return
    }
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const draft = await aiApi.generate({
        prompt,
        module,
        tone,
        length,
        use_knowledge: useKnowledge,
        use_house_tone: useHouseTone,
      })
      setResult({ model: draft.model, sources: draft.sources })
      onDraft(draft)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        disabled={generating}
        placeholder="What should this article be about? E.g. “A beginner's guide to chemical inventory management”"
        className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 disabled:opacity-60"
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={generating}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm capitalize outline-none focus:border-indigo-300"
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
            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-indigo-300"
          >
            {LENGTHS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-zinc-600">
          <BookOpen size={14} className="text-indigo-500" />
          Use knowledge base
        </span>
        <input
          type="checkbox"
          checked={useKnowledge}
          onChange={(e) => setUseKnowledge(e.target.checked)}
          disabled={generating}
          className="h-4 w-4 accent-indigo-600"
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-zinc-600">
          <Wand2 size={14} className="text-indigo-500" />
          Match house tone
        </span>
        <input
          type="checkbox"
          checked={useHouseTone}
          onChange={(e) => setUseHouseTone(e.target.checked)}
          disabled={generating}
          className="h-4 w-4 accent-indigo-600"
        />
      </label>

      <button
        onClick={generate}
        disabled={generating}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
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

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && !generating && (
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
          Draft generated with {result.model}.
          {result.sources.length > 0 ? (
            <>
              {' '}
              Grounded in:{' '}
              <span className="font-medium text-zinc-600">{result.sources.join(', ')}</span>
            </>
          ) : useKnowledge ? (
            <>
              {' '}
              No matching knowledge documents —{' '}
              <Link to="/admin/knowledge" className="text-indigo-600 hover:underline">
                add some
              </Link>
              .
            </>
          ) : null}{' '}
          Review before publishing.
        </div>
      )}
    </div>
  )
}
