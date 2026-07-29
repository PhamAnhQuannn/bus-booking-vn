# Tour Planning + AI Suggestion — Customer Discovery

**Status:** Discovery / story phase. No implementation is proposed here.
**Date:** 2026-07-26
**Question asked:** if we let a customer say *"Đà Lạt, 5 ngày"* and hand back a complete tour — destinations, hotels, restaurants, entertainment complexes, transport, day by day — what does the customer actually worry about?

---

## How this was produced

Five customer-voice personas were interviewed in parallel, each asked to narrate how they plan a trip today, enumerate every worry in the order it actually occurs to them, and then **attack** the naive feature. A sixth adversarial seat was run specifically to destroy the happy path.

| Persona | Trip | Why this seat |
|---|---|---|
| **Chị Hương**, 41, Hà Nội | 7 pax, Đà Lạt, 5 days, 30/4 holiday — husband, 2 kids (6, 12), mother 68 (bad knees, hypertension), father 71, sister | The multi-generational family organizer. Highest constraint density. |
| **Minh**, 23, Sài Gòn | 4 friends, 7 days, SG→Nha Trang *or* Quy Nhơn→Đà Lạt, 4–5tr/head hard ceiling, motorbike | The budget/GenZ planner who has not decided and will change his mind on day 3. |
| **Anh Tuấn**, 36, Đà Nẵng | 48-pax company team-building, 3D2N, 2.5tr/head, needs contract + hóa đơn đỏ | The corporate buyer. Procurement brain, headcount volatility, VAT. |
| **Sarah** (Melbourne) + **Kevin Nguyễn** (Việt kiều, California) | 12 days inbound / 10 days with family in Cần Thơ + Phú Quốc | The inbound pair. Payments, language, calendar and geography ignorance. |
| **Chú Bình**, 52, Hải Phòng | — | Adversarial seat. Burned three times: a Hạ Long bait-and-switch boat, a Phú Quốc combo that collapsed on an airline schedule change, and a Facebook page that took 5tr and vanished. |

**Relationship to existing persona docs:** [`personas/customer-personas.md`](../personas/customer-personas.md) covers six *individual bus-ticket buyers*. The five above are **trip organizers** — people buying on behalf of a group, with a different anxiety profile entirely. Treat them as an additive set, not a replacement.

---

## Finding 0 — The premise is wrong, and all five rejected it independently

The framing *"customer wants Đà Lạt → we give a complete list of destinations that can be their choices"* is **the first thing every persona attacked**.

Nobody is short of destination lists. TikTok, Facebook groups, blogs and Google Maps oversupply candidate places already, for free, with better photos. What they are all short of is a plan that **survives contact with their own constraints**:

> A sequence of real, currently-open, actually-bookable things that fits my people, my bodies, my money, my dates, and my non-negotiables — and that someone is accountable for.

Hương's test: a suggestion produced in two seconds with no questions asked is *proof it does not know her*. She would get the same output as a young couple.

**Implication.** This is a **constraint solver with a booking rail**, not a recommender. Recommendation is the cheap, commoditised part. "AI suggestion" is the wrapper, not the product.

---

## Finding 1 — The unit of anxiety is the JOIN, not the place

Every persona, unprompted, attacked the same class of defect: the *transition* between items.

| Attack | Raised by |
|---|---|
| Four sites in one day (Langbiang + Thung lũng Tình Yêu + Đồi chè Cầu Đất + Chợ Đà Lạt) | Hương |
| Hạ Long and Sa Pa on consecutive days — "it never looked at a map" | Sarah |
| Nine stops "90 minutes apart" ignoring đèo, traffic, and a ferry that runs twice a day | Chú Bình |
| Bus arrives after the site's last-entry cutoff | Chú Bình |
| Check-in listed before the previous check-out | Chú Bình |
| Bus arrives 10:00, hotel check-in 14:00 — seven people and luggage, where do they go? | Hương |
| Check-out 12:00, night bus 21:00 — where does the luggage go | Minh |
| Travel times computed for a car when the group is on motorbikes | Minh |
| Rest-stop cadence on a 3h bus with a pregnant colleague | Tuấn |

