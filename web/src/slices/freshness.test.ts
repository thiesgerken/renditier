import { createAppStore } from '../store';
import { fetchPerformance, invalidatePerformance } from './performance';
import { fetchStocks } from './stocks';

// The containers fetch after every render, so a failed load must not let the
// next fetch through.
describe('a failed load', () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 500 }))
  );

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not retried right away', async () => {
    const store = createAppStore();

    await store.dispatch(fetchStocks());
    await store.dispatch(fetchStocks());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getState().stocks.error).not.toBeNull();
  });

  it('is retried after an invalidation, once', async () => {
    const store = createAppStore();

    await store.dispatch(fetchPerformance());
    store.dispatch(invalidatePerformance());
    await store.dispatch(fetchPerformance());
    await store.dispatch(fetchPerformance());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
