import { useSearchParams } from 'react-router-dom'
import FileBrowser from '@/components/files/FileBrowser'
import SharedWithMeView from '@/components/share/SharedWithMeView'

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const path = searchParams.get('path') || '.'
  if (path.startsWith('shared:')) return <SharedWithMeView />
  return <FileBrowser />
}
