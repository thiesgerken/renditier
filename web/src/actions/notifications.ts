export const UPDATE_AVAILABLE = 'UPDATE_AVAILABLE';
export interface UpdateAvailableAction {
  type: typeof UPDATE_AVAILABLE;
}
export const updateAvailable = (): UpdateAvailableAction => ({
  type: UPDATE_AVAILABLE,
});

export const IGNORE_UPDATE = 'IGNORE_UPDATE';
export interface IgnoreUpdateAction {
  type: typeof IGNORE_UPDATE;
}
export const ignoreUpdate = (): IgnoreUpdateAction => ({
  type: IGNORE_UPDATE,
});

export type NotificationsAction = UpdateAvailableAction | IgnoreUpdateAction;
