import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import * as api from '@/api/awsSync'
import type { AwsSyncConfig } from '@/api/awsSync'

const DEFAULTS: AwsSyncConfig = {
  enabled: false,
  folder: '',
  bucket: '',
  prefix: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  storageClass: 'DEEP_ARCHIVE',
  intervalMinutes: 5,
  lastRun: null,
}

interface AwsSyncState {
  config: AwsSyncConfig
  status: 'idle' | 'loading' | 'loaded' | 'error'
  saving: boolean
  running: boolean
}

const initialState: AwsSyncState = {
  config: DEFAULTS,
  status: 'idle',
  saving: false,
  running: false,
}

export const fetchAwsSyncThunk = createAsyncThunk('awsSync/fetch', async () => {
  return api.getAwsSync()
})

export const saveAwsSyncThunk = createAsyncThunk(
  'awsSync/save',
  async (cfg: AwsSyncConfig, { dispatch }) => {
    await api.saveAwsSync(cfg)
    // Re-fetch so the UI sees the server-side normalised view (creds redacted, lastRun preserved).
    dispatch(fetchAwsSyncThunk())
  },
)

export const runAwsSyncThunk = createAsyncThunk(
  'awsSync/run',
  async (_: void, { dispatch }) => {
    await api.runAwsSync()
    dispatch(fetchAwsSyncThunk())
  },
)

const awsSyncSlice = createSlice({
  name: 'awsSync',
  initialState,
  reducers: {
    setConfig(state, action: PayloadAction<Partial<AwsSyncConfig>>) {
      state.config = { ...state.config, ...action.payload }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAwsSyncThunk.pending, (state) => {
        if (state.status === 'idle') state.status = 'loading'
      })
      .addCase(fetchAwsSyncThunk.fulfilled, (state, action) => {
        state.status = 'loaded'
        state.config = action.payload
      })
      .addCase(fetchAwsSyncThunk.rejected, (state) => {
        state.status = 'error'
      })
      .addCase(saveAwsSyncThunk.pending, (state) => {
        state.saving = true
      })
      .addCase(saveAwsSyncThunk.fulfilled, (state) => {
        state.saving = false
      })
      .addCase(saveAwsSyncThunk.rejected, (state) => {
        state.saving = false
      })
      .addCase(runAwsSyncThunk.pending, (state) => {
        state.running = true
      })
      .addCase(runAwsSyncThunk.fulfilled, (state) => {
        state.running = false
      })
      .addCase(runAwsSyncThunk.rejected, (state) => {
        state.running = false
      })
  },
})

export const { setConfig } = awsSyncSlice.actions
export default awsSyncSlice.reducer