Nobody complained about a bad *place*. Everybody complained about a bad *edge*.

**Implication.** An itinerary is a **timed graph with real traversal costs and real opening / closing / last-entry windows**, not an ordered list of names. A day without clock times is, in Hương's words, useless — for elderly travellers meal timing is a medical constraint, not a preference.

---

## Finding 2 — "Ước tính 12.000.000đ" was rejected by every single persona

Not one of five accepted a headline total. Each rejected it for a *different* reason. The union of those reasons is the pricing specification.

- **Hương** — twelve million for how many people? Does it include vé cổng, ăn, gửi xe, xe điện trong khu, hướng dẫn viên? Is phụ thu lễ already in? VAT and service charge included or not?
- **Minh** — show it per head, auto-divided by the current group size. *"Từ 150k"* is bait. The creep is Grab from the bến xe, gửi xe at every stop, xăng, đồ ăn vặt, and the motorbike deposit — cọc CCCD or cash, and do I get it back or lose it to a "trầy xe" claim?
- **Tuấn** — the word *"ước tính"* is disqualifying; he needs a number he can sign. He also needs the **per-head vs fixed split** (MC, âm thanh, and the bus are fixed costs that do not divide) and **price breakpoints by headcount band** — 44 vs 52 is not linear, because below 45 the 45-seat bus stops making sense and you flip to 2×29-seat and the price jumps.
- **Sarah / Kevin** — show AUD/USD alongside VND with the conversion already done, no dynamic-currency-conversion trap at checkout, and the price shown must equal the price charged.
- **Chú Bình** — a price that goes stale between generation and payment is bait-and-switch, indistinguishable from the Facebook pages that burned him. And an un-itemised total is precisely what makes a partial refund impossible later (Finding 5).

**Implication.** Price is a **decomposition, not a number**: per item, per-head vs fixed, inclusions and exclusions explicit, surge disclosed, currency-aware, with a **quoted-price lock window**.

---

## Finding 3 — Bodies, not travellers

The strongest differentiator that surfaced, and the one no blog itinerary and no existing OTA encodes.

- **Hương.** Father 71; mother 68 with bad knees and hypertension. Stairs disqualify a site outright. She needs to know whether there is somewhere for ông to *sit* while everyone else climbs, and whether Langbiang means a jeep or a walk. Motion sickness on the đèo — does the bus stop, is there thuốc chống say. Altitude and cold against blood pressure. Nearest hospital and a 24-hour pharmacy. **Toilet cleanliness at every stop, which she named as worry number one**, and seated rather than squat toilets for the elderly. The six-year-old's nap window, and whether the kid will eat the food. Meal timing is medical, not preference.
- **Tuấn.** One pregnant colleague. Three vegetarians who need a real menu, not "pick the meat out." Two allergies (seafood, peanut) the kitchen must be told about in advance with someone monitoring. Rest-stop cadence. Nearest hospital. Group insurance for 48 people.
- **Sarah.** Solo-female safety at night, in a homestay, and specifically on a night bus. Where a Western stomach gets into trouble (ice, particular dishes). International clinic vs public hospital, and whether insurance works or she pays cash and claims later.
- **Chú Bình.** The safety axis is *orthogonal* to the "good plan" axis, and nothing in a suggestion engine forces the second check — it will happily route a bad-knee 60-year-old up the steeper Fansipan trail because scenery scores well.

**Implication.** An accessibility / health / dietary constraint model is the single most defensible differentiator against every free alternative. It is also the highest-liability surface — see Finding 6.

---

## Finding 4 — Anchors and flex, not a linear day plan

Everyone has immovable points and builds the trip *around* them. The anchors differ in kind:

- **Kevin** — the giỗ date for his grandfather in Cần Thơ cannot move. Family days are fixed; the tourist part (Phú Quốc, Sài Gòn) is what flexes. An AI that treats the trip as one continuous tourist itinerary is, in his words, actively dangerous to his standing in the family.
- **Tuấn** — the CEO's speech slot, the gala dinner, and the dates the CEO will move once anyway.
- **Hương** — meal times and the six-year-old's nap.
- **Minh** — almost nothing is anchored. He has not chosen Nha Trang vs Quy Nhơn, and that indecision *is the point*. A fixed 7-day plan loses him immediately.
- **Sarah** — realistic travel times, and not overpacking the day.

