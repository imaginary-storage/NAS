import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Folder, FileText, Download, ChevronLeft, AlertCircle, Lock, Pencil, Users2 } from 'lucide-react'

import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchIncomingThunk } from '@/store/slices/sharesSlice'
import { Button } from '@/components/ui/button'
import {
  shareList,
  shareDownload,
  type ShareEntry,
  type Share,
} from '@/api/share'

const SHARED_PATH = 'shared:///'

function formatExpiry(t: number): string {
  if (!t) return 'never'
  const d = new Date(t * 1000)
  return d.toLocaleString()
}

interface ShareIndexProps {
  shares: Share[]
  onOpen: (s: Share) => void
}

function ShareIndex({ shares, onOpen }: ShareIndexProps) {
  if (!shares.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Users2 className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Nothing shared with you</p>
        <p className="mt-1 text-xs text-slate-400">Items others share with you will appear here.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2 px-5 py-4">
      {shares.map((s) => {
        const Icon = s.kind === 'dir' ? Folder : FileText
        const baseName = s.source_path.split('/').pop() || s.source_path
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            disabled={s.stale}
            className="group flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1E2640] dark:bg-[#161B2E] dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
          >
            <Icon className={`h-5 w-5 shrink-0 ${s.kind === 'dir' ? 'text-indigo-500' : 'text-slate-500'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-900 dark:text-slate-100">{baseName}</span>
                {s.mode === 'ro'
                  ? <Lock className="h-3.5 w-3.5 text-slate-400" />
                  : <Pencil className="h-3.5 w-3.5 text-emerald-500" />}
                {s.stale && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>from <strong>{s.sharer}</strong></span>
                <span>·</span>
                <span>{s.mode === 'ro' ? 'read-only' : 'read/write'}</span>
                <span>·</span>
                <span>expires {formatExpiry(s.expires_at)}</span>
                {s.stale && <><span>·</span><span className="text-amber-600">source missing</span></>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface ShareBrowserProps {
  share: Share
  onBack: () => void
}

function ShareBrowser({ share, onBack }: ShareBrowserProps) {
  const [entries, setEntries] = useState<ShareEntry[]>([])
  const [subpath, setSubpath] = useState<string>('.')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    shareList(share.id, subpath)
      .then((r) => setEntries(r.entries))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to list'))
      .finally(() => setLoading(false))
  }, [share.id, subpath])

  const segments = useMemo(
    () => (subpath === '.' ? [] : subpath.split('/').filter(Boolean)),
    [subpath],
  )

  const baseName = share.source_path.split('/').pop() || share.source_path

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-3 text-sm dark:border-[#1E2640] dark:bg-[#0C0F1A]">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Shared
        </Button>
        <span className="text-slate-400">/</span>
        <button
          onClick={() => setSubpath('.')}
          className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
        >
          {share.sharer}'s {baseName}
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-slate-400">/</span>
            <button
              onClick={() => setSubpath(segments.slice(0, i + 1).join('/'))}
              className="hover:underline"
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">Empty</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1E2640]">
            {entries.map((e) => {
              const Icon = e.type === 'dir' ? Folder : FileText
              const into = subpath === '.' ? e.name : `${subpath}/${e.name}`
              return (
                <div
                  key={e.name}
                  className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                  onDoubleClick={() => {
                    if (e.type === 'dir') setSubpath(into)
                    else shareDownload(share.id, into, e.name)
                  }}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${e.type === 'dir' ? 'text-indigo-500' : 'text-slate-500'}`} />
                  <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{e.name}</span>
                  {e.type === 'file' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => shareDownload(share.id, into, e.name)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <span className="w-24 text-right text-xs text-slate-400">
                    {e.type === 'file' ? `${(e.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SharedWithMeView() {
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const incoming = useAppSelector((s) => s.shares.incoming)

  useEffect(() => { dispatch(fetchIncomingThunk()) }, [dispatch])

  /* Resolve the active share id from the URL (?path=shared:///<id>). */
  const path = searchParams.get('path') || SHARED_PATH
  const activeId = path.startsWith(SHARED_PATH) ? path.slice(SHARED_PATH.length) : ''
  const activeShare = activeId ? incoming.find((s) => s.id === activeId) : undefined

  if (activeId && activeShare) {
    return (
      <ShareBrowser
        share={activeShare}
        onBack={() => setSearchParams({ path: SHARED_PATH })}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-3 text-sm font-semibold dark:border-[#1E2640] dark:bg-[#0C0F1A]">
        <Users2 className="h-4 w-4" /> Shared with me
      </div>
      <div className="flex-1 overflow-auto">
        <ShareIndex
          shares={incoming}
          onOpen={(s) => setSearchParams({ path: `${SHARED_PATH}${s.id}` })}
        />
      </div>
    </div>
  )
}
