# DS-042 FD-025: Operator Branding & Public Profile

## 1. Overview

Brand ownership is the platform's core differentiator against marketplace aggregators like VeXeRe. The platform follows a "Shopify for bus operators" model where the consumer sees the operator's brand, not the platform's. This spec defines the operator profile settings, public-facing operator page, verified badge system, trip card branding, and shareable booking links.

---

## 2. Operator Profile Settings (`/op/profile`)

### 2.1 Profile Form Fields

| Field | Label (VI) | Type | Constraints | Notes |
|-------|-----------|------|-------------|-------|
| Logo | Logo cong ty | Image upload | Square, min 200x200px, max 2MB, JPG/PNG | Cropped to 1:1 on upload. Processed via `next/image` for WebP conversion |
| Company Name | Ten nha xe | Text (read-only) | From KYB registration | Editable only via admin request |
| Slug | Duong dan | Text (read-only) | Auto-generated from name | URL: `/nha-xe/[slug]` |
| Description | Gioi thieu | Textarea | Max 500 chars, Vietnamese | Rich text not supported in v1. Character counter shown |
| Contact Phone | Dien thoai lien he | Phone input | +84 format | Displayed on public page |
| Contact Email | Email lien he | Email input | Optional | Displayed on public page if provided |
| Amenities | Tien ich | Checkbox group | Multi-select from predefined list | See Section 2.2 |

### 2.2 Amenity Badges

Operators select amenities from a predefined list. Each amenity renders as an icon + label badge on the public profile and trip cards.

| Amenity Key | Label (VI) | Icon | Category |
|-------------|-----------|------|----------|
| `wifi` | WiFi | `Wifi` | Connectivity |
| `usb_charging` | Sac USB | `Plug` | Connectivity |
| `power_outlet` | O cam dien | `ZapOff` | Connectivity |
| `air_conditioning` | May lanh | `Snowflake` | Comfort |
| `blanket` | Chan | `BedDouble` | Comfort |
| `reclining_seat` | Ghe ngoi | `ArmchairIcon` | Comfort |
| `toilet` | Nha ve sinh | `Bath` | Facilities |
| `water` | Nuoc uong | `GlassWater` | Refreshments |
| `snacks` | An nhe | `Cookie` | Refreshments |
| `tv` | TV | `Monitor` | Entertainment |
| `curtain` | Rem cua | `Blinds` | Privacy |

### 2.3 Payout Bank Account

Displayed in a separate "Tai khoan thanh toan" section with:

- Bank name (from BIN lookup)
- Account number (masked: `***1234`)
- Account holder name
- Verification status badge: "Da xac minh" (green) or "Dang cho xac minh" (amber)
- Edit button with warning modal:

> **Thay doi tai khoan ngan hang**
>
> Khi thay doi thong tin tai khoan, trang thai xac minh se duoc dat lai. Ban se khong the rut tien cho den khi tai khoan moi duoc xac minh.
>
> [Tiep tuc] [Huy]

---

## 3. Public Operator Page (`/nha-xe/[slug]`)

### 3.1 SEO Optimization

| Meta Element | Template |
|-------------|----------|
| `<title>` | `Nha xe {Name} --- Dat ve online \| {Platform}` |
| `<meta name="description">` | First 160 chars of operator description, or fallback: `Dat ve xe khach {Name} truc tuyen. Xem tuyen duong, lich trinh va dat ve ngay.` |
| `og:title` | `Nha xe {Name}` |
| `og:description` | Same as meta description |
| `og:image` | Operator logo (min 200x200, padded to 1200x630 OG card with brand background) |
| `og:type` | `business.business` |
| Structured data | `Organization` schema with `name`, `logo`, `url`, `contactPoint` |

### 3.2 Page Layout

```
+--------------------------------------------------+
|  [Logo 80x80]  Nha xe {Name}  [Verified Badge]   |
|  {Description}                                    |
|  [Amenity badges row]                             |
+--------------------------------------------------+
|  Cac tuyen duong                                  |
|  +----------------------------------------------+ |
|  | {Origin} -> {Destination}                     | |
|  | Chuyen ke tiep: {time} | Tu {price} d        | |
|  | [Dat ve]                                      | |
|  +----------------------------------------------+ |
|  | {Origin} -> {Destination}                     | |
|  | ...                                           | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
|  [Facebook Share] [Zalo Share]                    |
+--------------------------------------------------+
```

### 3.3 Active Routes List

Each route card shows:

| Element | Content |
|---------|---------|
| Route name | `{Origin} -> {Destination}` |
| Next departure | `Chuyen ke tiep: {time} ngay {date}` or "Chua co chuyen nao" if none scheduled |
| Price | `Tu {lowestPrice} d` (lowest active trip price on this route) |
| Duration | `{hours}h{minutes}` estimated |
| CTA | "Dat ve" button linking to search pre-filtered for this operator + route |

Routes sorted by next departure time (soonest first). Only routes with at least one future scheduled trip are shown.

### 3.4 Social Share Buttons

| Platform | Implementation | Share Text |
|----------|---------------|------------|
| Facebook | `https://www.facebook.com/sharer/sharer.php?u={pageUrl}` | Automatic from OG tags |
| Zalo | `https://zalo.me/share?url={pageUrl}` | Automatic from OG tags |

