import { UrlHashAction, decodeUrlHashAction, encodeUrlHashAction } from './hash-action.js';
import ReactDOM from 'react-dom/client';
import {
  SessionObject,
  TabsObject,
  addSession,
  getSession,
  initializeStorage,
  storeSession,
  storeTabs,
} from './storage.js';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import InspectorController from './components/InspectorController.js';
import setupSessionDivider from './components/SessionDivider.js';
import SessionTabs from './components/SessionTabs.js';
import holdForModal from './components/HoldingModal.js';
import ActiveSession from './active-session.js';

const ICON_SIZE = '24px';

type DOCUMENT = string | { t: 'empty' };

/**
 * Interact with all the decoding nonsense in hash-action.ts, return a hash
 * action or null if there's no hash action.
 */
async function readActionFromURLHash(): Promise<UrlHashAction<DOCUMENT> | null> {
  const hashActionOrError = await decodeUrlHashAction<DOCUMENT>(window.location.hash, (blob) => {
    if (typeof blob === 'string') return null;
    if (JSON.stringify(blob) === '{"t":"empty"}') return null;
    return 'The document did not have the expect format (a string)';
  });
  if (hashActionOrError?.t === 'error') {
    await holdForModal(
      'Could not open URL hash',
      'The link you opened was supposed to share a document, ' +
        "but that didn't work. If someone was trying to share a " +
        'document with you, you may need them to try again.',
      [`Error: ${hashActionOrError.msg}`],
    );
    return null;
  }
  return hashActionOrError;
}

/**
 * This is the hairiest ball of wax in the application, because it's where we need to
 * maintain session data and keep the database in sync with itself.
 *
 * @param emptyDocument
 * @param extractTitleFromDoc
 */
