import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Share2 } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchShareUsersThunk, createShareThunk } from '@/store/slices/sharesSlice'
import { ApiError } from '@/api/client'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** absolute path of the file/folder being shared */
  sourcePath: string
  /** "file" or "dir" — derived from the entry being right-clicked */
  kind: 'file' | 'dir'
}

const PRESETS: { label: string; seconds: number }[] = [
  { label: '1 hour',  seconds: 3600 },
  { label: '1 day',   seconds: 24 * 3600 },
  { label: '7 days',  seconds: 7 * 24 * 3600 },
  { label: '30 days', seconds: 30 * 24 * 3600 },
  { label: 'Never',   seconds: 0 },
]

export default function ShareDialog({ open, onOpenChange, sourcePath, kind }: ShareDialogProps) {
  const dispatch = useAppDispatch()
  const users = useAppSelector((s) => s.shares.users)
  const [recipient, setRecipient] = useState('')
  const [mode, setMode] = useState<'ro' | 'rw'>('ro')
  const [expirySec, setExpirySec] = useState<number>(24 * 3600)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) dispatch(fetchShareUsersThunk())
  }, [open, dispatch])

  useEffect(() => {
    if (kind === 'file') setMode('ro')
  }, [kind])

  const submit = async () => {
    if (!recipient) {
      toast.error('Pick a recipient')
      return
    }
    setSubmitting(true)
    try {
      const expires_at = expirySec > 0 ? Math.floor(Date.now() / 1000) + expirySec : 0
      await dispatch(createShareThunk({
        source: sourcePath,
        recipient,
        kind,
        mode,
        expires_at,
      })).unwrap()
      toast.success(`Shared "${sourcePath.split('/').pop()}" with ${recipient}`)
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Share failed'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Share
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Path</label>
            <div className="mt-1 truncate rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-xs">
              {sourcePath}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Recipient</label>
            {users.length > 0 ? (
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5"
              >
                <option value="">— select user —</option>
                {users.map((u) => (
                  <option key={u.username} value={u.username}>{u.username}</option>
                ))}
              </select>
            ) : (
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="username"
                className="mt-1"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Access</label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'ro' ? 'default' : 'outline'}
                onClick={() => setMode('ro')}
              >
                Read only
              </Button>
              {kind === 'dir' && (
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'rw' ? 'default' : 'outline'}
                  onClick={() => setMode('rw')}
                >
                  Read + Write
                </Button>
              )}
            </div>
            {kind === 'file' && (
              <p className="mt-1 text-[11px] text-muted-foreground">Files are shared read-only.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Expiry</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="sm"
                  variant={expirySec === p.seconds ? 'default' : 'outline'}
                  onClick={() => setExpirySec(p.seconds)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !recipient}>
            {submitting ? 'Sharing…' : 'Share'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
