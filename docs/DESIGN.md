# PayPilot Flight Desk

PayPilot uses the visual language of a printed flight log: warm paper, ink,
hairline rules, tabular figures, and restrained status stamps.

## Tokens

The Day Desk and Night Desk palettes live in
`apps/web/src/app/globals.css`. Components consume semantic variables such as
`--paper`, `--ink`, `--ledger`, `--brass`, `--vermilion`, and `--rule`; route
components should not introduce raw palette colors.

## Type

- Fraunces/Georgia: page titles and important amounts.
- Hanken Grotesk/Trebuchet MS: interface copy.
- JetBrains Mono/Consolas: IDs, timestamps, and ledger values.

The stacks intentionally have local-safe fallbacks so the app remains
buildable offline.

## Components

- `DashboardShell`: rail, instrument bar, and responsive content frame.
- `Sidebar`: flight-desk navigation and governance note.
- `TopBar`: runtime status chips, budget instrument, autonomy control, and
  Day/Night desk switch.
- `Card`: paper object surface with a hairline rule.
- `Badge`: compact status stamp.
- `LiveAgentPanel` and `TrustTimeline`: streamed activity and evidence views.
- Receipt page: printable evidence sheet with JSON download and live chain
  verification.

## Motion

Motion is limited to streamed state changes, list entrance, and status
transitions. Decorative pulsing and glow effects are intentionally avoided.
The global reduced-motion rule disables transitions and animation for users
who request it.

## Responsive behavior

The desktop rail becomes a mobile drawer through `DashboardShell`. Controls
remain keyboard accessible, status is conveyed with text as well as color, and
receipt pages provide a print/PDF path without requiring a browser extension.
