/**
 * [SYS20] lib/core — cross-cutting primitives barrel.
 *
 * `lib/core` holds primitives imported BY domains; it imports NO domain. Direction of the
 * dependency graph: app → lib/<domain> → lib/core (no cycles, SYS20 rule 4).
 *
 * Only the populated sub-barrels are re-exported here. The placeholder sub-areas
 * (money/ time/ id/ result/ errors/ jobs/ http/) are empty barrels until their real
 * primitives migrate in later waves — they are intentionally left out of this top-level
 * barrel so consumers don't import dead surface.
 */

export * from './logger';
export * from './config';
export * from './db';
