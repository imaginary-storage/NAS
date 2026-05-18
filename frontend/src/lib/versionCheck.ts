import { useEffect } from 'react'
import { toast } from 'sonner'

let alreadyChecked = false

export function useVersionCheck() {
  useEffect(() => {
    if (alreadyChecked) return
    alreadyChecked = true

    fetch('/version', { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { version?: string } | null) => {
        if (!data?.version) return
        if (data.version !== __APP_VERSION__) {
          toast.message('A new version is available', {
            description: `Server ${data.version}, this page ${__APP_VERSION__}. Reload to update.`,
            duration: Infinity,
            action: {
              label: 'Reload',
              onClick: () => window.location.reload(),
            },
          })
        }
      })
      .catch(() => {})
  }, [])
}
