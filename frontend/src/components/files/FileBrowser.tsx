import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  listDirThunk,
  setCurrentPath,
  setSelectedPaths,
  toggleSelect,
  clearSelection,
  setPreviewFile,
  setClipboard,
  deleteFileThunk,
  deleteDirThunk,
  copyFileThunk,
  moveFileThunk,
} from '@/store/slices/fileSystemSlice'
import {
  listTrashThunk,
  restoreItemThunk,
  deleteTrashItemThunk,
  emptyTrashThunk,
} from '@/store/slices/trashSlice'
import { fetchIncomingThunk } from '@/store/slices/sharesSlice'
import {
  shareList,
  shareDownload,
  shareUpload,
  shareMkdir,
  shareDeleteFile,
  type Share,
} from '@/api/share'
import { downloadFile } from '@/api/filesystem'
import { uploadEngine } from '@/lib/uploadEngine'
import { addBookmarkThunk } from '@/store/slices/bookmarksSlice'
import { getFileViewType, getDownloadUrl } from '@/lib/fileTypes'
import { Skeleton } from '@/components/ui/skeleton'
import type { FileEntry } from '@/types/api'

const TRASH_PATH = 'trash:///'
const SHARED_PATH = 'shared:///'

/* shared:///         → { id: '', subpath: '' }
 * shared:///<id>     → { id, subpath: '' }
 * shared:///<id>/sub → { id, subpath: 'sub' }
 * non-shared path    → null
 */
function parseSharedPath(p: string): { id: string; subpath: string } | null {
  if (!p.startsWith(SHARED_PATH)) return null
  const rest = p.slice(SHARED_PATH.length)
  if (!rest) return { id: '', subpath: '' }
  const slash = rest.indexOf('/')
  if (slash === -1) return { id: rest, subpath: '' }
  return { id: rest.slice(0, slash), subpath: rest.slice(slash + 1) }
}

import Breadcrumbs from './Breadcrumbs'
import ShareDialog from '@/components/share/ShareDialog'
import Toolbar from './Toolbar'
import FileGrid from './FileGrid'
import FileList from './FileList'
import FilePreview from './FilePreview'
import FileContextMenu from './FileContextMenu'
import NewFolderDialog from './NewFolderDialog'
import RenameDialog from './RenameDialog'
import DeleteConfirmDialog from './DeleteConfirmDialog'
import DownloadDialog from './DownloadDialog'

