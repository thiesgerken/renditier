import type { ComponentProps } from 'react';
import { cn } from 'cn';

import { DialogContent } from './ui/dialog';

// Form dialogs take the whole screen on phones, where a centred modal leaves
// little room for the fields and the keyboard. A form inside should grow
// (`flex-1`) and push its footer down (`mt-auto`), so that the buttons sit at
// the bottom of the screen. A click next to the form must not throw away what
// was typed, so only Escape and the buttons close it.
const FormDialogContent = ({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) => (
  <DialogContent
    showCloseButton={false}
    onInteractOutside={event => event.preventDefault()}
    className={cn(
      // sm:max-w-none, because DialogContent's own sm:max-w-sm would win
      // between sm and md otherwise.
      'max-md:top-0 max-md:left-0 max-md:flex max-md:h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:overflow-y-auto max-md:rounded-none max-md:ring-0 max-md:sm:max-w-none',
      className
    )}
    {...props}
  />
);

export default FormDialogContent;