**Implication.** The itinerary primitive is **fixed anchors + flexible fill + a re-plan operation**, not a static ordered plan. Minh's requirement (change on day 3 without losing deposits) and Tuấn's (the CEO moves the date) are the same feature seen from two ends.

---

## Finding 5 — Partial-booking collapse is the number-one product killer

The adversary's sharpest finding, and a product-existence question rather than a UX detail.

A suggestion is one artifact. Fulfilling it is **N supplier bookings**.

- Leg 4 of 9 fails at payment because the room went in the last eight minutes. Do the other eight auto-cancel? Does the customer now own eight disconnected bookings that no longer form a trip? **A half-built itinerary is worse than an honest "we could not build this."**
- The customer paid **one price**. When one leg cancels they demand **one refund** — but there are **N cancellation ladders**: the hotel free-cancels at 24h, the boat is non-refundable inside 48h, the restaurant has no formal policy at all. *"The tour's cancellation policy"* does not exist as a sentence.
- **Who holds the money** between payment and travel? If it fans out to N suppliers on payment, a per-leg refund is a negotiation rather than an operation, and a chargeback on one disputed leg claws back money already forwarded N ways.
- Chú Bình's Phú Quốc story is exactly this shape: an airline *schedule change* (not a cancellation, so no airline compensation) broke the resort shuttle and the island-hopping slot; three companies pointed at each other; and he was not the ticket holder of record, so he could not even rebook himself.

**Implication.** Money custody and per-leg refunds decide whether a bundled version of this product can exist at all. See *Decisions* — V1 sidesteps this deliberately.

---

## Finding 6 — Confident wrongness has a physical cost and no legal person to blame

A human agent who does not know says *"để tôi hỏi lại."* A model that does not know answers in the same tone it uses when it is right.

Hallucination classes named in the interviews:

- a waterfall that is dry in that season (Datanla in mùa khô)
- a quán that closed two years ago and is now a nail salon
- a festival placed on the wrong lunar date
- a road in landslide season; a ferry that does not run when biển động cấp 6
- an entry price cached from 2019 and now 40% higher
- Hương's version — is the site closed for renovation, and **"hoa nở chưa?"** Arrive a week late and the trip is pointless.
- Sarah's version — Tết, and bão season in the centre. Vietnam is three climates at once, so a 12-day north-to-south plan can be in monsoon at one end.

**Who eats the 400km when the model was confident and wrong?** There is no company behind "the model was sure."

**Implication.** Freshness and verification of the underlying facts (open/closed, seasonal, price, last entry) is a **supply-data problem, not a model problem**. The model must be permitted — and required — to say it does not know. Every claim shown to a customer needs a provenance and a last-verified date.

---

## Finding 7 — Trust is the gate, and it currently sits at zero

- **Chú Bình.** Is the hotel a licensed cơ sở lưu trú or a Facebook page with borrowed photos? Is the guide carrying a thẻ hướng dẫn viên? Are the reviews bought — *"I've seen bought reviews, I know what they look like now."* And the sharpest point: **if a supplier can pay to be "AI-recommended," that is a broker taking a cut and calling it intelligence.** The day a customer works that out, every recommendation ever given retroactively becomes an ad. If paid placement is the model, it must say so on screen in the same size text as the recommendation.
- **Hương.** Photos versus reality. Reviews must carry recent dates. An unusually beautiful photo makes her close the tab.
- **Minh.** Three-year-old hostel photos. A *review thật* is found in the comments, never the caption, because every post is sponsored.
- **Sarah / Kevin.** *"Neither of us has heard of you. That's the whole problem."* Booking.com has cancellation terms they understand, English reviews, and a dispute process. A Vietnamese site starts at zero and must earn every point back.

**Implication.** Verifiable supplier identity (checkable by the customer *before* paying), real dated photos and reviews, and explicit paid-placement disclosure are entry requirements, not polish.

---

## Finding 8 — A human on the phone is a top-five item for four of five personas

