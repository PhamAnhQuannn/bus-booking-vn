# DS-027 Error & Loading States

Patterns for error boundaries, loading skeletons, empty states, and user feedback.

## Error Boundary Hierarchy

| Level | File | Catches | Behavior |
|-------|------|---------|----------|
| Root | `app/global-error.tsx` | Unrecoverable errors in root layout | Full-page fallback with retry button |
| Page | `app/error.tsx` | Runtime errors in page components | Error message + "Try again" within existing layout shell |
| Route-specific | `app/(customer)/booking/error.tsx` etc. | Errors within that route segment | Contextual message (e.g. "Booking failed") with navigation options |

Each error boundary receives `error` and `reset` props. `reset` re-renders the segment. `error.digest` (server errors) shown as generic message; client errors show `error.message`.

## Loading States

### Skeleton Patterns

Loading files (`loading.tsx`) at route segments show skeleton UI matching the page layout shape:

| Route | Skeleton Pattern |
|-------|-----------------|
| `/search` | 3–6 trip card placeholders (animated pulse) |
| `/op/dashboard` | Stat cards (3 rectangles) + trip list placeholder |
| `/op/trips` | Table skeleton with header + 5 shimmering rows |
| `/op/bookings` | Same table skeleton pattern |
| `/account/bookings` | Card list skeleton |

Skeleton base: `bg-muted animate-pulse rounded-xl` with layout-matching dimensions.

### Suspense Boundaries

Server components that fetch data are wrapped in `<Suspense fallback={<Skeleton />}>`. Placement:
- Page-level: entire page content
- Section-level: independent data sections within a page (e.g., dashboard stats vs. trip list)

## Empty States

| Context | Message (Vietnamese) | Action |
|---------|---------------------|--------|
| Search — no results | "Không tìm thấy chuyến xe phù hợp" | Suggest adjusting date/route |
| My bookings — none | "Bạn chưa có đặt vé nào" | Link to search |
| Operator trips — none | "Chưa có chuyến xe nào" | Button to create trip |
| Operator bookings — none | "Chưa có đặt vé nào" | — |
| Manifest — empty | "Chưa có hành khách" | — |

Empty states use centered layout with muted icon + text + optional CTA button.

## API Error → UI Mapping

Server API errors return structured JSON per [ADR-015](../../architecture-decisions/ADR-015-error-contract/):

```
{ code: "seat_unavailable", message: "...", field?: "..." }
```

Client mapping:
- `422` validation → field-level `aria-invalid` + inline error text
- `409` conflict → toast or modal explaining conflict (e.g. seat taken)
- `429` rate limit → toast "Vui lòng thử lại sau" with retry-after countdown
- `401` unauthorized → redirect to login
- `403` forbidden → "Không có quyền truy cập" message
- `500` server error → generic "Đã xảy ra lỗi" with retry option

## Toast / Notification

Success and error feedback via toast notifications:
- Position: top-right (desktop), top-center (mobile)
- Auto-dismiss: 4s (success), 8s (error), persistent (action required)
- Max visible: 3 stacked
- Accessible: `role="status"` (success) or `role="alert"` (error), `aria-live="polite"` / `"assertive"`

## Related

- [FD-008 Accessibility](../FD-008-accessibility/) — ARIA roles on alerts and dynamic content
- [FD-003 Page Inventory](../FD-003-page-inventory/) — error page file locations
- [ADR-015 Error Contract](../../architecture-decisions/ADR-015-error-contract/) — HTTP status semantics and error response shape
- [DS-003 API Contract](../../design-specifications/DS-003-api-contract/) — endpoint error codes
