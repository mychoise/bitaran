# Bitaran design language

The website in `frontend/` is the only design reference. This file records what it uses, so the
application screens can match it, and lists the gaps the app needs filled, each with a proposal.
**Nothing in "Gaps and proposals" is built until it is approved.**

Source of truth: `src/app/tokens.css` (the theme, "Coral"), `src/app/base.css` (element
defaults) and `src/app/globals.css` (component recipes and motion). Tailwind reads the tokens
through `@theme`, so every token below is also a utility (`bg-paper`, `text-ink`,
`rounded-card`, `font-outlier`, and so on).

---

## 1. Character

Warm, plain and physical: business paperwork on a desk. Warm grey paper, near-black ink, cotton
"stationery" cards with a soft edge and a shadow falling right, one coral ink kept for focus,
link underlines and the pressed "settled" stamp. Heavy 2px ink rules divide things. No gradients
on surfaces, no glow, no blue. Calm, readable, not decorative.

---

## 2. Colour tokens

All colours are OKLCH. Hex values are approximate, for reference only. Never use them in code.

### Surfaces

| Token | Value | Approx. | Role |
| --- | --- | --- | --- |
| `--color-paper` | `oklch(97% 0.006 55)` | #f8f4f1 | Page background (`body`) |
| `--color-paper-2` | `oklch(94.5% 0.007 55)` | #f1ece8 | Bands, nav slab, footer, table header row, hover on quiet controls |
| `--color-paper-3` | `oklch(91.5% 0.009 55)` | #e8e1dd | Deeper well, photo loading wash |
| `--color-cotton` | `oklch(98.8% 0.0045 80)` | #fdfbf8 | "Stationery": cards, inputs, card buttons |
| `--color-desk` | `oklch(94.3% 0.008 64)` | #f0ebe7 | Hero ground, with a radial light and felt texture (`.desk`) |
| `--color-board` | `oklch(22% 0.011 40)` | #1f1917 | The one dark band (call to action), primary button fill |
| `--color-board-type` | `oklch(96.5% 0.006 70)` | #f6f3ef | Text on the board |

### Ink and lines

| Token | Value | Approx. | Contrast on paper | Role |
| --- | --- | --- | --- | --- |
| `--color-ink` | `oklch(21% 0.012 38)` | #1d1614 | 16.3:1 | Headings, body, heavy rules |
| `--color-ink-2` | `oklch(29% 0.013 40)` | #312926 | 13.0:1 | Secondary text (leads, descriptions) |
| `--color-print` | `oklch(23% 0.012 38)` | — | ~15:1 | Text on cotton cards |
| `--color-muted` | `oklch(47% 0.013 45)` | #615955 | 6.3:1 | Labels, captions, hints, field borders |
| `--color-rule` | `oklch(87% 0.009 55)` | #d9d3cf | — | Hairlines between rows |
| `--color-rule-2` | `oklch(81% 0.011 55)` | #c7bfba | — | Stronger hairlines (section rows, table rules) |

### Signal

| Token | Value | Approx. | Contrast on paper | Role |
| --- | --- | --- | --- | --- |
| `--color-accent` | `oklch(74% 0.125 30)` | #ef8b7b | 2.2:1 | Selection tint, caret. Never text |
| `--color-accent-2` | `oklch(54% 0.165 29)` | #bb3d31 | 5.0:1 | Link underline on hover, nav underline, current page |
| `--color-focus` | `oklch(54% 0.17 30)` | #bd3a2b | 5.0:1 | Focus ring (2px outline, instant) |
| `--color-paid` | `oklch(55.5% 0.15 33)` | #ba4a34 | 4.7:1 | The pressed "Paid" stamp only |
| `--color-error` | `oklch(52% 0.19 27)` | #be2323 | 5.6:1 | Form errors (text and field border) |
| `--color-success` | `oklch(50% 0.12 150)` | #21763c | 5.2:1 | Declared in the tokens, not used on the website yet |