- **Tuấn, bluntly:** the agency's real value is *"agency là người tôi CÓ THỂ LA LÊN khi có chuyện."* An AI cannot compensate him when the bus breaks down.
- **Chú Bình:** 23:00 in a Đà Lạt lobby, the room does not exist, and the app offers a chatbot — *"a chatbot at that hour is not customer service, it's an insult,"* and it is the fastest route to a viral post with our logo in the screenshot. He would pay real money for one thing above all others: a phone number answered by a person authorised to fix things, at the hours people actually travel.
- **Hương:** without a real contact for mid-trip trouble, everything above is theory on a screen.
- **Sarah** wants it for medical and scam emergencies; **Kevin** wants it because he has no patience to troubleshoot.

**Reputational asymmetry.** A hundred smooth trips produce silence. One ruined honeymoon produces a screenshot-heavy viral post that outlives every good trip we ever ran.

---

## Finding 9 — These are four different products, not four users of one

| Persona | What they actually want | Their most likely real behaviour |
|---|---|---|
| **Hương** (family) | A constraint solver: bodies, meal times, toilets, room configuration, transparent all-in price, human backup | Will pay through the platform **if** it interrogates her group first |
| **Minh** (budget) | A free collaborative planner + **à-la-carte** single-leg booking + group split-pay | **Screenshots the plan and books nothing.** This is the default outcome |
| **Tuấn** (corporate) | A quote engine: banded pricing, fixed-vs-per-head split, contract, hóa đơn đỏ, insurance, rooming list — then a human closer | Takes the free first draft, gives the money to an agency |
| **Sarah / Kevin** (inbound) | Foreign card acceptance, English artifacts, calendar and geography sanity, family-anchor awareness | Defaults to Booking.com / Klook unless the trust deficit closes |

Minh's leak is the most dangerous, in his own words: *"nhiều khả năng tui dùng nó y như Google Maps — coi cho vui, note ý tưởng, rồi tự đi đặt riêng lẻ."* The one thing he named that would change it: **let me book one leg at a time, do not force the whole package**, and let one person pay first with a share-link for the other three to transfer in.

Tuấn's leak is the mirror image: he will happily take the free first draft unless the product terminates in a signable contract and a hóa đơn đỏ.

---

## Finding 10 — Regulatory fork

Assembling transport + lodging + tour + meals into **one price under one brand** may constitute **kinh doanh lữ hành** under Vietnamese travel law — requiring a travel-business licence, a **ký quỹ** (escrow deposit held against customer claims), and mandatory tour-operator liability insurance — as opposed to operating a neutral marketplace displaying separately-contracted suppliers.

This is **not a branding decision, it is a licensing decision.** It determines the money-custody model in Finding 5, the liability answer in Finding 6, and whether Tuấn's segment is servable at all.

Cross-reference: [`regulatory/README.md`](../regulatory/README.md) and [`regulatory/legal-entity.md`](../regulatory/legal-entity.md). The June 2026 regulatory scan covered transport, not tour operation — **this is a gap in that scan, and it needs a legal opinion before any bundled-price product is designed.**

---

## Finding 11 — What we already own

From a read-only survey of the codebase:

- **No AI / LLM integration exists anywhere.** No SDK, no vector store, no pgvector. Greenfield.
- **No tour or itinerary specification exists** in `documentation/` — a grep for tour / itinerary / hotel / restaurant / destination / sightseeing returned only incidental hits.
- `Place` is a **flat alias registry** — `canonicalName`, `aliases[]`, `slug`. No latitude/longitude, no province hierarchy, no POI category, no opening hours.
- `Route` is a single origin→destination pair owned by one operator. `Trip` is one point-to-point departure. **There is no multi-leg or multi-day primitive anywhere.**
- Adjacencies we do own: `lib/geo` (Vietnam administrative dataset), `lib/charter` (bespoke bus charter — the closest existing thing to a custom trip), `lib/ledger` (double-entry), `lib/payment` (VNPay / MoMo / bank transfer), `Payout` / `PayoutAccount`, `lib/einvoice` (MISA VAT invoicing), `lib/notification`.

