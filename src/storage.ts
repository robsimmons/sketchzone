import { UrlHashAction } from './hash-action.js';

/**
 * Weird placeholder type of documents. Documents are "really" just strings, and documents
 * need to be able to kinda-sort be strings to support the #program=blahblah hash action.
 *
 * However, I also want a document to be able to be a primary document + a few auxillary
 * documents, like the GraphiQL "headers" and "variables".
 *
 * Therefore, DOCUMENT is just a placeholder, to try and keep the code from overly-encoding
 * the assumption that a document is specifically a string.
 */
export type DOCUMENT = string | { t: 'empty' };
export const SKETCHES_DB = 'sketches';
export const TABS_DB = 'tabs';

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
export function addSketch(
  sketchStore: IDBObjectStore,
  value: SketchObject,
): Promise<IDBValidKey> {
  return new Promise<IDBValidKey>((resolve, reject) => {
    const request = sketchStore.add(value);
    request.onerror = reject;
    request.onsuccess = () => resolve(request.result);
  });
}

export async function initializeStorage(
  hashAction: null | UrlHashAction<DOCUMENT>,
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

      // TODO: Check for legacy localStorage data and add that to the database if need be

      // If there's no hashAction, add the default entries to the store and the tabs
      if (hashAction === null) {
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
