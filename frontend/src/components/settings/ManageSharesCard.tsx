import { useEffect } from 'react'
import { toast } from 'sonner'
import { Lock, Pencil, Folder, FileText, X } from 'lucide-react'

import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchOutgoingThunk,
  revokeShareThunk,
} from '@/store/slices/sharesSlice'
import { Button } from '@/components/ui/button'

function formatExpiry(t: number): string {
  if (!t) return 'never'
  return new Date(t * 1000).toLocaleString()
}

export default function ManageSharesCard() {
  const dispatch = useAppDispatch()
  const outgoing = useAppSelector((s) => s.shares.outgoing)

  useEffect(() => { dispatch(fetchOutgoingThunk()) }, [dispatch])

  const onRevoke = async (id: string) => {
    try {
      await dispatch(revokeShareThunk(id)).unwrap()
      toast.success('Share revoked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed')
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
        Shared <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">by you</span>
      </h2>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Items you've shared with other users.</p>
      <div className="rounded-xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(79,70,229,0.1)] dark:border-[#1E2640] dark:bg-[#161B2E]">
        {outgoing.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">You haven't shared anything yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1E2640]">
            {outgoing.map((s) => {
              const Icon = s.kind === 'dir' ? Folder : FileText
              const baseName = s.source_path.split('/').pop() || s.source_path
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Icon className={`h-4 w-4 shrink-0 ${s.kind === 'dir' ? 'text-indigo-500' : 'text-slate-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">{baseName}</span>
                      {s.mode === 'ro'
                        ? <Lock className="h-3.5 w-3.5 text-slate-400" />
                        : <Pencil className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      → {s.recipient} · {s.mode === 'ro' ? 'read-only' : 'read/write'} · expires {formatExpiry(s.expires_at)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRevoke(s.id)} title="Revoke">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