**Strategic read.** We own exactly **one supply type — the bus leg.** Hotels, restaurants, POIs, guides and entertainment complexes are net-new supply we do not have, do not verify, and cannot currently settle money for.

The one genuinely defensible wedge is the **transport-anchored itinerary**: we are the only party who knows, truthfully and in real time, whether the leg between two places exists on that date at that price. Every competitor is guessing at exactly the edge (Finding 1) that every customer told us was the failure.

Two consequences worth noting: `lib/einvoice` already exists, so Tuấn's hóa đơn đỏ requirement is closer to servable than it looks; and VNPay / MoMo / bank transfer means **no foreign card acceptance today**, a hard blocker for Sarah and Kevin.

---

## The master worry taxonomy

Consolidated across all five personas. This is the checklist any tour artifact must be able to answer.

**1. People & bodies** — ages; mobility (stairs, walking distance, somewhere to sit); chronic conditions (huyết áp, altitude, cold); motion sickness on the đèo; pregnancy; children's nap windows and food tolerance; toilet quality and squat-vs-seated; dietary needs (chay, allergies) and whether the kitchen is actually *told*; medication; nearest hospital, 24h pharmacy, international clinic.

**2. Time & sequence** — clock times per item, not just a day; travel time by the *actual* mode (car ≠ motorbike ≠ 45-seat bus); rest stops; opening hours and last entry; check-in/check-out against arrival/departure; luggage storage in the gaps; how many items *this particular group* can physically do in a day; buffer.

**3. Money** — per-head vs total; fixed vs divisible costs; headcount breakpoints; inclusions and exclusions (vé cổng, gửi xe, xe điện trong khu, guide, nước, xăng, tips); VAT and service charge; phụ thu lễ; deposit amount and whether it returns; the motorbike cash/CCCD deposit; *"từ X"* bait pricing; price-lock window vs stale price; currency display and DCC; per-head split and who fronts it.

**4. Booking & availability** — is every item actually bookable on those dates; what happens when one leg fails; can I book one leg without the package; can I change on day 3; can a person drop out; when do names and CCCD actually need to be supplied; group rooming configuration and who shares with whom.

**5. Money custody & refunds** — who holds funds until travel; per-leg itemised refund; N cancellation ladders under one price; refund SLA in days, not *"sẽ liên hệ sớm"*; chargeback path; company bank transfer vs personal card; finance approval cycle vs deposit deadline; post-trip settlement of actual vs quoted; **hóa đơn đỏ, which only exists after the trip**.

**6. Truth & freshness** — is it open / renovating / seasonal / hoa nở chưa; is the waterfall dry this month; is the price current; is the festival date right; is the photo recent; are reviews real and dated; is the road or ferry running.

**7. Trust & identity** — is the supplier a registered business, checkable by me before I pay; is the guide licensed; is the boat's safety gear real; is the homestay registered for lưu trú; **is this recommendation paid placement**.

**8. Safety** — solo-female at night / in a homestay / on a night bus; motorbike rental without a licence, and what happens with công an or after an accident; rip currents; jellyfish; unlicensed operators; driver quality (chạy ẩu, đón trả khách dọc đường); bus insurance, đăng kiểm, valid driver licence; group insurance for 48; food and ice.

**9. Weather & calendar** — regional climate by month (three climates at once); bão season in the centre; Đà Lạt cold and rain; beach season and water cleanliness; **Tết** and lễ (shut / booked out / 2–3× price); 30/4 traffic on the đèo; a rain backup plan.

**10. Non-negotiable anchors** — family obligations (giỗ, Cần Thơ days, gifts for elders); the CEO's speech slot; fixed meeting dates; which parts of the trip may move and which may not.

**11. Foreign-traveller layer** — e-visa validity against flight dates; passport held at reception; khai báo tạm trú; foreign card acceptance; VND magnitude comprehension; ATM fees and card-eating; English confirmations, addresses, and something to *show a driver*; SIM/eSIM; the airport-transfer scam; Grab coverage outside HCMC; brand trust against Booking.com and Klook.

**12. When it goes wrong** — is there a phone number, answered by a human authorised to fix it, at travel hours; who is liable if the AI was wrong; contract terms and injury liability; escalation path; and the reputational asymmetry that makes all of the above a business risk rather than a support cost.

