// Real Vietnamese message catalog, merged into the {namespace: {...}} shape next-intl
// expects — the single source the vitest.setup.ts next-intl / next-intl/server mocks feed
// to next-intl's own createTranslator so unit tests see real strings (not key echoes).
// Namespaces mirror i18n/request.ts exactly: one file per lib/<domain> boundary.
import common from '../messages/vi/common.json';
import home from '../messages/vi/home.json';
import search from '../messages/vi/search.json';
import booking from '../messages/vi/booking.json';
import trips from '../messages/vi/trips.json';
import charter from '../messages/vi/charter.json';
import account from '../messages/vi/account.json';
import auth from '../messages/vi/auth.json';
import planner from '../messages/vi/planner.json';
import metadata from '../messages/vi/metadata.json';
import legal from '../messages/vi/legal.json';

export const viMessages = {
  common, home, search, booking, trips, charter, account, auth, planner, metadata, legal,
} as const;
