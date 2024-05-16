import type { DOCUMENT } from './document.ts';
import type { UrlHashAction } from './hash-action.js';

export const SKETCHES_DB = 'sketches';
export const TABS_DB = 'tabs';

/* IndexedDB backing for sketch storage */

export type TabsObject = {
  sketches: { key: IDBValidKey; title: string }[];
  displayedSketchIndex: number; // 0 <= displayedSketchIndex < sketches.length
};
export function getTabs(tabsStore: IDBObjectStore): Promise<TabsObject> {
  return new Promise((resolve, reject) => {
    const request = tabsStore.get(0);
    request.onerror = reject;
    request.onsuccess = () => resolve(request.result);
  });
}
export function storeTabs(tabsStore: IDBObjectStore, value: TabsObject) {
  return new Promise((resolve, reject) => {
    const request = tabsStore.put(value, 0);
    request.onerror = reject;
    request.onsuccess = resolve;
  });
}

export type SketchObject = {
  document: DOCUMENT;
  createdAt: Date;
  updatedAt: Date;
};
export function getSketch(sketchStore: IDBObjectStore, key: IDBValidKey): Promise<SketchObject> {
  return new Promise((resolve, reject) => {
    const request = sketchStore.get(key);
    request.onerror = reject;
    request.onsuccess = () => resolve(request.result);
  });
}
export function storeSketch(sketchStore: IDBObjectStore, key: IDBValidKey, value: SketchObject) {
  return new Promise((resolve, reject) => {
    const request = sketchStore.put(value, key);
    request.onerror = reject;
    request.onsuccess = resolve;
  });
}
export function addSketch(sketchStore: IDBObjectStore, value: SketchObject): Promise<IDBValidKey> {
  return new Promise<IDBValidKey>((resolve, reject) => {
    const request = sketchStore.add(value);
    request.onerror = reject;
    request.onsuccess = () => resolve(request.result);
  });
}

export async function initializeStorage(
  hashAction: null | UrlHashAction,
  defaultEntries: DOCUMENT[] /* Non-empty */,
  extractTitleFromDoc: (doc: DOCUMENT) => string,
  warnUser: (message: string[]) => Promise<void>,
): Promise<{ db: IDBDatabase; tabs: TabsObject; sketch: SketchObject }> {
  const request = indexedDB.open('sketchzone-db', 2);
  const now = new Date();

  request.onupgradeneeded = async () => {
    /*
     * Migrate!
     * The upgrade needed event is always called *before* the success event (tested on three major
     * browsers), but with the request.result initialized. This is the point in time where we need:
     *
     * 1. Check if there's legacy localStorage sketches, and port them over if necessary.
     * 2. Otherwise, initialize a new database
     * 3. In the future if the database gets upgraded past version 1, this function is where the migration
     *    happens.
     */

    try {
      const tabsStore = request.result.createObjectStore(TABS_DB);
      const sketchStore = request.result.createObjectStore(SKETCHES_DB, { autoIncrement: true });
      sketchStore.createIndex('created', 'createdAt');
      sketchStore.createIndex('updated', 'updatedAt');

      // This is initially an invariant violation: the displayedSketchIndex isn't a valid entry.
      // This will be fixed by either adding default entries or by adding the document from the hashAction.
      const tabs: TabsObject = { displayedSketchIndex: 0, sketches: [] };

      // This while if-statement can be deleted after JUNE 2024
      // It grabs all the entries for the Dusa editor to facilitate migrating dusa.rocks to sketchzone
      if (localStorage.getItem('dusa-sessions')) {
        const programs: { [uuid: string]: { title: string; key: IDBValidKey } } = {};
        for (let i = 0; i < localStorage.length; i++) {
          const prefix = 'dusa-session-';
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) {
            const uuid = key.slice(prefix.length);
            const program = localStorage.getItem(key)!;
            programs[uuid] = {
              title: extractTitleFromDoc(program),
              key: await addSketch(sketchStore, {
                document: program,
                createdAt: now,
                updatedAt: now,
              }),
            };
          }
        }

        tabs.sketches = localStorage
          .getItem('dusa-sessions')!
          .split(',')
          .map((uuid): undefined | { title: string; key: IDBValidKey } => programs[uuid])
          .filter((elem): elem is { title: string; key: IDBValidKey } => elem !== undefined);
      }

      if (
        hashAction === null &&
        tabs.sketches.length === 0 // this check is redundant when the localStorage logic above is removed
      ) {
        // If there's no hashAction, add the default entries to the store and the tabs

        tabs.sketches = await Promise.all(
          defaultEntries.map(async (entry) => ({
            title: extractTitleFromDoc(entry),
            key: await addSketch(sketchStore, {
              document: entry,
              createdAt: now,
              updatedAt: now,
            }),
          })),
        );
      }
      storeTabs(tabsStore, tabs);
    } catch (err) {
      console.error(err);
      await warnUser([
        'Could not initialize the file database! The application is unlikely to work.',
        `Error: ${err}`,
      ]);
    }
  };

  request.onerror = async (ev) => {
    console.error(ev);
    await warnUser([
      'Could not initialize the file database! The application is unlikely to work.',
    ]);
  };

  request.onblocked = async (ev) => {
    console.error(ev);
    await warnUser([
      'Initializing the file database got blocked. This is unexpected and could be a bug.',
    ]);
  };

  await new Promise((resolve) => {
    request.onsuccess = resolve;
  });

  // Any necessary migrations are complete. Apply the hash action.
  let tabs: TabsObject;
  if (hashAction !== null) {
    const tx = request.result.transaction([TABS_DB, SKETCHES_DB], 'readwrite');
    const tabsStore = tx.objectStore(TABS_DB);
    const sketchStore = tx.objectStore(SKETCHES_DB);

    // Does this hash action want us to open a file we already have in a tab?
    const currentTabs = await getTabs(tabsStore);
    const checks = await Promise.all(
      currentTabs.sketches.map(async ({ key }) => {
        const sketch = await getSketch(sketchStore, key);
        return sketch.document === hashAction.document;
      }),
    );
    const index = checks.findIndex((value) => value);

    if (index >= 0) {
      // Just switch to the tab
      tabs = { displayedSketchIndex: index, sketches: currentTabs.sketches };
    } else {
      // Add the sketch and corresponding tab
      const newSketchKey = await addSketch(sketchStore, {
        document: hashAction.document,
        createdAt: now,
        updatedAt: now,
      });
      const newSketchTitle = extractTitleFromDoc(hashAction.document);
      tabs = {
        displayedSketchIndex: currentTabs.sketches.length,
        sketches: currentTabs.sketches.concat([{ title: newSketchTitle, key: newSketchKey }]),
      };
    }
    await storeTabs(tabsStore, tabs);
  } else {
    tabs = await getTabs(request.result.transaction(TABS_DB).objectStore(TABS_DB));
  }

  return {
    db: request.result,
    tabs,
    sketch: await getSketch(
      request.result.transaction(SKETCHES_DB).objectStore(SKETCHES_DB),
      tabs.sketches[tabs.displayedSketchIndex].key,
    ),
  };
}