---

## What the debate ruled out

Six product shapes killed outright:

1. **Zero-question suggestion.** Output produced without interrogating the group is disqualifying to Hương on sight, and generic to everyone else.
2. **A pretty day-by-day with no clock times.** Useless the moment a body or a bus is involved.
3. **A headline "estimated total."** Rejected five out of five, for five different reasons.
4. **A fixed, non-editable itinerary.** Loses Minh immediately; cannot survive Tuấn's CEO or Kevin's giỗ.
5. **All-or-nothing package checkout.** Guarantees Finding 5's collapse and blocks Minh's only stated path to converting.
6. **Chatbot-only support.** Named by four of five as the trust anchor, and by the adversary as the exact moment the brand dies in public.

---

## Decisions taken (2026-07-26)

1. **Legal posture — marketplace first.** Suppliers contract separately with the customer; we display and facilitate. We do **not** sell one assembled price under one brand, which is what would trigger kinh doanh lữ hành licensing, ký quỹ, and tour-operator insurance. Revisit if and when a bundled price is on the table.
2. **Beachhead — Chị Hương, the family constraint solver.** Bodies, mobility, meal times, toilets, room configuration, transparent pricing. Chosen because no competitor encodes accessibility and she has the highest willingness to pay through the platform. Minh, Tuấn and the inbound pair are explicitly **out of V1 scope**.
3. **Supply — transport-anchored, information-only for everything else.** The bus leg is the only bookable item. Hotels, restaurants, POIs and entertainment complexes are **verified information** carrying a last-verified date, with no payment and no availability promise from us.
4. **Artifact — this document.** No design specification, no schema change, no code until it has been read.

### The tension these create, stated plainly

Decisions 2 and 3 pull against each other, and we should be honest about it. Hương's worries are overwhelmingly about hotels, meals and sites — but under decision 3 we cannot take her money for any of them. So V1's business model is:

> The constraint solver is the **reason she chooses our bus**, not a thing she pays for separately.

That is coherent. Seven seats Hà Nội→Đà Lạt at holiday pricing is a real transaction we already fulfil, and today it is won or lost on price alone. It is also thin, and it means **V1 is judged on bus-leg conversion lift, not on tour revenue.** If the lift is not there, decision 3 is the first thing to revisit.

Two consequences follow from decisions 1 and 3 together, and both are good:

- **Finding 5 is out of scope for V1.** One bookable leg means no N-supplier rollback, no N cancellation ladders, no multi-supplier settlement. The existing one-operator-per-booking ledger model stays valid.
- **Finding 6 becomes the dominant risk.** With information-only supply, *everything we show but do not sell is a claim we are liable for reputationally, without a contract behind it.* Provenance and a visible last-verified date on every non-bookable fact are therefore V1-mandatory rather than polish. An "AI recommendation" with no source is the single highest-risk thing we could ship.

### V1 scope boundary

**In scope.** Family/group interrogation (ages, mobility, health, diet, budget, anchors); clock-timed day plans with realistic traversal by the actual mode of travel; the accessibility and health constraint model of Finding 3; itemised transparent pricing for the bus leg including phụ thu lễ; verified information cards with last-verified dates for non-bookable items; explicit paid-placement disclosure if any exists; a real human contact path.

**Out of scope.** Hotel / restaurant / POI booking or payment; multi-supplier settlement; foreign card acceptance; corporate contract and hóa đơn đỏ; group split-pay; English and inbound localisation; anything that quotes a single assembled tour price.

---

## Open items

| # | Item | Owner |
|---|---|---|
| 1 | Legal opinion on kinh doanh lữ hành — the June 2026 regulatory scan does not cover tour operation. Needed **before** any bundled-price product. | Legal |
| 2 | Where does verified supply data come from, and who re-verifies it on what cadence? Finding 6 is unresolved by decision 3 — it is *concentrated* by it. | Product |
| 3 | Success metric for V1: bus-leg conversion lift on family/group searches. Define the baseline before building. | Product |
| 4 | Paid placement — decide now whether it is ever part of the model, because Finding 7 says it must be disclosed on screen from day one if so. | Business |
