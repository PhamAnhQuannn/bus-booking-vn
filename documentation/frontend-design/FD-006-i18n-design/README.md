# DS-023 I18n Design

## Current State

**Vietnamese-only, hardcoded.** No i18n library (`next-intl`, `react-i18next`, etc.). No locale switching.

HTML root: `lang="vi"` (static).

## UI Strings

All user-facing text is hardcoded Vietnamese throughout components and pages:

- Buttons: "Dang nhap", "Dang xuat", "Dong y", "Huy", "Tim chuyen xe", "Gui yeu cau"
- Labels: "Diem di", "Diem den", "Ngay di", "So ve"
- Empty states: "Khong tim thay dia diem — ban van co the nhap."
- Nav: "Tong quan", "Doi xe", "Chuyen di", "Dat ve", "Tai chinh"

## Timezone

Explicit **Asia/Ho_Chi_Minh** (UTC+7) everywhere.

Date derivation pattern:
```js
new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
// Returns YYYY-MM-DD (locale-neutral ISO string)
```

No wall-clock `new Date()` in RSC component bodies (purity requirement).

## Date Formatting

- Library: `date-fns` with Vietnamese locale (`vi`)
- Calendar month labels: `format(date, "LLLL yyyy", { locale: vi })` → "thang 1 nam 2024"
- Calendar: Monday-first weeks (Vietnamese convention)
- Display format: DD/MM/YYYY HH:MM where shown to users

## Currency

Vietnamese Dong (VND), minor unit (no decimals):

```js
n.toLocaleString('vi-VN') + ' d'
```

## Phone Numbers

`+84` prefix (Vietnamese). Input accepts national format, stored as E.164.

## Future Considerations

If multi-language support needed:
- Extract hardcoded strings to message files
- Add `next-intl` or equivalent
- Route-based locale prefix (`/vi/`, `/en/`)
- Currently no infrastructure for this — would require dedicated effort
