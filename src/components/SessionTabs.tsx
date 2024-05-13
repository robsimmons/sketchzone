import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import type { TabsObject } from '../storage.js';

interface Props {
  tabs: TabsObject;
  iconSize: string;
  switchToIndex: (index: number) => void;
  deleteIndex: (index: number) => void;
  create: () => void;
}

export default function SessionTabs({ tabs, switchToIndex, deleteIndex, create, iconSize }: Props) {
  const canClose = tabs.sessions.length > 1;
  return (
    <>
      {tabs.sessions.map((session, index) => (
        <div
          key={`${session.key}`}
          className={`sessionzone-tab ${index === tabs.activeSessionIndex ? 'zone1' : 'zone2'} `}
        >
          <button
            className={canClose ? 'sessionzone-tab-left' : 'sessionzone-tab-solo'}
            onClick={(event) => {
              event.preventDefault();
              switchToIndex(index);
            }}
          >
            {session.title}
          </button>
          {canClose && (
            <button
              className="sessionzone-tab-close"
              aria-label="Close tab"
              onClick={(event) => {
                event.preventDefault();
                deleteIndex(index);
              }}
            >
              <Cross2Icon />
            </button>
          )}
        </div>
      ))}
      <div className="sessionzone-tab sessionzone-tab-add">
        <button
          onClick={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <PlusIcon width={iconSize} height={iconSize} />
        </button>
      </div>
    </>
  );
}
