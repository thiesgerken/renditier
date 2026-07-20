import type { AppAction, AppThunk } from './types/actions';
import type { PortfolioPerformance, Stock } from './types/api';
import type { ResourceState, StoredError, Timestamp } from './types/store';

// The two slices driven by this generic resource machinery. Constraining the
// name to these keeps `getState()[res.name]` well typed.
export type ResourceName = 'stocks' | 'performance';

export interface ResourcePayloads {
  stocks: Stock[];
  performance: PortfolioPerformance[];
}

export interface ApiResource<N extends ResourceName> {
  name: N;
  url: string;
}

// Action type strings are derived from the resource name, so they come out as a
// union over both resources rather than a single literal. The reducer below
// recovers the precise payload type; consumers read the precise `ResourceState<T>`
// instead, so nothing outside this file needs the finer discrimination.
export type FetchResourceRequestType =
  `FETCH_${Uppercase<ResourceName>}_REQUEST`;
export type FetchResourceSuccessType =
  `FETCH_${Uppercase<ResourceName>}_SUCCESS`;
export type FetchResourceErrorType = `FETCH_${Uppercase<ResourceName>}_ERROR`;
export type InvalidateResourceType = `INVALIDATE_${Uppercase<ResourceName>}`;

export type ResourcePayload = ResourcePayloads[ResourceName];

export interface FetchResourceRequestAction {
  type: FetchResourceRequestType;
}

export interface FetchResourceSuccessAction {
  type: FetchResourceSuccessType;
  data: ResourcePayload;
  receivedAt: Timestamp;
}

export interface FetchResourceErrorAction {
  type: FetchResourceErrorType;
  error: StoredError;
  receivedAt: Timestamp;
}

export interface InvalidateResourceAction {
  type: InvalidateResourceType;
}

export type ResourceAction =
  | FetchResourceRequestAction
  | FetchResourceSuccessAction
  | FetchResourceErrorAction
  | InvalidateResourceAction;

const upper = <N extends ResourceName>(name: N) =>
  name.toUpperCase() as Uppercase<ResourceName>;

export const FETCH_RESOURCE_REQUEST = <N extends ResourceName>(
  res: ApiResource<N>
): FetchResourceRequestType => `FETCH_${upper(res.name)}_REQUEST`;

export const FETCH_RESOURCE_SUCCESS = <N extends ResourceName>(
  res: ApiResource<N>
): FetchResourceSuccessType => `FETCH_${upper(res.name)}_SUCCESS`;

export const FETCH_RESOURCE_ERROR = <N extends ResourceName>(
  res: ApiResource<N>
): FetchResourceErrorType => `FETCH_${upper(res.name)}_ERROR`;

export const INVALIDATE_RESOURCE = <N extends ResourceName>(
  res: ApiResource<N>
): InvalidateResourceType => `INVALIDATE_${upper(res.name)}`;

export const fetchResourceRequest =
  <N extends ResourceName>(res: ApiResource<N>) =>
  (): FetchResourceRequestAction => ({
    type: FETCH_RESOURCE_REQUEST(res),
  });

export const fetchResourceSuccess =
  <N extends ResourceName>(res: ApiResource<N>) =>
  (json: ResourcePayloads[N]): FetchResourceSuccessAction => ({
    type: FETCH_RESOURCE_SUCCESS(res),
    data: json,
    receivedAt: Date.now(),
  });

export const fetchResourceError =
  <N extends ResourceName>(res: ApiResource<N>) =>
  (e: StoredError): FetchResourceErrorAction => ({
    type: FETCH_RESOURCE_ERROR(res),
    error: e,
    receivedAt: Date.now(),
  });

export const invalidateResource =
  <N extends ResourceName>(res: ApiResource<N>) =>
  (): InvalidateResourceAction => ({
    type: INVALIDATE_RESOURCE(res),
  });

export const fetchResource =
  <N extends ResourceName>(res: ApiResource<N>) =>
  (): AppThunk =>
  dispatch => {
    dispatch(fetchResourceRequest(res)());
    return fetch(encodeURI(res.url))
      .then(resp => {
        if (!resp.ok) throw Error(`${resp.status} ${resp.statusText}`);
        return resp.json() as Promise<
          ResourcePayloads[N] & { error?: StoredError }
        >;
      })
      .then(resp => {
        if (resp.error) throw resp.error;

        dispatch(fetchResourceSuccess(res)(resp));
      })
      .catch((e: StoredError) => {
        dispatch(fetchResourceError(res)(e));
      });
  };

export const updateResource =
  <N extends ResourceName>(res: ApiResource<N>) =>
  (): AppThunk =>
  (dispatch, getState) => {
    const resource = getState()[res.name];

    if (
      !resource.didInvalidate &&
      resource.lastRequest !== null &&
      Date.now() - resource.lastRequest > 60 * 60 * 1e3
    )
      dispatch(invalidateResource(res)());

    if (
      !resource.isFetching &&
      // FIXME(tsx-migration): this read `resource.lastUpdated`, a field this
      // slice has never had, so the whole clause was permanently false and the
      // resource only ever refetched via `didInvalidate`. `lastRequest` is the
      // field that actually exists.
      ((resource.lastRequest === null && resource.error === null) ||
        resource.didInvalidate)
    )
      return dispatch(fetchResource(res)());

    return Promise.resolve();
  };

export const resourceActions = <N extends ResourceName>(
  res: ApiResource<N>
) => ({
  update: updateResource(res),
  invalidate: invalidateResource(res),
});

// Spelled out as a plain function type rather than `Reducer<S>` so that the
// action parameter is `AppAction` — matching every hand-written slice reducer,
// which is what `combineReducers` needs to line up in `reducers/index.ts`.
export const resourceReducer = <N extends ResourceName>(
  res: ApiResource<N>
): ((
  state: ResourceState<ResourcePayloads[N]> | undefined,
  action: AppAction
) => ResourceState<ResourcePayloads[N]>) => {
  const initialState: ResourceState<ResourcePayloads[N]> = {
    isFetching: false,
    didInvalidate: true,
    data: null,
    error: null,
    lastRequest: null,
  };

  // The case labels are computed from `res`, so TypeScript cannot narrow the
  // action by comparing against them — each branch asserts the shape the
  // matching creator above produced.
  return (state = initialState, action) => {
    switch (action.type) {
      case INVALIDATE_RESOURCE(res):
        return { ...state, didInvalidate: true };
      case FETCH_RESOURCE_REQUEST(res):
        return { ...state, isFetching: true };
      case FETCH_RESOURCE_SUCCESS(res): {
        const { data, receivedAt } = action as FetchResourceSuccessAction;
        return {
          ...state,
          isFetching: false,
          didInvalidate: false,
          data: data as ResourcePayloads[N],
          lastRequest: receivedAt,
          error: null,
        };
      }
      case FETCH_RESOURCE_ERROR(res): {
        const { error, receivedAt } = action as FetchResourceErrorAction;
        return {
          ...state,
          isFetching: false,
          didInvalidate: true,
          error,
          lastRequest: receivedAt,
        };
      }
      default:
        return state;
    }
  };
};

export const stockResource: ApiResource<'stocks'> = {
  name: 'stocks',
  url: '/api/stocks',
};

export const performanceResource: ApiResource<'performance'> = {
  name: 'performance',
  url: '/api/analysis/performance',
};
