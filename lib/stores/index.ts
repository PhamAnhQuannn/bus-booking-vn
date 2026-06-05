/**
 * lib/stores public-API barrel (issue 092b, SYS20 rule-3).
 *
 * Client-side zustand stores. Cross-domain consumers import from `@/lib/stores`.
 */

export { useSearchStore, type SearchQuery } from './searchStore';
