import { useState, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { NotificationBell } from './NotificationBell';
import { NotificationList } from './NotificationList';

export function NotificationPopover() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div className="flex items-center">
          <NotificationBell onClick={() => setOpen((prev) => !prev)} />
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg"
          sideOffset={8}
          align="end"
        >
          <NotificationList mode="popover" maxItems={5} onClose={handleClose} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default NotificationPopover;