Buttons use platform brand colors (Facebook blue, Zalo blue). Positioned below the routes list. Mobile: full-width stacked buttons. Desktop: inline row.

---

## 4. Verified Operator Badge ("Da xac minh")

### 4.1 Display Locations

| Surface | Size | Tooltip |
|---------|------|---------|
| Search result trip card | 16px inline icon | Hover/tap shows verified items |
| Operator public page | 20px beside name | Hover/tap shows verified items |
| Booking confirmation | 16px inline | Static text list |

### 4.2 Badge Variants

| Variant | Condition | Icon | Color |
|---------|-----------|------|-------|
| Verified (green) | All KYB documents approved, licenses current | `ShieldCheck` | `text-green-600` |
| Warning (amber) | Any license expires within 60 days | `ShieldAlert` | `text-amber-500` |
| Not verified | KYB not submitted or rejected | No badge shown | --- |

### 4.3 Tooltip Content

On hover (desktop) or tap (mobile), show a popover listing verified items:

```
Da xac minh:
  [check] Giay phep kinh doanh
  [check] Giay phep van tai
  [check] Bao hiem xe
```

Amber variant appends: "Giay phep sap het han --- vui long cap nhat truoc {expiryDate}".

### 4.4 Verification Data Source

Badge state derived from `KybDocument` records in the Onboarding/KYB bounded context. Document types checked:
- `business_license` --- Giay phep kinh doanh
- `transport_license` --- Giay phep van tai (per Decree 10/2020/ND-CP)
- `insurance` --- Bao hiem trach nhiem dan su

---

## 5. Trip Card Branding

### 5.1 Operator Identity on Trip Cards

Every trip card in search results and booking flows displays:

| Element | Spec | Position |
|---------|------|----------|
| Operator logo | 32x32px, rounded-md, `next/image` with fallback initials | Left of operator name |
| Operator name | `text-sm font-medium` | Beside logo |
| Verified badge | 16px `ShieldCheck` | After name (if verified) |
| Bus type badge | Pill badge: "Ghe ngoi" / "Giuong nam" / "Limousine" | Below operator name |

### 5.2 Fallback When No Logo

If the operator has not uploaded a logo, render a circular avatar with the operator's initials (first letter of each word in the company name, max 2 chars) on the primary brand background color.

```
Background: oklch(0.646 0.222 41.116) (orange-600)
Text: white, font-weight 600
```

### 5.3 Bus Type Badges

| Type | Label (VI) | Color |
|------|-----------|-------|
| `seat` | Ghe ngoi | Gray pill |
| `sleeper` | Giuong nam | Blue pill |
| `limousine` | Limousine | Purple pill |
| `vip` | VIP | Gold pill |

---

## 6. Shareable Booking Link

### 6.1 Operator-Facing Copy Feature

On the operator's route list (`/op/routes`), each route row includes a "Chia se" (Share) icon button that copies a direct booking URL to the clipboard:

```
URL format: {baseUrl}/search?operator={slug}&from={originId}&to={destId}
```

Toast on copy: "Da sao chep lien ket dat ve".

### 6.2 Use Case

Operators (especially micro and limousine personas) share these links on their Facebook pages, Zalo OA channels, and printed QR codes at station counters. The link pre-fills search with the operator's routes, bypassing the generic search funnel.

---

## 7. Responsive Behavior

| Viewport | Public Page | Profile Settings | Trip Card |
|----------|------------|-----------------|-----------|
| Mobile (< 768px) | Full-width logo, stacked route cards, full-width share buttons | Single-column form, inline amenity chips | Compact: logo 24x24, name truncated at 20 chars |
| Tablet (768-1023px) | Centered layout, 2-column route grid | Two-column form | Standard 32x32 layout |
| Desktop (1024px+) | Max-width container, 2-column route grid, inline share | Two-column form with live preview | Full layout with amenity badges |

---

## 8. Accessibility

- Logo upload includes `alt` text auto-generated: `"Logo {operator name}"`
- Verified badge uses `aria-label="Da xac minh"` with expanded tooltip content as `aria-describedby`
- Social share buttons have `aria-label="Chia se tren {platform}"`
- Amenity badges are wrapped in a list with `role="list"` and each item has `aria-label` matching the Vietnamese label
- Color-only indicators (badge variants) are paired with icon shape changes (`ShieldCheck` vs `ShieldAlert`)

---

## 9. Cross-References

| Reference | Relevance |
|-----------|-----------|
| Competitive Advantages | "Operator-Owned Brand" is advantage #2; Shopify-vs-Amazon positioning |
| Operator Sentiment | Brand dilution is churn trigger #6; loyalty ownership is trigger #4 |
| Operator Personas: Limousine | Brand showcase is #1 need; commoditization fear is #1 objection |
| Operator Personas: Micro | Zero-config auto-generated profile; Zalo/Facebook sharing |
| DS-018 FD-001 Design System | Color tokens, icon set (lucide-react), component primitives |
| DS-024 FD-007 Responsive/Mobile | Breakpoints, touch targets, image loading |
| Bounded Contexts: Onboarding/KYB | KYB document verification, badge state derivation |
| DS-045 FD-028 Portal Architecture | `'use client'` import safety for share button interactivity |
