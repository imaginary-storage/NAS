import { apiRequest } from './client'

export interface AwsSyncLastRun {
  startedAt: string
  finishedAt: string
  exitCode: number
  summary: string
}

export interface AwsSyncConfig {
  enabled: boolean
  folder: string
  bucket: string
  prefix: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  storageClass: 'DEEP_ARCHIVE' | 'GLACIER' | 'STANDARD'
  intervalMinutes: number
  lastRun: AwsSyncLastRun | null
}

export function getAwsSync() {
  return apiRequest<AwsSyncConfig>('/aws-sync')
}

export function saveAwsSync(cfg: AwsSyncConfig) {
  return apiRequest<{ message: string }>('/aws-sync', {
    method: 'PUT',
    body: JSON.stringify(cfg),
  })
}

export function clearAwsSync() {
  return apiRequest<{ message: string }>('/aws-sync', { method: 'DELETE' })
}

export function runAwsSync() {
  return apiRequest<{ message: string }>('/aws-sync/run', { method: 'POST' })
}
