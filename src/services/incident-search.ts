import type { Impact, Incident, IncidentStatus } from '../domain/incident.js';

/** Page size when none is given. */
export const DEFAULT_LIMIT = 20;

/** Largest page size allowed. */
export const MAX_LIMIT = 100;

/** Search criteria. Every filter is optional; they combine with logical AND. */
export interface SearchCriteria {
  /** Free text matched against ID, title and detail, ignoring case and accents. */
  text?: string | undefined;
  status?: IncidentStatus | undefined;
  impact?: Impact | undefined;
  /** `true`: only with a workaround; `false`: only without. */
  workaround?: boolean | undefined;
  /** Page size (default {@link DEFAULT_LIMIT}). */
  limit?: number | undefined;
  /** Matches skipped from the start (default 0). */
  offset?: number | undefined;
}

/** One page of search results. */
export type SearchResult = {
  items: Incident[];
  /** Number of matches before paging. */
  total: number;
};

/** Lowercases `text` and strips diacritics, so searches ignore case and accents. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Filters `incidents` by `criteria` and returns the requested page, in input order. */
export function searchIncidents(
  incidents: readonly Incident[],
  criteria: SearchCriteria = {},
): SearchResult {
  const { status, impact, workaround, limit = DEFAULT_LIMIT, offset = 0 } = criteria;
  const text = criteria.text?.trim();
  const needle = text ? normalizeText(text) : undefined;

  const matches = incidents.filter(
    (incident) =>
      (status === undefined || incident.status === status) &&
      (impact === undefined || incident.impact === impact) &&
      (workaround === undefined || incident.workaround === workaround) &&
      (needle === undefined ||
        normalizeText(`${incident.id} ${incident.title} ${incident.detail}`).includes(needle)),
  );

  return { items: matches.slice(offset, offset + limit), total: matches.length };
}
