import { maxVenueSelection } from "./venue-preference.ts";

export function parseVenueScope(value: string | string[] | undefined) {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const ids = [...new Set(values)];
  const invalid = values.length > maxVenueSelection || values.some(id => id.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(id))
    || (ids.length > 1 && ids.some(id => id === "all" || id === "none"))
    || encodeURIComponent(ids.join(",")).length > 3500;
  return { requested: invalid ? ["none"] : ids, invalid, pending: values.length === 0 };
}
