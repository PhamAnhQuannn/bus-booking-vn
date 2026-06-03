/**
 * Distinct, bookable place names for the search-form typeahead suggestions.
 *
 * Issue 044: now sourced from the canonical Place registry (canonicalName ∪
 * aliases) via lib/places, NOT the raw Route origin/destination columns. The
 * exported name + signature are unchanged so existing callers don't change.
 */

import { listSearchablePlaces } from './placeRepo';

export async function getSearchablePlaces(): Promise<string[]> {
  return listSearchablePlaces();
}
