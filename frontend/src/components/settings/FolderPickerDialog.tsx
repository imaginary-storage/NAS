import { useEffect, useState } from 'react'
import { ChevronLeft, Folder, Home as HomeIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { listDir } from '@/api/filesystem'
import type { FileEntry } from '@/types/api'

interface FolderPickerDialogProps {
  open: boolean
  initialPath?: string
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
}

export default function FolderPickerDialog({
  open,
  initialPath = '.',
  onOpenChange,
  onSelect,
}: FolderPickerDialogProps) {
  const [path, setPath] = useState(initialPath)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPath(initialPath)
  }, [open, initialPath])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listDir(path)
      .then((res) => {
        if (cancelled) return
        setEntries(res.entries.filter((e) => e.type === 'dir'))
        setPath(res.path)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, path])

  const goUp = () => {
    if (path === '.' || path === '/') return
    const trimmed = path.replace(/\/+$/, '')
    const slash = trimmed.lastIndexOf('/')
    setPath(slash <= 0 ? '.' : trimmed.slice(0, slash))
  }

  const enter = (name: string) => {
    setPath(path === '.' ? name : `${path}/${name}`)
  }

  const handleSelect = () => {
    onSelect(path)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pick a folder</DialogTitle>
          <DialogDescription>
            Navigate to the folder you want to sync. Paths are relative to your home directory.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={() => setPath('.')}
            className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Home"
          >
            <HomeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goUp}
            disabled={path === '.' || path === '/'}
            className="rounded p-1 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"
            title="Up"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="truncate font-mono text-xs text-slate-700 dark:text-slate-300">{path}</span>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
          {error && <div className="p-4 text-sm text-red-500">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No subfolders here.</div>
          )}
          {!loading && !error && entries.map((e) => (
            <button
              key={e.name}
              type="button"
              onDoubleClick={() => enter(e.name)}
              onClick={() => enter(e.name)}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Folder className="h-4 w-4 text-indigo-500" />
              <span className="truncate">{e.name}</span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button type="button" onClick={handleSelect}>
            Select this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
