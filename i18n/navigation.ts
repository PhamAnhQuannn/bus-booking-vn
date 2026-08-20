import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Use these INSTEAD of next/link + next/navigation
 * for any customer/planner surface once P0 lands, so links preserve the active locale
 * and switching a locale rewrites the path correctly (as-needed prefix).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