Rules the website follows:
- Coral is a signal, never a fill behind text, never a heading colour, never a band.
- Status is shown by **shape and words**, not colour alone: an ink-outlined chip for open states, a filled ink chip for settled states, a dashed outline for stopped states (`Status` in `src/components/product/SheetHeader.tsx`).
- Every dark surface switches its text to `board-type`, and its focus ring to `board-type` (`.on-board`).

---

## 3. Type

| Token / role | Value | Used for |
| --- | --- | --- |
| `--font-display` / `--font-body` | General Sans (self-hosted, 400 / 500 / 600) | Everything: headings and body are one family |
| `--font-outlier` | Geist Mono 400 | Figures in columns only: amounts, quantities, invoice numbers, times |
| `--display-weight` | 600 | `h1`, `h2`, `h3` |
| `--tracking-display` | -0.03em | Headings, wordmark |

Scale (fluid, values at 1440px wide):

| Token | Size | Line height | Element |
| --- | --- | --- | --- |
| `--text-display` | 44 → 84px | 1.04 | Page hero `h1` |
| `--text-display-s` | 36 → 60px | 1.06 | Inner-page and login `h1`, footer statement |
| `--text-section` | 32 → 56px | 1.06 | `h2` section heads |
| `--text-title` | 20 → 26px | 1.2 | `h3`, card titles, FAQ questions |
| `--text-lead` | 18 → 22px | 1.45 | The one line under a heading |
| `--text-xl` | 25px | — | Wordmark, sheet titles |
| `--text-lg` | 20px | — | Larger body in sections |
| `--text-md` | 16px | 1.55 | Body (minimum body size) |
| `--text-sm` | 14px | — | Labels, captions, notes, table heads |
| `--text-xs` | 13px | — | Dense sample data (inside product cards) |

Rules: sentence case everywhere; no capitals, no letter-spacing on labels; headings get
`text-wrap: balance`, body `pretty`; prose measure 65ch; one weight per heading.

---

## 4. Space, layout, shape, depth

