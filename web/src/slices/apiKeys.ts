import { fetchJson, fetchOk } from '../api';
import type { ApiKey, CreatedApiKey, NewApiKey } from '../types/api';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { createResourceSlice } from './resource';
import type { Resource } from './resource';

export const createApiKey = createAppAsyncThunk(
  'apiKeys/create',
  (key: NewApiKey) =>
    fetchJson<CreatedApiKey>('/api/keys', {
      method: 'POST',
      body: JSON.stringify(key),
    })
);

export const deleteApiKey = createAppAsyncThunk(
  'apiKeys/delete',
  async (id: number) => {
    await fetchOk(`/api/keys/${id}`, { method: 'DELETE' });
  }
);

// Annotated: the change thunks' types depend on RootState, which in turn is
// inferred from this reducer.
const apiKeys: Resource<ApiKey[]> = createResourceSlice(
  'apiKeys',
  '/api/keys',
  [createApiKey, deleteApiKey]
);

export default apiKeys.reducer;
export const fetchApiKeys = apiKeys.fetch;
