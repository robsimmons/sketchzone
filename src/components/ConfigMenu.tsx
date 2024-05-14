import * as Dialog from '@radix-ui/react-dialog';
import {
  ArchiveIcon,
  MoonIcon,
  QuestionMarkCircledIcon,
  Share1Icon,
  SunIcon,
} from '@radix-ui/react-icons';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React from 'react';

import { SKETCHES_DB, SketchObject } from '../storage.ts';

interface Props {
  db: IDBDatabase;
  restore: (key: IDBValidKey) => Promise<void>;
  share: () => Promise<string>;
  documentName: string;
  custom?: JSX.Element;
  infoUrl?: string;
}

const BUTTON_ICON_SIZE = '24px';

export default function ConfigMenu({ db, restore, share, documentName, infoUrl }: Props) {
  const [open, setOpen] = React.useState(false);
  const [sketches, setSketches] = React.useState<
    null | { key: IDBValidKey; value: SketchObject }[]
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
      setSketches(null);
      return;
    }
    const sketchStore = db.transaction([SKETCHES_DB], 'readonly').objectStore(SKETCHES_DB);
    const cursor = sketchStore.index('updated').openCursor(undefined, 'prev');
    const sketchesAccum: { key: IDBValidKey; value: SketchObject }[] = [];
    cursor.onsuccess = () => {
      if (cursor.result === null) {
        setSketches(sketchesAccum);
      } else {
        sketchesAccum.push({ key: cursor.result.primaryKey, value: cursor.result.value });
        cursor.result.continue();
      }
    };
  }, [db, open]);

  return (
    <>
      <div className="sketchzone-subconfig zone1">
        {infoUrl && (
          <form action={infoUrl} method="get">
            <button>
              <QuestionMarkCircledIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
            </button>
          </form>
        )}
      </div>
      <div className="sketchzone-subconfig zone1">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger title="Show history">
            <ArchiveIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="sketchzone-dialog-overlay"></Dialog.Overlay>
            <Dialog.Content className="sketchzone-dialog-content sketchzone-config-load">
              <Dialog.Title>History</Dialog.Title>
              <VisuallyHidden>
                <Dialog.Description>
                  Pick a previously-opened {documentName} to re-open
                </Dialog.Description>
              </VisuallyHidden>
              {sketches === null ? (
                'loading...'
              ) : (
                <div className="sketchzone-config-load-selections zone1">
                  {sketches.map(({ key, value }) => (
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
          id="sketchzone-config-to-dark"
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
          id="sketchzone-config-to-light"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('body-root')!.className = 'theme-light';
            localStorage.setItem('theme', 'light');
          }}
        >
          <SunIcon width={BUTTON_ICON_SIZE} height={BUTTON_ICON_SIZE} />
        </button>
      </div>
    </>
  );
}
