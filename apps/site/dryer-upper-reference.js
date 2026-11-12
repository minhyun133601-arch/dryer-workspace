// Field-photo media has been moved out of the active project at the user's
// request. Keep the lifecycle API safe for older local and shared callers.
export const DRYER_UPPER_REFERENCE_PHOTOS = [];

export function createDryerUpperReference() {
  return { open() { return false; }, close() {}, dispose() {} };
}
