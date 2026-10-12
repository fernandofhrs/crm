# Design — Rules for AI Agents

- /packages/ui is the single source of truth for all UI.
- Always use shared shadcn components from /packages/ui.
- Do not override component styles with className.
- Do not introduce custom border radii, spacing, colours, shadows, or other visual deviations.
- Corners are rounded, from the scale only: `rounded-sm` (6px) for the smallest
  controls, `rounded-md` (10px) for buttons, inputs and segments, `rounded-lg`
  (14px) for surfaces that contain controls — cards, popovers, dialogs, menus,
  table shells — and `rounded-xl` and above for the sign-in card. Never a
  literal radius at the call site.
- `rounded-none` is still correct in one case: an element that must join its
  neighbour edge to edge. The input inside an input group, the middle cells of
  a selected date range, the middle segments of a joined toggle group, and the
  drawer handle are the existing examples.
- If a component needs a new variant or style, implement it in /packages/ui so the entire application stays consistent.

## This install is Moulin's

The look follows Moulin's seller portal (`moulin.com.br/portal`): a warm paper
page, white surfaces, dark ink, one burnt orange. The tokens in
`packages/ui/src/styles/globals.css` hold the values; nothing else does.

- **Font**: Manrope, served from `apps/app/app/fonts/manrope.woff2` through
  `next/font/local`. No font is fetched from a third party at build or at run
  time.
- **Logo**: `apps/app/public/moulin-logo.png` (and the white one for dark) in the
  sidebar and on the sign-in page, `moulin-mark.png` where there is no room for
  the wordmark. `@crm/ui/components/logo` is the one-colour mark for inline use.
- **Light is the default theme.** Dark is a choice in the account menu, not a
  system setting followed on its own.

## Colour

Warm paper (`--background`, `#F4F2ED`), white surfaces (`--card`), ink
(`#1B1916`) and one brand colour, burnt orange (`--primary`, `#B4470E`). The
greys are warm on purpose: they sit on paper, and a cold grey on a warm page
reads as a different product.

**The page is paper and everything you can act on sits on white.** A table, a
panel, an input, an outline button: all `bg-card`. A bordered box with no
background is a mistake here, because it shows the page through it.

**Only two things are filled with a strong colour**: `primary` for the action
you want, `destructive` for the one you cannot undo. Everything else —
secondary, outline, ghost — is a white chip in light and a dark chip in dark.

**Tints are surfaces, not actions.** `--tint-primary`, `--tint-success`,
`--tint-warning`, `--tint-info` and `--tint-neutral` are the pale fills behind
an indicator tile (`StatCard tone`) and a board column. They never carry a
button, and one view uses each tint for one meaning.

`--primary` and `--destructive` hold the **same value in both themes**. A brand
colour that changes per theme is not one colour, it is two, and both then need
maintaining. The exception is `--ring`, which lightens in dark, and the chart
colours, which lighten so a line stays visible on a dark surface.

## Layout

- **One navigation, three shapes** (`apps/app/components/app-nav.tsx`). From
  `lg` up it is a sidebar with names; between `md` and `lg`, and inside the
  chat, it is a narrow rail with a short name under each icon; below `md` it is
  a top bar and a bottom tab bar. Do not add a second way to move between
  sections.
- **Inside another site's frame the app has no navigation.**
  `apps/app/lib/embedded-frame.ts` sets `data-embedded` on the document before the
  first paint, and the three shapes hide with `in-data-embedded:hidden!`. The host
  page owns the menu and loads a section by its URL. Nothing else changes: a page
  does not read the attribute.
- **A list is a table from `sm` up and a stack of cards below it.** `DataTable`
  does this on its own from the same column definitions; a page does not build
  its own phone layout for a list.
- **Deals open as a board by stage** (`deals-board.tsx`), with the list one tap
  away. The board is read and open: a stage changes in the deal, not by
  dragging a card.

## Language

Every word a person reads is Brazilian Portuguese, written in the code. There
is no translation layer. Dates, numbers and money go through `LOCALE`
(`@crm/ui/lib/locale`, and `apps/api/src/config/locale.ts` in the API) so the
server and the browser render the same text. A number a person types is read
with `parseDecimal`, which takes the comma as the decimal mark.
