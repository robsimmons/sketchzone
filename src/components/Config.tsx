import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React from 'react';
import type { SessionObject } from '../storage.js';
import { ArchiveIcon, MoonIcon, Share1Icon, SunIcon } from '@radix-ui/react-icons';
interface Props {
  db: IDBDatabase;
  restore: (key: IDBValidKey) => Promise<void>;
  share: () => Promise<string>;
  custom?: JSX.Element;
}

const BUTTON_ICON_SIZE = '24px';

export default function ConfigMenu({ db, restore, share }: Props) {
  const [open, setOpen] = React.useState(false);
  const [sessions, setSessions] = React.useState<
    null | { key: IDBValidKey; value: SessionObject }[]
  >(null);
  const alerted = React.useRef(false);

  React.useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
      document.getElementById('body-root')!.className = 'theme-light';
    } else if (theme === 'dark') {
      document.getElementById('body-root')!.className = 'theme-dark';
    }
  });

  React.useEffect(() => {
    if (!open) {
      setSessions(null);
      return;
    }
    const sessionStore = db.transaction(['sessions'], 'readonly').objectStore('sessions');
    const updatedIndex = sessionStore.index('updated');
    const cursor = updatedIndex.openCursor(undefined, 'prev');
    const sessionsAccum: { key: IDBValidKey; value: SessionObject }[] = [];
    cursor.onsuccess = () => {
      if (cursor.result === null) {
        setSessions(sessionsAccum);
      } else {
        sessionsAccum.push({ key: cursor.result.primaryKey, value: cursor.result.value });
        cursor.result.continue();
      }
    };
  }, [db, open]);

  return (
    <div className="zone1 sessionzone-config-menu">
      <button>
        <MoonIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>
      <button>
        <MoonIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>
      <button>
        <MoonIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>
      <button>
        <MoonIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger title="Show history">
          <ArchiveIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="sessionzone-dialog-overlay"></Dialog.Overlay>
          <Dialog.Content className="sessionzone-dialog-content sessionzone-config-load">
            <Dialog.Title>History</Dialog.Title>
            <VisuallyHidden>
              <Dialog.Description>Pick a previously-opened program to re-open</Dialog.Description>
            </VisuallyHidden>
            {sessions === null ? (
              'loading...'
            ) : (
              <div className="sessionzone-config-load-selections zone1">
                {sessions.map(({ key, value }) => (
                  <button
                    key={`${key}`}
                    onClick={async (event) => {
                      event.preventDefault();
                      await restore(key);
                      setOpen(false);
                    }}
                  >
                    <div>{`${value.document}`.trim().slice(0, 200)}</div>
                    <div className="time">Last edited {`${value.updatedAt}`}</div>
                    <div className="time">Created {`${value.updatedAt}`}</div>
                  </button>
                ))}
              </div>
            )}
            <div>
              <Dialog.Close>Cancel</Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <button
        title="Copy sharable link"
        onClick={async (event) => {
          event.preventDefault();
          const sharableURL = await share();

          try {
            navigator.clipboard.writeText(sharableURL).then(
              () => {
                if (!alerted.current) {
                  alerted.current = true;
                  alert('Sharable link copied to clipboard');
                }
              },
              () => {
                alert(
                  'Unable to copy sharable URL to clipboard, but you can copy the link from your address bar',
                );
              },
            );
          } catch {
            alert(
              'Unable to copy sharable URL to clipboard, but you can copy the link from your address bar',
            );
          }
        }}
      >
        <Share1Icon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>
      <button
        title="Switch to dark mode"
        id="sessionzone-config-to-dark"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('body-root')!.className = 'theme-dark';
          localStorage.setItem('theme', 'dark');
        }}
      >
        <MoonIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>
      <button
        title="Switch to light mode"
        id="sessionzone-config-to-light"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('body-root')!.className = 'theme-light';
          localStorage.setItem('theme', 'light');
        }}
      >
        <SunIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
      </button>
    </div>
  );
}
