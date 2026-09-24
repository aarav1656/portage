# Portage: design system

Hallmark · macrostructure: Customs Manifest (bespoke) · genre: modern-minimal (financial infra)
theme: custom: bonded-warehouse kraft ledger · accent: oxidized teal ink
Differs from the last logged build (`last-call`: stat-led flight board, blue-black FIDS surface,
Geist Mono display, coral-red `#FF5A4E` accent) on: paper band (dark → light), display style
(mono → classical serif), and accent hue (warm red → cool teal). Four axes differ in total,
counting macrostructure.

## Why this direction

Portage moves a token across a border it cannot legally cross on its own: a Token-2022 mint
with a live transfer fee cannot quote a Meteora DBC pool. The product is customs processing -
declare the cargo (the Tessera token), pay the duty (the transfer fee) at the border, receive a
clean bonded good (wtKALSHI) that is now free to trade on the other side. Every surface reads as
paperwork for that crossing: a manifest, a ledger of holdings, a stamped pass/fail on the vault
invariant, a duty schedule for the launch. Not a trading terminal, not a wallet dashboard.

## Tokens

```css
:root {
  --paper: #e3d8b4;       /* kraft ledger paper */
  --paper-2: #d9c89a;     /* card / row fill, one step down */
  --paper-3: #cbb57f;     /* pressed / hover fill */
  --ink: #241c12;         /* off-black warm brown, body text */
  --ink-2: #5b4e3a;       /* secondary text */
  --ink-3: #8a7a5c;       /* tertiary / placeholder */
  --line: #c9b99a;        /* hairline rule */
  --line-strong: #a8925f; /* emphasis rule, table headers */
  --accent: #1f6f5c;      /* oxidized teal ink: cleared / primary action */
  --accent-ink: #e3d8b4;  /* text on accent fill */
  --rejected: #8c2f1b;    /* rust red ink: rejected / error stamp */
  --rejected-ink: #e3d8b4;

  --font-display: var(--font-display-serif), "Iowan Old Style", serif;
  --font-body: var(--font-work-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, "SF Mono", monospace;

  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2.5rem;
  --space-xl: 4rem;
  --space-2xl: 6rem;

  --radius: 4px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
}
```

Off-black `#241c12`, not `#000`. Off-white `#e3d8b4`, not `#fff`. One accent hue (teal); rust red
is reserved for rejection/error states only, never decorative.

## Type

- Display: **Domine**: page titles, the stamped numerals on the market-cap and fee
  figures, the "MANIFEST NO." heading block. Roman only, no italics on headings.
- Body: **Work Sans**: running copy, labels, buttons.
- Mono/tabular: **IBM Plex Mono**: every amount, address, bps figure, balance. `font-variant-numeric: tabular-nums`.

Scale: 0.8125rem (meta) / 0.9375rem (body) / 1.125rem (lg) / 1.75rem (section head) / 2.75rem
(display, desktop only, steps to 2rem under 640px).

## Layout language

- Pages read as a stamped document: a header strip (route wordmark tabs, edge-aligned, like
  folder tabs on a dossier: nav archetype N9), a manifest header block per page (title +
  meta row in mono), then numbered ledger sections separated by hairline rules, never cards
  with drop shadows. `border: 1px solid var(--line)`, radius 4px, no shadow anywhere.
- Every data row uses a dotted leader (`border-bottom: 1px dashed var(--line)`) between label
  and value, like a customs form line item.
- Pass/fail and rejection states render as a corner stamp: a rotated (-4deg) bordered badge in
  accent or rejected ink, uppercase, tracking-wide, mono. Used for "CLEARED" / "REJECTED" /
  "NOT INITIALISED".
- Footer: single hairline-topped strip with the program id (linked, shortened) and network -
  no link columns, no social row (Ft-minimal, not Ft3).

## Motion

Three primitives only: button press `scale(0.97)`, panel/row entry `opacity 0→1` + `translateY(4px→0)` at 160ms `--ease-out`, stamp reveal on the pass/fail badge (`scale(0.95)+opacity` at 200ms, never `scale(0)`). All motion respects `prefers-reduced-motion: reduce` (collapses to opacity-only, ≤120ms). No hover glows, no gradient sweeps, no marquee.

## States

Every fetch (market data, vault balances, wrap/unwrap submission) renders loading (skeleton rows
in `--paper-2`, no spinner-only screens), empty (named, e.g. "vault not initialised yet": never
"no data"), and error (rust-red inline stamp with the real error message, never swallowed).

## Components

- `Stamp`: the corner-badge primitive (cleared / rejected / pending), used on `/` for the DBC
  rejection, on `/vaults` for the invariant check.
- `LedgerRow`: label (body font, ink-2) + dotted leader + value (mono, tabular).
- `AddressLink`: shortened address, mono, underline, links to solscan.io/account, opens new tab.
- Buttons: solid accent fill for primary (wrap / launch), outline ink for secondary
  (unwrap / disconnect). 4px radius, 1px border, no pill shapes.

## Exports

`apps/web/app/tokens.css` carries the full custom-property block above, imported once from
`app/globals.css` ahead of any Tailwind layer.
