# DS-021 Form Design

## Primitives

All form controls wrap `@base-ui/react` headless primitives, styled with Tailwind + CVA.

### Control API

Base-UI controls use **`value` + `onValueChange()`**, NOT `onChange`:

| Component | File | Key API |
|-----------|------|---------|
| Input | `components/ui/input.tsx` | Standard `onChange` (exception) |
| Select | `components/ui/select.tsx` | `value` + `onValueChange()` |
| Checkbox | `components/ui/checkbox.tsx` | `checked` + `onCheckedChange()` |
| RadioGroup | `components/ui/radio-group.tsx` | `value` + `onValueChange()` |
| Combobox | `components/ui/combobox.tsx` | Free-text + filtered suggestions |
| DatePicker | `components/ui/date-picker.tsx` | `value` (YYYY-MM-DD) + `onChange` |
| Calendar | `components/ui/calendar.tsx` | Monday-first, Vietnamese locale |
| Label | `components/ui/label.tsx` | `htmlFor` association |

## Validation

**Client-side:** `aria-invalid` attribute toggles destructive border/ring styling. Error messages via `<p role="alert">`. No client validation library.

**Server-side:** Zod schemas in API route handlers. Structured error JSON mapped to field-level `aria-invalid`.

## Key Forms

### SearchForm (`components/search/SearchForm.tsx`)

- Fields: Origin (Combobox), Destination (Combobox), Date (DatePicker), Ticket Count
- Layout: `flex-col` mobile → `md:flex-row` desktop
- State: Zustand store + localStorage persistence
- Hydration guard: empty defaults server-side, fills from store client-side
- Submit disabled: origin/destination empty OR date < today
- Date min: VN today via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`

### PlaceCombobox (`components/ui/combobox.tsx`)

Free-text input with filtered dropdown (`mode="list"`). Empty state: "Khong tim thay dia diem — ban van co the nhap."

### DatePicker + Calendar

- Button trigger opens Calendar in popover
- Monday-first weeks, Vietnamese month labels via `date-fns` (`vi` locale)
- `min`/`max` bounds grey out days
- Keyboard: Arrow keys, PageUp/Down, Home/End, Enter/Space
- Today: `aria-current="date"`

### ContactBookingForm (`components/contact/ContactBookingForm.tsx`)

Charter inquiry → POST `/api/charter`. 2-col desktop / 1-col mobile. Honeypot: hidden `company` field. On 201 → redirect to confirmation.

### AdminUnitPicker (`components/geo/AdminUnitPicker.tsx`)

Cascading province → district → ward selects for Vietnamese administrative units.

## Auth Forms

### AuthSplitLayout (`components/auth/AuthSplitLayout.tsx`)

Split panel: brand side (gradient + bullets, desktop only) + form side (centered `max-w-sm`). Audience switch: `customer` (orange gradient) vs `operator` (dark gradient).

### Login Page

Phone + password. Inline error `<p role="alert">`. Links to forgot-password, register, operator login.

## CSRF Protection

State-changing client requests include CSRF token:

1. `readCsrfToken()` reads `bb_csrf` cookie (`lib/auth/csrfClient.ts`)
2. Sent as `X-CSRF-Token` header
3. Client components deep-import `@/lib/auth/csrfClient` (NOT barrel `@/lib/auth`)
