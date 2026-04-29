import { apiRequest, API_URL } from './client'

export type ShareKind = 'file' | 'dir'
export type ShareMode = 'ro' | 'rw'

export interface Share {
  id: string
  sharer: string
  recipient: string
  source_path: string
  kind: ShareKind
  mode: ShareMode
  created_at: number
  expires_at: number
  revoked: boolean
  stale: boolean
}

export interface ShareUser {
  username: string
  uid: number
}

export interface ShareEntry {
  name: string
  type: 'file' | 'dir'
  size: number
  modified: string
  mime: string
}

export interface ShareListResponse {
  path: string
  entries: ShareEntry[]
}

export interface ShareStat {
  name: string
  type: 'file' | 'dir'
  size: number
  mode: string
  uid: number
  modified: string
  mime: string
}

export interface CreateShareInput {
  source: string
  recipient: string
  kind: ShareKind
  mode: ShareMode
  expires_at: number
}

export function createShare(input: CreateShareInput) {
  return apiRequest<Share>('/share', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function revokeShare(id: string) {
  return apiRequest<{ message: string }>(`/share/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function listIncomingShares() {
  return apiRequest<{ shares: Share[] }>('/share/incoming')
}

export function listOutgoingShares() {
  return apiRequest<{ shares: Share[] }>('/share/outgoing')
}

export function listShareUsers() {
  return apiRequest<{ users: ShareUser[] }>('/share/users')
}

export function shareList(id: string, subpath: string) {
  return apiRequest<ShareListResponse>(
    `/share/${encodeURIComponent(id)}/list?path=${encodeURIComponent(subpath || '.')}`,
  )
}

export function shareStat(id: string, subpath: string) {
  return apiRequest<ShareStat>(
    `/share/${encodeURIComponent(id)}/stat?path=${encodeURIComponent(subpath || '.')}`,
  )
}

export function shareReadContent(id: string, subpath: string) {
  return apiRequest<{ path: string; content: string }>(
    `/share/${encodeURIComponent(id)}/content?path=${encodeURIComponent(subpath || '.')}`,
  )
}

export function shareWriteContent(id: string, subpath: string, content: string) {
  return apiRequest<{ message: string; size: number }>(
    `/share/${encodeURIComponent(id)}/content?path=${encodeURIComponent(subpath || '.')}`,
    {
      method: 'PUT',
      body: content,
      headers: { 'Content-Type': 'text/plain' },
    },
  )
}

export function shareMkdir(id: string, subpath: string) {
  return apiRequest<{ message: string }>(
    `/share/${encodeURIComponent(id)}/mkdir`,
    {
      method: 'POST',
      body: JSON.stringify({ path: subpath }),
    },
  )
}

export function shareDeleteFile(id: string, subpath: string) {
  return apiRequest<{ message: string }>(
    `/share/${encodeURIComponent(id)}/file?path=${encodeURIComponent(subpath)}`,
    { method: 'DELETE' },
  )
}

export function shareUpload(id: string, subpath: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/share/${encodeURIComponent(id)}/upload?path=${encodeURIComponent(subpath)}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(xhr.responseText || xhr.statusText))
    })
    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.send(file)
  })
}

export function shareDownload(id: string, subpath: string, filename?: string) {
  const a = document.createElement('a')
  a.href = `${API_URL}/share/${encodeURIComponent(id)}/download?path=${encodeURIComponent(subpath || '.')}`
  if (filename) a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
