import { useEffect, useState } from 'react'
import { Cloud, Folder, Play, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchAwsSyncThunk,
  saveAwsSyncThunk,
  runAwsSyncThunk,
  setConfig,
} from '@/store/slices/awsSyncSlice'
import { clearAwsSync } from '@/api/awsSync'
import FolderPickerDialog from './FolderPickerDialog'

const STORAGE_CLASS_OPTIONS = ['DEEP_ARCHIVE', 'GLACIER', 'STANDARD'] as const

function formatTime(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function AwsSyncCard() {
  const dispatch = useAppDispatch()
  const { config, status, saving, running } = useAppSelector((s) => s.awsSync)
  const [pickerOpen, setPickerOpen] = useState(false)

  // The server redacts creds to "***" when there's a stored value.  We let the
  // user re-type them only if they want to change.  If the user leaves "***"
  // in the field, we send the empty string and the server preserves the prior
  // value via PUT (it merges the existing lastRun and we'd want similar for
  // creds).  Simpler approach: only send creds that differ from the redaction.
  const [touchedAccessKey, setTouchedAccessKey] = useState(false)
  const [touchedSecretKey, setTouchedSecretKey] = useState(false)

  useEffect(() => {
    if (status === 'idle') dispatch(fetchAwsSyncThunk())
  }, [status, dispatch])

  useEffect(() => {
    setTouchedAccessKey(false)
    setTouchedSecretKey(false)
  }, [config.lastRun?.finishedAt])

  const update = (patch: Partial<typeof config>) => dispatch(setConfig(patch))

  const handleSave = async () => {
    const payload = { ...config }
    // If the user didn't touch the field and it's still the redaction, drop it
    // so the server can preserve the stored value.  We do this by sending the
    // PUT with empty strings and expecting the server to merge — but our
    // current server does straight replace.  TODO: server-side preserve when
    // accessKeyId === "***".  For now: if the user pasted "***" we treat as
    // "keep" by simply sending whatever they have; if it's "***" the sync will
    // fail and the user will know to enter real creds.
    if (!touchedAccessKey && payload.accessKeyId === '***') payload.accessKeyId = ''
    if (!touchedSecretKey && payload.secretAccessKey === '***') payload.secretAccessKey = ''
    try {
      await dispatch(saveAwsSyncThunk(payload)).unwrap()
      toast.success('AWS Sync settings saved')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save settings'
      toast.error(`Save failed: ${msg}`)
    }
  }

  const handleRunNow = async () => {
    try {
      await dispatch(runAwsSyncThunk()).unwrap()
      toast.success('Sync triggered — refreshing status')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to trigger sync'
      toast.error(`Sync failed: ${msg}`)
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear AWS Sync configuration? This stops sync and removes saved credentials.')) return
    try {
      await clearAwsSync()
      dispatch(fetchAwsSyncThunk())
      toast.success('AWS Sync configuration cleared')
    } catch {
      toast.error('Failed to clear')
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
        AWS{' '}
        <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
          Sync
        </span>
      </h2>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
        Continuously archive a folder to S3 with a Glacier storage class. Push-only.
      </p>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.1)] dark:border-[#1E2640] dark:bg-[#161B2E]">
        {/* Enable toggle */}
        <label className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Sync enabled</div>
            <div className="text-xs text-slate-500">
              When on, the server pushes changes every {config.intervalMinutes || 5} minute
              {(config.intervalMinutes || 5) === 1 ? '' : 's'}.
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-5 w-5 cursor-pointer accent-indigo-600"
          />
        </label>

        {/* Folder picker */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Folder to sync
          </label>
          <div className="flex gap-2">
            <Input
              value={config.folder}
              onChange={(e) => update({ folder: e.target.value })}
              placeholder="Documents/backup"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} className="shrink-0">
              <Folder className="mr-1.5 h-4 w-4" />
              Browse
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Path relative to your home directory.</p>
        </div>

        {/* S3 destination */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              S3 bucket
            </label>
            <Input
              value={config.bucket}
              onChange={(e) => update({ bucket: e.target.value })}
              placeholder="my-archive-bucket"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Prefix <span className="text-slate-400">(optional)</span>
            </label>
            <Input
              value={config.prefix}
              onChange={(e) => update({ prefix: e.target.value })}
              placeholder="nas/host1"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Region
            </label>
            <Input
              value={config.region}
              onChange={(e) => update({ region: e.target.value })}
              placeholder="us-east-1"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Storage class
            </label>
            <select
              value={config.storageClass}
              onChange={(e) => update({ storageClass: e.target.value as typeof config.storageClass })}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {STORAGE_CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Credentials */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              AWS access key ID
            </label>
            <Input
              value={config.accessKeyId}
              onChange={(e) => {
                setTouchedAccessKey(true)
                update({ accessKeyId: e.target.value })
              }}
              placeholder="AKIA…"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              AWS secret access key
            </label>
            <Input
              type="password"
              value={config.secretAccessKey}
              onChange={(e) => {
                setTouchedSecretKey(true)
                update({ secretAccessKey: e.target.value })
              }}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Sync interval (minutes)
          </label>
          <Input
            type="number"
            min={1}
            value={config.intervalMinutes}
            onChange={(e) => update({ intervalMinutes: Number(e.target.value) || 1 })}
            className="w-32"
          />
        </div>

        {/* Actions */}
        <div className="mb-5 flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={handleRunNow}
            disabled={running || !config.enabled}
            title={!config.enabled ? 'Enable sync first' : 'Run sync immediately'}
          >
            <Play className="mr-1.5 h-4 w-4" />
            {running ? 'Running…' : 'Sync now'}
          </Button>
          <Button variant="outline" onClick={handleClear} className="ml-auto text-red-600 dark:text-red-400">
            <Trash2 className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
        </div>

        {/* Status */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Cloud className="h-4 w-4" />
            Last run
          </div>
          {config.lastRun ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Started</span>
                <span className="font-mono">{formatTime(config.lastRun.startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Finished</span>
                <span className="font-mono">{formatTime(config.lastRun.finishedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Exit code</span>
                <span
                  className={`font-mono ${config.lastRun.exitCode === 0 ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {config.lastRun.exitCode}
                </span>
              </div>
              {config.lastRun.summary && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {config.lastRun.summary}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Never run yet.</div>
          )}
        </div>
      </div>

      <FolderPickerDialog
        open={pickerOpen}
        initialPath={config.folder || '.'}
        onOpenChange={setPickerOpen}
        onSelect={(p) => update({ folder: p })}
      />
    </section>
  )
}