export default function FileBrowser() {
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    currentPath,
    entries,
    status,
    sortBy,
    sortOrder,
    selectedPaths,
    clipboard,
  } = useAppSelector((s) => s.fileSystem)
  const { viewMode, iconSize } = useAppSelector((s) => s.settings.values)
  const trashItems = useAppSelector((s) => s.trash.items)
  const incomingShares = useAppSelector((s) => s.shares.incoming)
  const user = useAppSelector((s) => s.auth.user)
  const isTrash = currentPath === TRASH_PATH

  /* Shared-mode parsing & capability derivation. */
  const sharedParts = useMemo(() => parseSharedPath(currentPath), [currentPath])
  const isShared = sharedParts !== null
  const isSharedIndex = isShared && sharedParts.id === ''
  const isSharedInside = isShared && sharedParts.id !== ''
  const activeShare: Share | undefined = useMemo(
    () => isSharedInside ? incomingShares.find((x) => x.id === sharedParts.id) : undefined,
    [isSharedInside, sharedParts, incomingShares],
  )
  const sharedSubpath = sharedParts?.subpath || '.'
  const isRwShare = activeShare?.mode === 'rw'

  /* Capability flags drive UI gating (toolbar, context menu, dialogs). */
  const caps = useMemo(() => ({
    canShare:    !isTrash && !isShared,
    canBookmark: !isTrash && !isSharedIndex,
    canRename:   !isTrash && !isShared,
    canCopy:     !isTrash && !isSharedIndex,
    canDelete:   !isTrash && !isSharedIndex && (!isSharedInside || isRwShare),
    canUpload:   !isTrash && !isSharedIndex && (!isSharedInside || isRwShare),
    canMkdir:    !isTrash && !isSharedIndex && (!isSharedInside || isRwShare),
    canPaste:    !isTrash && !isSharedIndex && (!isSharedInside || isRwShare),
  }), [isTrash, isShared, isSharedIndex, isSharedInside, isRwShare])

  /* Shared data-plane state (parallel to fileSystem store, scoped to a
   * single share + subpath).  Refetched on share/subpath change. */
  const [sharedEntries, setSharedEntries] = useState<FileEntry[]>([])
  const [sharedStatus, setSharedStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')

  const [shareOpen, setShareOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<FileEntry | null>(null)

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOriginPath, setSearchOriginPath] = useState<string | null>(null)
  const [contextEntry, setContextEntry] = useState<FileEntry | null>(null)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloadDialogEntry, setDownloadDialogEntry] = useState<FileEntry | null>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [gridColumnCount, setGridColumnCount] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastClickedRef = useRef<string | null>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>())
  const shouldFocusActiveRef = useRef(false)

  // Sync path from URL on mount
  useEffect(() => {
    const path = searchParams.get('path') || '.'
    dispatch(setCurrentPath(path))
    if (path === TRASH_PATH) {
      dispatch(listTrashThunk())
    } else if (path.startsWith('shared:')) {
      dispatch(fetchIncomingThunk())
    } else {
      dispatch(listDirThunk(path))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Refresh incoming list whenever we enter shared mode (covers sidebar
   * navigation that doesn't fire the mount effect). */
  useEffect(() => {
    if (isShared) dispatch(fetchIncomingThunk())
  }, [isShared, dispatch])

  /* Shared-inside: fetch this share's directory contents. */
  useEffect(() => {
    if (!isSharedInside) return
    setSharedStatus('loading')
    shareList(sharedParts.id, sharedSubpath)
      .then((r) => { setSharedEntries(r.entries); setSharedStatus('loaded') })
      .catch((err) => {
        setSharedStatus('error')
        toast.error(err instanceof Error ? err.message : 'Failed to list share')
      })
  }, [isSharedInside, sharedParts?.id, sharedSubpath])

  /* For shared-index, render each incoming share as a directory/file
   * entry.  Maintain a parallel name→share map so click handlers can
   * resolve back to the share record (basenames may collide between
   * shares — disambiguate with a suffix). */
  const sharedIndexResolved = useMemo(() => {
    if (!isSharedIndex) return { entries: [] as FileEntry[], byName: new Map<string, Share>() }
    const byName = new Map<string, Share>()
    const taken = new Set<string>()
    const out: FileEntry[] = []
    for (const s of incomingShares) {
      const base = s.source_path.split('/').pop() || s.source_path
      let name = base
      let n = 1
      while (taken.has(name)) name = `${base} (${n++})`
      taken.add(name)
      byName.set(name, s)
      out.push({
        name,
        type: s.kind === 'dir' ? 'dir' : 'file',
        size: 0,
        modified: new Date((s.expires_at || s.created_at) * 1000).toISOString(),
        mime: s.kind === 'dir' ? 'inode/directory' : 'application/octet-stream',
      })
    }
    return { entries: out, byName }
  }, [isSharedIndex, incomingShares])

  const effectiveEntries = useMemo(() => {
    if (isTrash) return trashItems.map((item) => ({
      name: item.name,
      type: item.type,
      size: item.size,
      modified: item.deleted_at,
      mime: '',
    }))
    if (isSharedIndex)  return sharedIndexResolved.entries
    if (isSharedInside) return sharedEntries
    return entries
  }, [isTrash, isSharedIndex, isSharedInside, sharedIndexResolved, sharedEntries, entries, trashItems])

  /* Effective loading status — hide skeleton in shared mode if we already
   * have results, or use a dedicated state. */
  const effectiveStatus = useMemo(() => {
    if (isSharedInside) return sharedStatus
    return status
  }, [isSharedInside, sharedStatus, status])

  // Sort entries
  const sortedEntries = useMemo(() => {
    const sorted = [...effectiveEntries].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'size') cmp = a.size - b.size
      else cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime()
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [effectiveEntries, sortBy, sortOrder])

  const resolvePath = useCallback(
    (name: string) => (currentPath === '.' ? name : `${currentPath}/${name}`),
    [currentPath],
  )

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sortedEntries
    return sortedEntries.filter((entry) => entry.name.toLowerCase().includes(query))
  }, [searchQuery, sortedEntries])

  const effectiveActivePath = useMemo(() => {
    if (!filteredEntries.length) return null
    if (activePath && filteredEntries.some((entry) => entry.name === activePath)) return activePath
    const preferred = selectedPaths.find((path) => filteredEntries.some((entry) => entry.name === path))
    return preferred ?? null
  }, [activePath, filteredEntries, selectedPaths])

  useEffect(() => {
    if (!effectiveActivePath || !shouldFocusActiveRef.current) return
    const node = itemRefs.current.get(effectiveActivePath)
    if (!node) return
    node.focus()
    shouldFocusActiveRef.current = false
  }, [effectiveActivePath, viewMode])


  const navigateTo = useCallback(
    async (path: string) => {
      setSearchQuery('')
      setSearchOriginPath(null)
      if (path === TRASH_PATH) {
        dispatch(setCurrentPath(path))
        dispatch(listTrashThunk())
        setSearchParams({ path })
        return
      }
      if (path.startsWith('shared:')) {
        dispatch(setCurrentPath(path))
        setSearchParams({ path })
        return
      }
      try {
        await dispatch(listDirThunk(path)).unwrap()
        setSearchParams(path === '.' ? {} : { path })
      } catch {
        // Directory listing failed — don't update path or URL
      }
    },
    [dispatch, setSearchParams],
  )

  /* Resolve an entry name → absolute filesystem path (for shared-mode FS
   * ops that need the real source path on disk). */
  const resolveSharedAbsolutePath = useCallback((name: string) => {
    if (!isSharedInside || !activeShare) return null
    const base = activeShare.source_path
    if (sharedSubpath === '.') return `${base}/${name}`
    return `${base}/${sharedSubpath}/${name}`
  }, [isSharedInside, activeShare, sharedSubpath])

  const updateSearchQuery = useCallback(
    (value: string) => {
      if (value && !searchQuery) setSearchOriginPath(currentPath)
      if (!value) setSearchOriginPath(null)
      setSearchQuery(value)
    },
    [currentPath, searchQuery],
  )

  const startSearch = useCallback(
    (value: string) => {
      if (!value) return
      if (!searchQuery) setSearchOriginPath(currentPath)
      setSearchQuery((prev) => `${prev}${value}`)
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.setSelectionRange(searchInputRef.current.value.length, searchInputRef.current.value.length)
      })
    },
    [currentPath, searchQuery],
  )

  const clearSearch = useCallback(
    (restoreOriginPath = false) => {
      const originPath = searchOriginPath
      setSearchQuery('')
      setSearchOriginPath(null)
      if (restoreOriginPath && originPath && originPath !== currentPath) {
        navigateTo(originPath)
      }
    },
    [currentPath, navigateTo, searchOriginPath],
  )

  const handleItemClick = useCallback(
    (entry: FileEntry, e: React.MouseEvent) => {
      setActivePath(entry.name)
      setContextEntry(entry)
      if (e.ctrlKey || e.metaKey) {
        dispatch(toggleSelect(entry.name))
      } else if (e.shiftKey && lastClickedRef.current) {
        const names = filteredEntries.map((e) => e.name)
        const start = names.indexOf(lastClickedRef.current)
        const end = names.indexOf(entry.name)
        const range = names.slice(Math.min(start, end), Math.max(start, end) + 1)
        dispatch(setSelectedPaths(range))
      } else {
        dispatch(setSelectedPaths([entry.name]))
      }
      lastClickedRef.current = entry.name
    },
    [dispatch, filteredEntries],
  )

  const openFile = useCallback(
    (entry: FileEntry) => {
      const fullPath = resolvePath(entry.name)
      const viewType = getFileViewType(entry.name, entry.mime)

      switch (viewType) {
        case 'image':
          break;
        case 'video':
          break;
        case 'audio':
          break;
        case 'pdf':
          window.open(getDownloadUrl(fullPath, true), '_blank')
          break
        case 'text':
          window.open(`/view?path=${encodeURIComponent(fullPath)}`, '_blank')
          break
        case 'unsupported':
          setDownloadDialogEntry(entry)
          setDownloadDialogOpen(true)
          break
      }
    },
    [resolvePath],
  )

  const handleItemDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (isTrash) return
      if (isSharedIndex) {
        const share = sharedIndexResolved.byName.get(entry.name)
        if (!share) return
        if (share.kind === 'dir') {
          navigateTo(`${SHARED_PATH}${share.id}`)
        } else {
          /* File-share: download directly. */
          shareDownload(share.id, '.', entry.name)
        }
        return
      }
      if (isSharedInside && activeShare) {
        if (entry.type === 'dir') {
          const newSub = sharedSubpath === '.' ? entry.name : `${sharedSubpath}/${entry.name}`
          navigateTo(`${SHARED_PATH}${activeShare.id}/${newSub}`)
        } else {
          shareDownload(activeShare.id,
            sharedSubpath === '.' ? entry.name : `${sharedSubpath}/${entry.name}`,
            entry.name)
        }
        return
      }
      if (entry.type === 'dir') {
        navigateTo(resolvePath(entry.name))
      } else {
        openFile(entry)
      }
    },
    [isTrash, isSharedIndex, isSharedInside, activeShare, sharedSubpath, sharedIndexResolved, navigateTo, openFile, resolvePath],
  )

  /* Refetch directory when any upload completes */
  useEffect(() => {
    const unsub = uploadEngine.onComplete((item) => {
      // Extract directory from dest (e.g. "subdir/file.zip" → "subdir", "file.zip" → ".")
      const lastSlash = item.dest.lastIndexOf('/')
      const destDir = lastSlash > 0 ? item.dest.slice(0, lastSlash) : '.'
      if (destDir === currentPath || (destDir === '.' && currentPath === '.')) {
        dispatch(listDirThunk(currentPath))
      }
      toast.success(`Uploaded "${item.filename}"`)
    })
    return unsub
  }, [dispatch, currentPath])

  const refreshSharedListing = useCallback(() => {
    if (!isSharedInside) return
    setSharedStatus('loading')
    shareList(sharedParts.id, sharedSubpath)
      .then((r) => { setSharedEntries(r.entries); setSharedStatus('loaded') })
      .catch(() => setSharedStatus('error'))
  }, [isSharedInside, sharedParts?.id, sharedSubpath])

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      if (isSharedInside && activeShare && isRwShare) {
        for (const f of Array.from(files)) {
          try {
            const dest = sharedSubpath === '.' ? f.name : `${sharedSubpath}/${f.name}`
            await shareUpload(activeShare.id, dest, f)
            toast.success(`Uploaded "${f.name}"`)
          } catch (err) {
            toast.error(`Upload failed: ${err instanceof Error ? err.message : 'unknown'}`)
          }
        }
        refreshSharedListing()
        return
      }
      if (!caps.canUpload) return
      uploadEngine.addFiles(Array.from(files), currentPath)
    },
    [isSharedInside, activeShare, isRwShare, sharedSubpath, caps.canUpload, currentPath, refreshSharedListing],
  )

  const handleDelete = useCallback(
    async (names: string[]) => {
      if (isSharedInside && activeShare && isRwShare) {
        for (const name of names) {
          try {
            const sub = sharedSubpath === '.' ? name : `${sharedSubpath}/${name}`
            await shareDeleteFile(activeShare.id, sub)
          } catch (err) {
            toast.error(`Failed to delete ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }
        dispatch(clearSelection())
        refreshSharedListing()
        toast.success(`Deleted ${names.length} item${names.length > 1 ? 's' : ''}`)
        return
      }
      for (const name of names) {
        const entry = entries.find((e) => e.name === name)
        if (!entry) continue
        const fullPath = resolvePath(name)
        try {
          if (entry.type === 'dir') await dispatch(deleteDirThunk(fullPath)).unwrap()
          else await dispatch(deleteFileThunk(fullPath)).unwrap()
        } catch (err: unknown) {
          toast.error(`Failed to delete ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      dispatch(clearSelection())
      toast.success(`Deleted ${names.length} item${names.length > 1 ? 's' : ''}`)
    },
    [dispatch, entries, resolvePath, isSharedInside, activeShare, isRwShare, sharedSubpath, refreshSharedListing],
  )

  const handleTrashDelete = useCallback(
    async (names: string[]) => {
      for (const name of names) {
        try {
          await dispatch(deleteTrashItemThunk(name)).unwrap()
        } catch (err: unknown) {
          toast.error(`Failed to delete ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      dispatch(clearSelection())
      toast.success(`Permanently deleted ${names.length} item${names.length > 1 ? 's' : ''}`)
    },
    [dispatch],
  )

  const handleRestore = useCallback(
    async (names: string[]) => {
      for (const name of names) {
        try {
          await dispatch(restoreItemThunk(name)).unwrap()
        } catch (err: unknown) {
          toast.error(`Failed to restore ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      dispatch(clearSelection())
      toast.success(`Restored ${names.length} item${names.length > 1 ? 's' : ''}`)
    },
    [dispatch],
  )

  const handleEmptyTrash = useCallback(async () => {
    try {
      await dispatch(emptyTrashThunk()).unwrap()
      dispatch(clearSelection())
      toast.success('Trash emptied')
    } catch (err: unknown) {
      toast.error(`Failed to empty trash: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [dispatch])

  const handlePaste = useCallback(async () => {
    if (!clipboard) return
    for (const sourcePath of clipboard.paths) {
      const name = sourcePath.split('/').pop() || sourcePath
      const destPath = resolvePath(name)
      try {
        if (clipboard.operation === 'copy') {
          await dispatch(copyFileThunk({ from: sourcePath, to: destPath })).unwrap()
        } else {
          await dispatch(moveFileThunk({ from: sourcePath, to: destPath })).unwrap()
        }
      } catch (err: unknown) {
        toast.error(`${clipboard.operation} failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    if (clipboard.operation === 'cut') dispatch(setClipboard(null))
    toast.success(`${clipboard.operation === 'copy' ? 'Copied' : 'Moved'} ${clipboard.paths.length} item${clipboard.paths.length > 1 ? 's' : ''}`)
  }, [clipboard, dispatch, resolvePath])

  const getItemRef = useCallback(
    (name: string) => (node: HTMLDivElement | null) => {
      if (node) itemRefs.current.set(name, node)
      else itemRefs.current.delete(name)
    },
    [],
  )

  const focusEntryByIndex = useCallback((index: number, focus = true) => {
    const clampedIndex = Math.max(0, Math.min(index, filteredEntries.length - 1))
    const nextEntry = filteredEntries[clampedIndex]
    if (!nextEntry) return null
    setActivePath(nextEntry.name)
    setContextEntry(nextEntry)
    if (focus) shouldFocusActiveRef.current = true
    return nextEntry
  }, [filteredEntries])

  const selectRangeToEntry = useCallback((targetName: string) => {
    const names = filteredEntries.map((entry) => entry.name)
    const anchorName = lastClickedRef.current ?? effectiveActivePath ?? targetName
    const start = names.indexOf(anchorName)
    const end = names.indexOf(targetName)
    if (start === -1 || end === -1) {
      dispatch(setSelectedPaths([targetName]))
      return
    }

    dispatch(setSelectedPaths(names.slice(Math.min(start, end), Math.max(start, end) + 1)))
  }, [dispatch, effectiveActivePath, filteredEntries])

  const openProperties = useCallback((entry: FileEntry) => {
    dispatch(setPreviewFile(entry))
    setContextEntry(entry)
    setActivePath(entry.name)
  }, [dispatch])

  const focusFirstEntryFromSearch = useCallback(() => {
    if (!filteredEntries.length) return
    const nextEntry = filteredEntries.find((entry) => entry.name === effectiveActivePath) ?? filteredEntries[0]
    setActivePath(nextEntry.name)
    setContextEntry(nextEntry)
    dispatch(setSelectedPaths([nextEntry.name]))
    lastClickedRef.current = nextEntry.name
    // Directly focus the DOM node — the effect won't fire if effectiveActivePath didn't change
    const node = itemRefs.current.get(nextEntry.name)
    if (node) node.focus()
    else shouldFocusActiveRef.current = true
  }, [dispatch, effectiveActivePath, filteredEntries])

  const focusActiveEntry = useCallback(() => {
    if (!filteredEntries.length) return
    const nextEntry = filteredEntries.find((entry) => entry.name === effectiveActivePath) ?? filteredEntries[0]
    setActivePath(nextEntry.name)
    setContextEntry(nextEntry)
    const node = itemRefs.current.get(nextEntry.name)
    if (node) node.focus()
    else shouldFocusActiveRef.current = true
  }, [effectiveActivePath, filteredEntries])

  const handleItemKeyDown = useCallback((entry: FileEntry, e: React.KeyboardEvent) => {
    const currentIndex = filteredEntries.findIndex((item) => item.name === entry.name)
    if (currentIndex === -1) return

    const moveTo = (index: number) => {
      const nextEntry = focusEntryByIndex(index)
      if (!nextEntry) return

      if (e.shiftKey) {
        selectRangeToEntry(nextEntry.name)
      } else if (!(e.ctrlKey || e.metaKey)) {
        dispatch(setSelectedPaths([nextEntry.name]))
        lastClickedRef.current = nextEntry.name
      }
    }

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        moveTo(viewMode === 'grid' ? currentIndex + 1 : currentIndex)
        return
      case 'ArrowLeft':
        e.preventDefault()
        moveTo(viewMode === 'grid' ? currentIndex - 1 : currentIndex)
        return
      case 'ArrowDown':
        e.preventDefault()
        moveTo(viewMode === 'grid' ? currentIndex + gridColumnCount : currentIndex + 1)
        return
      case 'ArrowUp':
        e.preventDefault()
        moveTo(viewMode === 'grid' ? currentIndex - gridColumnCount : currentIndex - 1)
        return
      case 'Home':
        e.preventDefault()
        moveTo(0)
        return
      case 'End':
        e.preventDefault()
        moveTo(filteredEntries.length - 1)
        return
      case 'Enter':
        e.preventDefault()
        handleItemDoubleClick(entry)
        return
      case ' ':
        e.preventDefault()
        setContextEntry(entry)
        setActivePath(entry.name)
        if (e.ctrlKey || e.metaKey) {
          dispatch(toggleSelect(entry.name))
        } else if (e.shiftKey) {
          selectRangeToEntry(entry.name)
        } else {
          dispatch(setSelectedPaths([entry.name]))
          lastClickedRef.current = entry.name
        }
        return
      case 'F2':
        e.preventDefault()
        dispatch(setSelectedPaths([entry.name]))
        setRenameTarget(entry.name)
        setRenameOpen(true)
        return
      case 'Delete':
        e.preventDefault()
        setDeleteTargets(selectedPaths.includes(entry.name) ? selectedPaths : [entry.name])
        setDeleteOpen(true)
        return
      default:
        if (e.altKey && e.key === 'Enter') {
          e.preventDefault()
          openProperties(entry)
        }
    }
  }, [
    dispatch,
    filteredEntries,
    focusEntryByIndex,
    gridColumnCount,
    handleItemDoubleClick,
    openProperties,
    selectRangeToEntry,
    selectedPaths,
    viewMode,
  ])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusFirstEntryFromSearch()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      clearSearch(false)
      focusActiveEntry()
    }
  }, [clearSearch, focusActiveEntry, focusFirstEntryFromSearch])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (e.key === 'Escape' && searchQuery) {
        e.preventDefault()
        clearSearch(true)
        searchInputRef.current?.blur()
        dispatch(clearSelection())
        dispatch(setPreviewFile(null))
        focusActiveEntry()
        return
      }

      if (isEditableTarget) return

      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        focusFirstEntryFromSearch()
        return
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        e.preventDefault()
        startSearch(e.key)
        return
      }

      if (e.key === 'Delete' && selectedPaths.length) {
        e.preventDefault()
        setDeleteTargets(selectedPaths)
        setDeleteOpen(true)
      }
      if (e.altKey && e.key === 'Enter' && effectiveActivePath) {
        const activeEntry = filteredEntries.find((entry) => entry.name === effectiveActivePath)
        if (activeEntry) {
          e.preventDefault()
          openProperties(activeEntry)
        }
      }
      if (e.key === 'F2' && selectedPaths.length === 1) {
        e.preventDefault()
        setRenameTarget(selectedPaths[0])
        setRenameOpen(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        dispatch(setSelectedPaths(filteredEntries.map((e) => e.name)))
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedPaths.length && caps.canCopy) {
        e.preventDefault()
        const paths = isSharedInside
          ? selectedPaths.map((n) => resolveSharedAbsolutePath(n) || n)
          : selectedPaths.map(resolvePath)
        dispatch(setClipboard({ operation: 'copy', paths }))
        toast('Copied to clipboard')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedPaths.length && caps.canDelete) {
        e.preventDefault()
        dispatch(setClipboard({ operation: 'cut', paths: selectedPaths.map(resolvePath) }))
        toast('Cut to clipboard')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard && caps.canPaste) {
        e.preventDefault()
        handlePaste()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (searchQuery) clearSearch(false)
        dispatch(clearSelection())
        dispatch(setPreviewFile(null))
        setContextEntry(null)
      }
      if (e.key === 'Backspace' && !selectedPaths.length && currentPath !== '.') {
        e.preventDefault()
        const parent = currentPath.includes('/') ? currentPath.split('/').slice(0, -1).join('/') || '.' : '.'
        navigateTo(parent)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    selectedPaths,
    filteredEntries,
    clipboard,
    currentPath,
    dispatch,
    resolvePath,
    navigateTo,
    handlePaste,
    searchQuery,
    startSearch,
    clearSearch,
    effectiveActivePath,
    focusActiveEntry,
    focusFirstEntryFromSearch,
    openProperties,
  ])

  // Drag and drop — only when uploads are allowed in this mode
  const handleDragOver = (e: React.DragEvent) => {
    if (!caps.canUpload) return
    e.preventDefault()
    setDragging(true)
  }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    if (!caps.canUpload) return
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100">
              <FolderOpen className="h-7 w-7 text-indigo-600" />
            </div>
            <p className="text-base font-semibold text-indigo-600">Drop files to upload</p>
            <p className="mt-1 text-sm text-slate-500">Files will be added to the current folder</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-[#1E2640] dark:bg-[#0C0F1A]">
        <Breadcrumbs />
      </div>

      <div className="border-b border-slate-100 bg-white px-5 py-2 dark:border-[#1E2640] dark:bg-[#0C0F1A]">
        <Toolbar
          onNewFolder={() => setNewFolderOpen(true)}
          onUpload={handleUploadFiles}
          onBulkDelete={() => {
            setDeleteTargets(selectedPaths)
            setDeleteOpen(true)
          }}
          onBulkDownload={() => {
            selectedPaths.forEach((name) => {
              if (isSharedIndex) {
                const share = sharedIndexResolved.byName.get(name)
                if (share && share.kind === 'file') shareDownload(share.id, '.', name)
                return
              }
              if (isSharedInside && activeShare) {
                const sub = sharedSubpath === '.' ? name : `${sharedSubpath}/${name}`
                const entry = sharedEntries.find((e) => e.name === name)
                if (entry?.type === 'file') shareDownload(activeShare.id, sub, name)
                return
              }
              const entry = entries.find((e) => e.name === name)
              if (entry?.type === 'file') downloadFile(resolvePath(name), name)
            })
          }}
          searchQuery={searchQuery}
          onSearchChange={updateSearchQuery}
          onSearchKeyDown={handleSearchKeyDown}
          searchInputRef={searchInputRef}
          trashMode={isTrash}
          onBulkRestore={() => handleRestore(selectedPaths)}
          onEmptyTrash={handleEmptyTrash}
          canMkdir={caps.canMkdir}
          canUpload={caps.canUpload}
          canDelete={caps.canDelete}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-1 overflow-auto p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              dispatch(clearSelection())
              setContextEntry(null)
            }
          }}
        >
          {effectiveStatus === 'loading' && !filteredEntries.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100">
                <FolderOpen className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {searchQuery
                  ? 'No matches found'
                  : isTrash
                    ? 'Trash is empty'
                    : isSharedIndex
                      ? 'Nothing shared with you'
                      : 'This folder is empty'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {searchQuery
                  ? `No files or folders match "${searchQuery}"`
                  : isTrash
                    ? 'Deleted files will appear here'
                    : isSharedIndex
                      ? 'Items others share with you appear here'
                      : caps.canUpload
                        ? 'Drop files here or click Upload to get started'
                        : ''}
              </p>
            </div>
          ) : (
            <FileContextMenu
              entry={contextEntry ?? undefined}
              trashMode={isTrash}
              onOpen={() => {
                if (!contextEntry) return
                handleItemDoubleClick(contextEntry)
              }}
              onDownload={() => {
                if (!contextEntry || contextEntry.type !== 'file') return
                if (isSharedIndex) {
                  const share = sharedIndexResolved.byName.get(contextEntry.name)
                  if (share) shareDownload(share.id, '.', contextEntry.name)
                } else if (isSharedInside && activeShare) {
                  shareDownload(activeShare.id,
                    sharedSubpath === '.' ? contextEntry.name : `${sharedSubpath}/${contextEntry.name}`,
                    contextEntry.name)
                } else {
                  downloadFile(resolvePath(contextEntry.name), contextEntry.name)
                }
              }}
              onRename={!caps.canRename ? undefined : () => {
                if (!contextEntry) return
                setRenameTarget(contextEntry.name)
                setRenameOpen(true)
              }}
              onCopy={!caps.canCopy ? undefined : () => {
                if (!contextEntry) return
                const p = isSharedInside
                  ? resolveSharedAbsolutePath(contextEntry.name) || contextEntry.name
                  : resolvePath(contextEntry.name)
                dispatch(setClipboard({ operation: 'copy', paths: [p] }))
                toast('Copied to clipboard')
              }}
              onDelete={!caps.canDelete ? undefined : () => {
                if (!contextEntry) return
                setDeleteTargets([contextEntry.name])
                setDeleteOpen(true)
              }}
              onRestore={() => {
                if (!contextEntry) return
                handleRestore([contextEntry.name])
              }}
              onInfo={() => {
                if (!contextEntry) return
                openProperties(contextEntry)
              }}
              onBookmark={!caps.canBookmark ? undefined : () => {
                if (!contextEntry || contextEntry.type !== 'dir') return
                const fullPath = isSharedInside
                  ? (resolveSharedAbsolutePath(contextEntry.name) || resolvePath(contextEntry.name))
                  : resolvePath(contextEntry.name)
                dispatch(addBookmarkThunk({ path: fullPath, label: contextEntry.name }))
                toast.success(`Bookmarked "${contextEntry.name}"`)
              }}
              onShare={!caps.canShare ? undefined : () => {
                if (!contextEntry) return
                setShareTarget(contextEntry)
                setShareOpen(true)
              }}
              onNewFolder={!caps.canMkdir ? undefined : () => setNewFolderOpen(true)}
              onUpload={!caps.canUpload ? undefined : () => fileInputRef.current?.click()}
              onRefresh={() => {
                if (isTrash) dispatch(listTrashThunk())
                else if (isSharedIndex) dispatch(fetchIncomingThunk())
                else if (isSharedInside) refreshSharedListing()
                else dispatch(listDirThunk(currentPath))
              }}
            >
              <div>
                {viewMode === 'grid' ? (
                  <FileGrid
                    entries={filteredEntries}
                    selectedPaths={selectedPaths}
                    activePath={effectiveActivePath}
                    iconSize={iconSize}
                    onItemClick={handleItemClick}
                    onItemDoubleClick={handleItemDoubleClick}
                    onItemContextMenu={(entry, e) => {
                      e.preventDefault()
                      dispatch(setSelectedPaths([entry.name]))
                      setActivePath(entry.name)
                      setContextEntry(entry)
                    }}
                    onItemFocus={(entry) => {
                      setActivePath(entry.name)
                      setContextEntry(entry)
                    }}
                    onItemKeyDown={handleItemKeyDown}
                    onColumnCountChange={setGridColumnCount}
                    getItemRef={getItemRef}
                  />
                ) : (
                  <FileList
                    entries={filteredEntries}
                    selectedPaths={selectedPaths}
                    activePath={effectiveActivePath}
                    onItemClick={handleItemClick}
                    onItemDoubleClick={handleItemDoubleClick}
                    onItemContextMenu={(entry, e) => {
                      e.preventDefault()
                      dispatch(setSelectedPaths([entry.name]))
                      setActivePath(entry.name)
                      setContextEntry(entry)
                    }}
                    onItemFocus={(entry) => {
                      setActivePath(entry.name)
                      setContextEntry(entry)
                    }}
                    onItemKeyDown={handleItemKeyDown}
                    getItemRef={getItemRef}
                  />
                )}
              </div>
            </FileContextMenu>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUploadFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

      </div>

      <FilePreview />

      {/* Dialogs */}
      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} />
      <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} currentName={renameTarget} />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        names={deleteTargets}
        permanent={isTrash}
        onConfirm={() => {
          if (isTrash) {
            handleTrashDelete(deleteTargets)
          } else {
            handleDelete(deleteTargets)
          }
          setDeleteOpen(false)
        }}
      />
      <DownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        filename={downloadDialogEntry?.name ?? ''}
        onDownload={() => {
          if (downloadDialogEntry) {
            downloadFile(resolvePath(downloadDialogEntry.name), downloadDialogEntry.name)
          }
        }}
      />
      {shareTarget && user && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          sourcePath={(() => {
            const rel = resolvePath(shareTarget.name)
            const home = user.home || '/'
            if (rel === '.') return home
            if (rel.startsWith('/')) return rel
            return `${home}/${rel}`
          })()}
          kind={shareTarget.type === 'dir' ? 'dir' : 'file'}
        />
      )}
    </div>
  )
}