async function setupEditorInteractions<SessionData>(
  emptyDocument: () => DOCUMENT,
  extractTitleFromDoc: (doc: DOCUMENT) => string,
  codemirrorExtensions: Extension[],
  title: string,
  db: IDBDatabase,
  initialTabs: TabsObject,
  initialSession: SessionObject,
) {
  /** STATE VARIABLES **/
  /* The tabs kept in-memory are either exactly the tab data pulled from the database
   * (tab.active === false) or ActiveSession objects (tab.active === true). Tabs are
   * lazily turned from data-only sessions to ActiveSessions as tabs are opened for the
   * first time. This isn't done for efficiency, but because it actually helped me
   * understand what was going on.
   *
   * INVARIANT: tabs.sessions[tabs.activeSession] === displayedSession
   * If you mess with tabs.sessions, you need to immediately call
   * restoreSessionFromTabs() to persist the tabs to memory and reset the activeSession
   * correctly.
   */
  const tabs: {
    current: {
      activeSessionIndex: number;
      sessions: (ActiveSession<SessionData> | { title: string; key: IDBValidKey; active: false })[];
    };
  } = {
    current: {
      activeSessionIndex: initialTabs.activeSessionIndex,
      sessions: initialTabs.sessions.map((session) => ({ ...session, active: false })),
    },
  };
  const displayedSession: { current: ActiveSession<SessionData> } = {
    current: new ActiveSession(
      tabs.current.sessions[tabs.current.activeSessionIndex].key,
      initialSession,
      codemirrorExtensions,
      triggerRedraw,
      triggerStorage,
      extractTitleFromDoc,
    ),
  };

  function extractTabsForStorage(): TabsObject {
    return {
      activeSessionIndex: tabs.current.activeSessionIndex,
      sessions: tabs.current.sessions.map(({ key, title }) => ({ key, title })),
    };
  }

  /** CALLBACKS ONLY PASSED TO/INVOKED BY ACTIVE SESSION **/
  async function triggerStorage(
    key: IDBValidKey,
    createdAt: Date,
    updatedAt: Date,
    document: DOCUMENT,
  ) {
    const tx = db.transaction(['sessions', 'tabs'], 'readwrite');
    const tabsStore = tx.objectStore('tabs');
    const sessionStore = tx.objectStore('sessions');
    await storeTabs(tabsStore, extractTabsForStorage());
    await storeSession(sessionStore, key, { createdAt, updatedAt, document });
  }

  /** CODEMIRROR **/
  const view = new EditorView({
    state: displayedSession.current.codemirrorState,
    parent: document.getElementById('sessionzone-codemirror-root')!,
  });

  /** INSPECTOR CONTROLLER **/
  const inspectorControllerRoot = ReactDOM.createRoot(
    document.getElementById('sessionzone-inspector-controller')!,
  );
  function renderInspectorController() {
    const state =
      displayedSession.current.sessionData === null
        ? 'unloaded'
        : displayedSession.current.sessionData.isClientOutOfDate
        ? 'modified'
        : 'loaded';
    inspectorControllerRoot.render(InspectorController({ state, iconSize: ICON_SIZE }));
  }

  /** SESSION TABS CONTROLLER **/
  const sessionTabsRoot = ReactDOM.createRoot(document.getElementById('sessionzone-tabs')!);
  function renderSessionTabs() {
    sessionTabsRoot.render(
      SessionTabs({
        tabs: tabs.current,
        iconSize: ICON_SIZE,
        switchToIndex,
        deleteIndex,
        create: createSession,
      }),
    );
  }

  function switchToIndex(index: number) {
    tabs.current = {
      activeSessionIndex: index,
      sessions: tabs.current.sessions,
    };
    restoreSessionFromTabs();
  }

  async function deleteIndex(index: number) {
    if (tabs.current.sessions.length === 1) return;
    const removedSession = tabs.current.sessions[index];
    let activeSessionIndex = tabs.current.activeSessionIndex;
    const sessions = tabs.current.sessions.toSpliced(index, 1);
    if (index === tabs.current.activeSessionIndex) {
      // Terminating current active session
      displayedSession.current.terminate();
      if (index === sessions.length) activeSessionIndex -= 1;
    } else {
      // Terminating a different session
      if (removedSession.active) removedSession.terminate();
      if (index < tabs.current.activeSessionIndex) activeSessionIndex -= 1;
    }

    tabs.current = { activeSessionIndex, sessions };
    await restoreSessionFromTabs();
  }

  async function createSession() {
    const now = new Date();
    const sessionStore = db.transaction(['sessions'], 'readwrite').objectStore('sessions');
    const emptyDoc = emptyDocument();
    const key = await addSession(sessionStore, {
      document: emptyDoc,
      createdAt: now,
      updatedAt: now,
    });
    tabs.current = {
      activeSessionIndex: tabs.current.sessions.length,
      sessions: tabs.current.sessions.concat([
        { active: false, key, title: extractTitleFromDoc(emptyDoc) },
      ]),
    };

    restoreSessionFromTabs();
  }

  /** RESTORING SESSION STATUS **/
  async function restoreSessionFromTabs() {
    const tx = db.transaction(['tabs', 'sessions'], 'readwrite');
    const tabsStore = tx.objectStore('tabs');
    const sessionStore = tx.objectStore('sessions');
    await storeTabs(tabsStore, extractTabsForStorage());

    if (displayedSession.current !== tabs.current.sessions[tabs.current.activeSessionIndex]) {
      const rememberedSession = await getSession(
        sessionStore,
        tabs.current.sessions[tabs.current.activeSessionIndex].key,
      );

      const newlyActivePseudoSession = tabs.current.sessions[tabs.current.activeSessionIndex];
      if (newlyActivePseudoSession.active === true) {
        displayedSession.current = newlyActivePseudoSession;
        view.setState(displayedSession.current.codemirrorState);

        // Checks for situations where another browser window has been used to update this session
        // Technically we should use time comparison for this, but because the user can only have
        // one focused window at a time, the possibility of conflicting changes with the same
        // timestamp seems infinitesimal
        if (
          rememberedSession.updatedAt.getTime() !==
          displayedSession.current.documentUpdatedAt.getTime()
        ) {
          displayedSession.current.title = extractTitleFromDoc(rememberedSession.document);
          view.dispatch({
            changes: {
              from: 0,
              to: displayedSession.current.codemirrorState.doc.length,
              insert:
                typeof rememberedSession.document === 'string'
                  ? rememberedSession.document
                  : '<object placeholder>',
            },
          });
          if (displayedSession.current.sessionData !== null) {
            displayedSession.current.sessionData.isClientOutOfDate = true;
          }
        }
      } else {
        displayedSession.current = new ActiveSession(
          newlyActivePseudoSession.key,
          rememberedSession,
          codemirrorExtensions,
          triggerRedraw,
          triggerStorage,
          extractTitleFromDoc,
        );
        tabs.current.sessions[tabs.current.activeSessionIndex] = displayedSession.current;
        view.setState(displayedSession.current.codemirrorState);
      }
    }
    triggerRedraw();
  }

  function triggerRedraw() {
    if (window.location.hash !== '') {
      window.location.hash = '';
    }
    document.title = `${title} | ${tabs.current.sessions[tabs.current.activeSessionIndex].title}`;
    renderInspectorController();
    renderSessionTabs();
  }

  /** GO! **/
  restoreSessionFromTabs();

  return {
    restore: async (sessionKey: IDBValidKey) => {
      let found = false;
      for (const [index, { key }] of tabs.current.sessions.entries()) {
        if (key === sessionKey) {
          tabs.current.activeSessionIndex = index;
          found = true;
          break;
        }
      }

      if (!found) {
        const sessionStore = db.transaction(['sessions'], 'readonly').objectStore('sessions');
        const rememberedSession = await getSession(sessionStore, sessionKey);
        console.log(rememberedSession);
        tabs.current = {
          activeSessionIndex: tabs.current.sessions.length,
          sessions: tabs.current.sessions.concat([
            new ActiveSession(
              sessionKey,
              rememberedSession,
              codemirrorExtensions,
              triggerRedraw,
              triggerStorage,
              extractTitleFromDoc,
            ),
          ]),
        };
      }

      await restoreSessionFromTabs();
    },
    share: async () => {
      window.location.hash = await encodeUrlHashAction<DOCUMENT>({
        t: 'open',
        document: displayedSession.current.codemirrorState.doc.toString(),
      });
      return window.location.toString();
    },
    db,
  };
}

export async function setup<SessionData>(options: {
  emptyDocument: () => DOCUMENT;
  extractTitleFromDoc: (doc: DOCUMENT) => string;
  codemirrorExtensions: Extension[];
  defaultEntries?: DOCUMENT[];
  title?: string;
}) {
  // Initialize and read path
  const title = options.title ?? document.title;
  document.getElementById('sessionzone-logo')!.innerText = title;
  const hashAction: UrlHashAction<DOCUMENT> | null = await readActionFromURLHash();
  const { db, tabs, session } = await initializeStorage(
    hashAction,
    options.defaultEntries ?? [options.emptyDocument()],
    options.extractTitleFromDoc,
    (messages) => holdForModal('Error loading workspace', messages[0], messages.slice(1)),
  );

  // Web setup that can be done independently from the hairy ball of wax
  setupSessionDivider();

  // Set up the hairy ball of session-management wax
  return await setupEditorInteractions<SessionData>(
    options.emptyDocument,
    options.extractTitleFromDoc,
    options.codemirrorExtensions,
    title,
    db,
    tabs,
    session,
  );
}
