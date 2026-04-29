import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as api from '@/api/share'
import type { Share, ShareUser, CreateShareInput } from '@/api/share'

interface SharesState {
  incoming: Share[]
  outgoing: Share[]
  users: ShareUser[]
  status: 'idle' | 'loading' | 'loaded' | 'error'
}

const initialState: SharesState = {
  incoming: [],
  outgoing: [],
  users: [],
  status: 'idle',
}

export const fetchIncomingThunk = createAsyncThunk('shares/fetchIncoming', async () => {
  const r = await api.listIncomingShares()
  return r.shares
})

export const fetchOutgoingThunk = createAsyncThunk('shares/fetchOutgoing', async () => {
  const r = await api.listOutgoingShares()
  return r.shares
})

export const fetchShareUsersThunk = createAsyncThunk('shares/fetchUsers', async () => {
  const r = await api.listShareUsers()
  return r.users
})

export const createShareThunk = createAsyncThunk(
  'shares/create',
  async (input: CreateShareInput, { dispatch }) => {
    const r = await api.createShare(input)
    dispatch(fetchOutgoingThunk())
    return r
  },
)

export const revokeShareThunk = createAsyncThunk(
  'shares/revoke',
  async (id: string, { dispatch }) => {
    await api.revokeShare(id)
    dispatch(fetchOutgoingThunk())
    dispatch(fetchIncomingThunk())
  },
)

const sharesSlice = createSlice({
  name: 'shares',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchIncomingThunk.fulfilled, (state, action) => {
        state.incoming = action.payload
        state.status = 'loaded'
      })
      .addCase(fetchOutgoingThunk.fulfilled, (state, action) => {
        state.outgoing = action.payload
        state.status = 'loaded'
      })
      .addCase(fetchShareUsersThunk.fulfilled, (state, action) => {
        state.users = action.payload
      })
  },
})

export default sharesSlice.reducer