**Spacing scale** (`:root`, plus Tailwind's 4px steps): 2, 4, 8, 12, 16, 24, 40, 64, 96, 144px
(`--space-3xs` … `--space-4xl`). Section gaps: 120 / 144 / 176px (smaller on tablets and phones).
Mapped to Tailwind as `px-gutter`, `py-section-s`, `py-section`, `py-section-l`, `gap-x-columns`.

**Layout:** one centred container, max 1440px, gutter 64px (24px under 60rem, 16px under 40rem),
twelve columns with 32px gaps (16px on phones). Desktop-first; grids collapse to one column on phones.

**Radii:**

| Token | Value | Used for |
| --- | --- | --- |
| `--radius-card`, `--radius-stock` | 8px | Cards, buttons, photos |
| `--radius-input` | 6px | Inputs, chips, small badges |
| `--radius-pill` | 999px | Round ticks and dots only (no pill buttons) |
| `--radius-device` / `--radius-screen` | 28px / 18px | The phone bezel in product samples only |

**Borders:** 1px `rule` hairlines between rows; 1px `muted` on inputs; **2px `ink` rules** as the
site's signature divider (nav bottom, footer top, list tops, drawn rules).

**Shadows** (one light from the left; shadows fall right):

| Token | Role |
| --- | --- |
| `--edge-stock` | The cotton card's paper edge (lit top-left, shade bottom-right) |
| `--cast-stock` | Resting shadow of a card or button |
| `--cast-stock-lift` | Hover shadow (lifted 1px) |
| `--press-groove` | Pressed-in groove (segmented controls) |
| `--shadow-card` | Very light 1px shadow (rarely used) |

**Texture:** faint generated paper grain (`/textures/cotton.svg`) on cards and card buttons;
felt (`/textures/felt.svg`) on the desk ground. Never photographed paper.

**Layers:** 1 base, 10 raised, 100 dropdown, 200 sticky, 300 sticky nav, 400 modal, 500 toast, 600 tooltip.

---

## 5. Components on the website

| Component | Where | Look and behaviour |
| --- | --- | --- |
| **Primary button** `.btn .btn-ink` | Hero, nav "Request a demo", forms | 48px tall, 8px radius, board fill, board-type label (500), soft cast shadow. Hover: lifts 1px, shadow grows. Active: presses 1px down. Disabled: 55% opacity, `not-allowed`. Focus: 2px coral ring, 3px offset, instant |
| **Card button** `.btn .btn-card` | Secondary actions, the board's buttons | Same size; cotton with paper grain and paper edge, print-coloured label |
| **Text link** `.text-link` | "See every feature", switch links | Ink, 500, underline in `rule-2` that turns coral on hover |
| **Input** `.field` (`TextField`, `PasswordField`) | Contact, quote, login, change password | 48px, 6px radius, cotton, 1px muted border (constant). Focus: 2px coral outline inset 3px. Error: border turns `error`, message below in `error` (500, 14px). The note line reserves its height so nothing jumps. Label above in 500 |
| **Card** `.stock` | Product samples, stories, choice cards | Cotton, paper grain, `--edge-stock` + `--cast-stock`, 8px radius, print text. Never a card inside a card |
| **Status chip** `Status` | Product samples | 13px, 500, 6px radius, 1px outline. Open: ink outline. Settled: filled ink. Stopped: dashed outline |
| **Accordion** `Accordion` | FAQs | Rows divided by `rule-2`; question at title size; a plus that turns to a cross; answers hidden but in the HTML |
| **Nav** `SiteHeader` | All website pages | Sticky slab: `paper-2`, 72px, 2px ink bottom rule. Wordmark left (General Sans 600, 25px), links centred, Login link and primary button right. Hover: a coral underline draws in; the current page keeps it. Collapses to a "Menu" card button under 1280px |
| **Footer** `SiteFooter` | All website pages | `paper-2`, 2px ink top rule; one large closing sentence; four link columns; credits and copyright in 14px |
| **Login top bar** `AuthTopBar` | Login and app placeholders | Same slab without links: wordmark and "Back to website" |
| **Placeholder / draft** `.fill`, `DraftNotice` | Website | Dashed muted outline, muted text |
| **Product samples** `src/components/product/*` | Website | Built UI on cotton sheets, captioned "Sample data" |

**Icons:** one hand-drawn set in `src/components/ui/icons.tsx`: 24px grid, 1.75px stroke,
round caps, `currentColor`, no fills, always beside a text label (never an icon tile). No emoji.

**Motion:** transform, opacity and clip only; `--ease-out` arrivals; 120 / 220 / 420ms; every
effect plays once; nothing hides content without JavaScript; `prefers-reduced-motion` removes it all.

---

## 6. Imagery

Photographs are rare and muted (saturation 65%, slight sepia, set in CSS on every slot):
goods in bulk (chillies, grain sacks), no identifiable people, no signs, brands or flags, credited
in the footer or beside the photo. The product is always shown as built components with
"Sample data" labels, never as screenshots or photos of screens.

---

## 7. Voice

Plain, short sentences that say what happens and what it saves. The trade's own words: route,
pasal, udharo, cheque, khaja. No hype words, no exclamation marks. Errors say what happened and
what to do ("That email or password is not right."). Buttons are verbs ("Request a demo",
"Sign in", "Change password"). Sample data is labelled as sample or demo.

---

## 8. Gaps and proposals (for approval)

The app needs things the website never had. Each proposal uses existing tokens where possible.
**New tokens are marked NEW**; there are six in total, all inside the existing theme's warmth.

### 8.1 Status colours: success, warning, danger, info

The theme already has `--color-error` (danger) and `--color-success`. It has no warning, no info
and no soft backgrounds for badges. Proposed smallest addition:

| Token | Value | Approx. | Contrast | Role |
| --- | --- | --- | --- | --- |
| `--color-error` (existing) | `oklch(52% 0.19 27)` | #be2323 | 5.6:1 on paper | Danger text, icon, border |
| `--color-success` (existing) | `oklch(50% 0.12 150)` | #21763c | 5.2:1 on paper | Success text, icon, border |
| `--color-warning` **NEW** | `oklch(52% 0.11 70)` | #915c08 | 5.2:1 on paper | Warning text, icon, border (amber-brown, so it reads on warm paper) |
| `--color-error-soft` **NEW** | `oklch(95% 0.03 27)` | #ffe7e4 | error on it: 5.2:1 | Danger badge and banner background |
| `--color-success-soft` **NEW** | `oklch(95% 0.03 150)` | #e1f5e4 | success on it: 5.0:1 | Success badge and banner background |
| `--color-warning-soft` **NEW** | `oklch(95% 0.04 80)` | #fdecd1 | warning on it: 4.9:1 | Warning badge and banner background |

**Info** gets no new colour: the theme forbids a blue signal. Info uses ink on `paper-2` with an
ink outline, like the website's open status chip.

Rules: status colour is **always paired with an icon and a word** (never colour alone);
status colours are never used as chart series.

**Known overlap:** the existing `--color-error` and `--color-accent-2` (coral) are nearly the
same red (contrast between them 1.1:1). On the website that is harmless. In the app, coral must
stay limited to focus rings, link underlines, the active nav marker and the "Paid" stamp, and
every danger state must carry its icon and words, so a reader never has to tell the two apart.
(Changing either token would change the website, so I am not proposing that.)

### 8.2 Status badges (`StatusBadge`)

Built on the website's `Status` chip: 13–14px, 500, 6px radius, 1px border, sentence case.

| Meaning | Look | Examples |
| --- | --- | --- |
| Neutral / open | Ink outline on transparent (website style) | Planned, Draft |
| In progress | Ink outline, `paper-2` fill, small clock icon | In progress, Pending, In clearing |
| Settled / good | Filled ink (website style) **or** success on success-soft with tick | Confirmed, Paid, Reconciled |
| Warning | Warning on warning-soft, with alert icon | Overdue, Near limit, Flagged photo |
| Danger / stopped | Error on error-soft, with cross icon; or dashed outline for cancelled | Bounced, Over limit, Cancelled (dashed) |

### 8.3 Data tables

- Cotton card (`.stock`) holds the table; header row `paper-2`, 14px 500 `muted` labels in sentence case, **sticky** under the app's top bar.
- Rows 44px (dense), 1px `rule` between rows, row hover `paper-2`, no zebra stripes, no outer border beyond the card edge.
- Figures right-aligned in Geist Mono with tabular numbers; the row's name column in 500.
- Sortable headers: the label is a button with a small up/down chevron; active sort in ink, others muted; `aria-sort` set.
- Loading: skeleton rows (`paper-3` bars, no shimmer under reduced motion). Empty: `EmptyState` inside the card. Error: message and a Retry card button.
- Phones (shop and salesman screens): rows restack as labelled blocks; no sideways scroll except a table that says so.

### 8.4 Forms and controls

Reuse `.field` and `.btn` exactly (48px). Dense manager forms may use a **40px** field and
button size with a 44px hit area (a single `size="sm"` variant). Salesman screens use **56px**
touch targets.

- **Select:** the `.field` look with a chevron icon.
- **Checkbox:** 20px, 6px radius, 1px muted border; checked = ink fill with a cotton tick.
- **Tabs and segmented choices:** the website's groove (`--press-groove`, cotton card riding in it; already in the theme for exactly this). Underline tabs for page sections: 2px coral marker like the nav.
- **Stepper (+/−):** two 56px card buttons around a large Geist Mono number.
- **DateRangePicker:** two native date inputs styled as `.field`, plus preset chips (Today, This week, This month).

### 8.5 Overlays

- **Modal / ConfirmDialog:** a cotton card (8px radius, edge + lifted cast) over an ink scrim at 40% opacity; title at `--text-title`; actions bottom-right (primary = ink button; destructive confirm = ink button whose label names the action, e.g. "Mark as bounced", with the danger icon and sentence above it).
- **Drawer:** the same card sliding from the right on desktop (from the bottom on phones), full height.
- **Toast:** a small board-coloured card (board fill, board-type text) at bottom-right (bottom-centre on phones), with a status icon; announced with `role="status"`; never for errors that need action.

### 8.6 Cards, stats, page header, empty states

- **Card:** `.stock` as is. A denser `p-5` variant for dashboards.
- **Stat:** label in 14px muted, value in Geist Mono at `--text-2xl`, optional one-line note; split by vertical `rule` hairlines like the website's figure rows (no icon tiles).
- **PageHeader:** `h1` at `--text-section` (the hero sizes are not used in the app), optional lead line, actions on the right; a 2px ink rule below, the site's signature divider.
- **EmptyState:** a short heading, one plain sentence on why it is empty, one action. Optionally a small muted line icon. No illustrations.
- **Skeleton:** `paper-3` blocks with the card radius.

### 8.7 App navigation

- **Manager / owner:** a left sidebar on `paper-2` with a 2px ink right rule; items in 16px body, current item marked with the coral 2px marker (as the website nav) and ink text; collapses to a "Menu" card button under 1024px. Top bar is the website slab (wordmark, business name, person, user menu).
- **Salesman (phone-first):** the slab as a compact top bar (day status chip); a bottom tab bar on `paper-2` with a 2px ink top rule, 5 items of icon above label, 56px tall, current item ink with a coral marker.
- **Shop:** the slab with three or four text links, like the website nav.
- **Demo data ribbon:** a thin `paper-3` strip under the top bar with a dashed muted outline, using the website's draft style (`.fill`): "Demo data. Nothing here is real." plus the dev menu.

### 8.8 Charts

The theme is almost monochrome, so most charts should be **single-series**, in existing tokens:

- **Single series:** bars or line in `--color-ink-2`; one highlighted mark (today, the selected shop) in `--color-accent-2`; axes and grid in `rule`; labels in `muted`.
- **Magnitude ramp (sequential):** `paper-3` → `muted` → `ink` (one hue, light to dark).
- **Several series** (for example cash, cheque and online): four NEW series tokens, validated with the colour-blind and contrast checks in their fixed order (coral, teal, ochre, plum):

| Token | Value | Approx. |
| --- | --- | --- |
| `--color-chart-1` **NEW** | `oklch(58% 0.15 32)` | #c3513d |
| `--color-chart-2` **NEW** | `oklch(53% 0.115 220)` | #007a99 |
| `--color-chart-3` **NEW** | `oklch(64% 0.13 75)` | #ba7f14 |
| `--color-chart-4` **NEW** | `oklch(50% 0.13 320)` | #834791 |

Validation result: lightness, chroma, colour-blind separation of neighbours, normal-vision
separation and 3:1 contrast on cotton all pass in this order. They only pass **in this order**,
so series always take colours 1, 2, 3, 4 in sequence, never shuffled. Every multi-series chart also has a legend and direct
labels, and a table view of the same numbers. No chart uses two y-axes.

If you prefer no new chart tokens, the alternative is: every chart single-series, with
breakdowns shown as small multiples or as tables.

### 8.9 Money, dates and printing

- Money in Geist Mono, right-aligned: `Rs 1,23,456.00` (lakh grouping). Credit balances read "Credit Rs 2,000.00" in `success`, never a minus sign.
- Dates in AD, in Nepal time: "14 Oct 2026", times "14:05".
- Print (`@media print`): white page, ink text, no nav, no ribbon, no shadows or textures, hairline rules kept.

### 8.10 Dark mode

The website has no dark mode, so the app has none either.

---

## 9. Review checks used (quality only, never to change the look)

Real hierarchy (one `h1` per page), states for every control (hover, focus, active, disabled,
loading, error), 4.5:1 text contrast, visible instant focus, no generic dashboard clichés (no
gradient cards, no icon tiles, no coloured side stripes), no invented numbers.
