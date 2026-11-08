# Design rules

How the app behaves and lays out its content. Each rule comes with its reason, so that a new screen
can follow the reason where no rule fits. Colours, type and the logo are in the
[style guide](brand/styleguide.md).

## Numbers

- **Numbers use tabular figures and sit right-aligned in tables.** Digits line up across rows, so
  amounts can be compared at a glance.
- **Gains and losses always carry their sign.** The colour (green, berry) is never the only
  signal, for colour-blind readers.
- **A value that rounds to zero is neither gain nor loss.** "+0,00 €" in green would claim a change
  that is not on screen.
- **Phones show whole euros, abbreviated from 10.000 € with three significant digits** (12,3k €,
  1,23 Mio. €). A full amount with cents does not fit next to other columns at 360px. Below ten
  thousand, whole euros are already short enough, and an abbreviation would lose information for
  nothing.
- **A rounded or abbreviated amount offers the exact one as its title** (`<abbr title>` without
  underline). The precision is still there for whoever asks for it.
- **An unknown value is "—", never 0 or empty.** Zero is a statement, an empty cell looks like a
  rendering bug.

## Tables

- **Columns that do not fit are dropped, not squeezed or scrolled.** Each column says from which
  breakpoint it shows (`showFrom`: `sm`, `md`, `xl`); phones keep the essential ones. A table
  scrolled sideways inside a card hides its most interesting columns behind a gesture nobody
  expects.
- **Minimum column widths are desktop-only** (`sm:min-w-*`). On a phone they would force the
  sideways scroll that the previous rule avoids.
- **Header icons show from `md` up**; phones get the plain label. Icon plus label does not fit a
  narrow column.
- **Sorting compares numbers by value and text by the locale, with numbers inside text by value**
  ("Depot 2" before "Depot 10"). Missing values sort first. That is the order a person would
  write down.
- **The page lives in the URL (`?page=`)**, so back and reload return to it. A page beyond the data
  shows the last page instead of an empty table.

## Phone layout

- **Navigation is a tab bar at the bottom** with four destinations; settings sit in the user menu at
  the top. The bottom is within reach of the thumb, and four labels fit at 360px.
- **Below `sm`, sections lose their card frame** (`SECTION_CARD` in
  `web/src/components/sectionCard.ts`: no ring, background, rounding or padding, `gap-3` between
  sections). A section that fills the width (a table, chart or list) gains nothing from a frame on a
  phone but loses its width to padding.
- **Small grouped tiles keep a light frame on phones**, like the dashboard's KPI tiles. There the
  frame ties a label to its number.
- **Form dialogs take the whole screen on phones**, with the buttons at the bottom. A centred modal
  leaves no room for the fields once the keyboard is open.

## States

- **Loading shows a spinner over the section, which keeps its size** (`ProgressCard`). The page does
  not jump when the data arrives.
- **An empty section says why it is empty, and the way out if there is one.** "Noch keine
  Transaktionen. Neue anlegen oder Abrechnungen hochladen." instead of "Keine Daten". A bare "no
  data" looks like a bug, and a new user does not know what to do first. Each cause gets its own
  text: no transactions at all is not the same as nothing held in this period.
- **A failed load is never shown as empty or as 0.** A depot worth "0 €" because the server timed
  out is a wrong answer, an error is an honest one. Sections (`ProgressCard`, `DataTable`) take a
  required `failure` and show the `LoadError` panel in place of their content.
- **The error panel shows the server's own message and offers "Erneut versuchen".** The message
  tells a timeout from a lost session or a bug. The button reloads every failed load of the view
  (`useLoadFailure` collects them), not only the one section.
- **Figures derived from a failed load are hidden**, like KPIs or sums over a failed list. A sum
  over half the data is a wrong number that looks right.
- **A page whose base data failed shows the error panel, not "not found".** The stock may well
  exist; only the load failed.
- **A chart tells "empty" from "still loading"**: no empty text while it loads. `PlotArea` requires
  the empty text, so every chart names its cause.

## Charts

- **Charts have a fixed height (260px, 400px from `md`).** Width varies with the screen, height
  keeps the page from jumping.
- **Dragging across a chart, with mouse or finger, zooms into those days.** A zoom is a new date
  range that is fetched at that resolution, with a rescaled y axis; clipping the x axis alone would
  keep the coarse points and the old scale.
- **Axis ticks fall on calendar boundaries** (midnight, first of the month, quarters), spaced by the
  finest step that stays readable. Ticks on arbitrary days cannot be read off.
- **Log scale ticks are round growth factors**, so that +100 % and -50 % lie equally far from 0 %.
- **A comparison line whose hue is taken by an earlier one is dashed.** There are six hues; a
  seventh line must still be told apart.
- **Controls sit in one row below the chart and wrap on narrow screens.**

## Interaction

- **Deleting asks first, in an alert dialog naming what goes.** Nothing in the app can be undone.
- **A click next to a form dialog does not close it**; only Escape and the buttons do. Otherwise a
  stray tap throws away what was typed.
- **The sidebar's dashboard sections highlight while in view**, and a click scrolls there replacing
  the history entry. Back then leaves the page instead of stepping through its sections.
- **A new version announces itself ("Update available") instead of reloading on its own.** A reload
  in the middle of typing a transaction would lose it.

## Known gaps

Places where the app breaks a rule above. They are bugs, not exceptions.

- **The dashboard's positions and periods tables scroll sideways at 360px** (fine from 384px). The
  interest rate column ("+22,3 % p.a.") is the widest. Fix it when touching those tables.

## Tried and rejected

- **Teal as the brand colour.** Navy and orange replaced it with the rename, in the UI and in
  the gain colours.
- **Cream or beige surfaces.** Cream stays in the logo. As a surface it looked like someone else's
  product.
- **Red for losses.** Too close to the brand orange, which means *new high* in the logo. Losses are
  berry.
- **Geist as the UI font.** Compared side by side with Outfit, Outfit won: one family with the
  wordmark, and at 300 for running text it is light enough.
- **Weights above 500 in the UI.** They would compete with the 700 of the wordmark.
- **Card frames around full-width sections on phones**, and **tables scrolled sideways inside
  cards.** See phone layout and tables.
- **A generic "Keine Daten"** for every empty chart. See states.
- **Failed loads shown as an empty list or a 0.** See states.
