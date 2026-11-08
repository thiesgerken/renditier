// The frame around a section of a page: a table, a plot, a list.
//
// A phone does not get one. Its sections stand alone in a single column, so
// the frame only spends the card's padding and the page gutter twice, some 30
// to 40 pixels of a 360px screen, on telling apart content that has no
// neighbour. The page gutter and the section titles separate them well enough.
// From `sm` up there is room for the frame, and the page reads better with it.
export const SECTION_CARD =
  'max-sm:gap-3 max-sm:rounded-none max-sm:bg-transparent max-sm:px-0 max-sm:py-0 max-sm:ring-0 max-sm:[--card-spacing:--spacing(0)]';
