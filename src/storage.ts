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

export type TabsObject = {
  sessions: { key: IDBValidKey; title: string }[];
  activeSessionIndex: number; // 0 <= activeSession < sessions.length
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

export type SessionObject = {
  document: DOCUMENT;
  createdAt: Date;
  updatedAt: Date;
};
export function getSession(sessionStore: IDBObjectStore, key: IDBValidKey): Promise<SessionObject> {
  return new Promise((resolve, reject) => {
    const request = sessionStore.get(key);
    request.onerror = reject;
    request.onsuccess = () => resolve(request.result);
  });
}
export function storeSession(sessionStore: IDBObjectStore, key: IDBValidKey, value: SessionObject) {
  return new Promise((resolve, reject) => {
    const request = sessionStore.put(value, key);
    request.onerror = reject;
    request.onsuccess = resolve;
  });
}
export function addSession(
  sessionStore: IDBObjectStore,
  value: SessionObject,
): Promise<IDBValidKey> {
  return new Promise<IDBValidKey>((resolve, reject) => {
    const request = sessionStore.add(value);
    request.onerror = reject;
    request.onsuccess = () => resolve(request.result);
  });
}

export async function initializeStorage(
  hashAction: null | UrlHashAction<DOCUMENT>,
  defaultEntries: DOCUMENT[] /* Non-empty */,
  extractTitleFromDoc: (doc: DOCUMENT) => string,
  warnUser: (message: string[]) => Promise<void>,
): Promise<{ db: IDBDatabase; tabs: TabsObject; session: SessionObject }> {
  const request = indexedDB.open('session-file-db', 2);
  const now = new Date();

  request.onupgradeneeded = async () => {
    /*
     * Migrate!
     * The upgrade needed event is always called *before* the success event (tested on three major
     * browsers), but with the request.result initialized. This is the point in time where we need:
     *
     * 1. Check if there's legacy localStorage sessions, and port them over if necessary.
     * 2. Otherwise, initialize a new session.
     * 3. In the future if the database gets upgraded past version 1, this function is where the migration
     *    happens.
     */

    try {
      const tabsStore = request.result.createObjectStore('tabs');
      const sessionStore = request.result.createObjectStore('sessions', { autoIncrement: true });
      sessionStore.createIndex('created', 'createdAt');
      sessionStore.createIndex('updated', 'updatedAt');

      // This is initially an invariant violation: the activeSessionIndex isn't a valid entry.
      // This will be fixed by either adding default entries or by adding the document from the hashAction.
      const tabs: TabsObject = { activeSessionIndex: 0, sessions: [] };

      // TODO: Check for legacy localStorage data and add that to the database if need be

      // If there's no hashAction, add the default entries to the store and the tabs
      if (hashAction === null) {
        tabs.sessions = await Promise.all(
          defaultEntries.map(async (entry) => ({
            title: extractTitleFromDoc(entry),
            key: await addSession(sessionStore, {
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
    const tx = request.result.transaction(['tabs', 'sessions'], 'readwrite');
    const tabsStore = tx.objectStore('tabs');
    const sessionsStore = tx.objectStore('sessions');

    // Does this hash action want us to open a file we already have in a tab?
    const currentTabs = await getTabs(tabsStore);
    const checks = await Promise.all(
      currentTabs.sessions.map(async ({ key }) => {
        const session = await getSession(sessionsStore, key);
        return session.document === hashAction.document;
      }),
    );
    const index = checks.findIndex((value) => value);

    if (index >= 0) {
      // Just switch to the tab
      tabs = { activeSessionIndex: index, sessions: currentTabs.sessions };
    } else {
      // Add the session and corresponding tab
      const newSessionKey = await addSession(sessionsStore, {
        document: hashAction.document,
        createdAt: now,
        updatedAt: now,
      });
      const newSessionTitle = extractTitleFromDoc(hashAction.document);
      tabs = {
        activeSessionIndex: currentTabs.sessions.length,
        sessions: currentTabs.sessions.concat([{ title: newSessionTitle, key: newSessionKey }]),
      };
    }
    await storeTabs(tabsStore, tabs);
  } else {
    tabs = await getTabs(request.result.transaction('tabs').objectStore('tabs'));
  }

  return {
    db: request.result,
    tabs,
    session: await getSession(
      request.result.transaction('sessions').objectStore('sessions'),
      tabs.sessions[tabs.activeSessionIndex].key,
    ),
  };
}
