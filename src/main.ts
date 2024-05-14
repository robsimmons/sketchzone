import { UrlHashAction, decodeUrlHashAction, encodeUrlHashAction } from './hash-action.js';
import ReactDOM from 'react-dom/client';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import ActiveSketch from './active-sketch.js';
import holdForModal from './components/HoldingModal.js';
import InspectorController from './components/InspectorController.js';
import setupDivider from './components/Divider.js';
import SketchTabs from './components/SketchTabs.js';
import type { DOCUMENT } from './document.js';
import {
  SKETCHES_DB,
  SketchObject,
  TABS_DB,
  TabsObject,
  addSketch,
  getSketch,
  initializeStorage,
  storeSketch,
  storeTabs,
} from './storage.js';
import type { Inspector, SetupProps } from './implementer-types.js';
import { render } from 'react-dom';

const ICON_SIZE = '24px';

/**
 * Interact with all the decoding nonsense in hash-action.ts, return a hash
 * action or null if there's no hash action.
 */
async function readActionFromURLHash(): Promise<UrlHashAction | null> {
  const hashActionOrError = await decodeUrlHashAction(window.location.hash);
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
 * maintain data for all active sketches, keep the current sketch displayed and in sync
 * with their inspectors, and keep the database in sync with itself.
 *
 * @param emptyDocument
 * @param extractTitleFromDoc
 */
async function setupEditorInteractions(
  emptyDocument: () => DOCUMENT,
  extractTitleFromDoc: (doc: DOCUMENT) => string,
  createAndMountInspector: (elem: HTMLDivElement, doc: DOCUMENT) => Inspector | void,
  codemirrorExtensions: Extension[],
  documentName: string,
  title: string,
  db: IDBDatabase,
  initialTabs: TabsObject,
  initialSketch: SketchObject,
) {
  /** STATE VARIABLES **/
  /* The tabs kept in-memory are either exactly the tab data pulled from the database
   * (tab.active === false) or ActiveSketch objects (tab.active === true). Tabs are
   * lazily turned from data-only sketches to ActiveSketches as tabs are opened for the
   * first time. This isn't done for efficiency, but because it actually helped me
   * understand what was going on.
   *
   * INVARIANT: tabs.sketches[tabs.displayedSketchIndex] === displayedSketch
   * If you mess with tabs.sketches, you need to immediately call
   * restoreFromTabs() which will persist the tabs to memory and reset the
   * displayedSketchIndex correctly.
   */
  const tabs: {
    current: {
      displayedSketchIndex: number;
      sketches: (ActiveSketch | { title: string; key: IDBValidKey; active: false })[];
    };
  } = {
    current: {
      displayedSketchIndex: initialTabs.displayedSketchIndex,
      sketches: initialTabs.sketches.map((sketch) => ({ ...sketch, active: false })),
    },
  };
  const displayedSketch: { current: ActiveSketch } = {
    current: new ActiveSketch(
      tabs.current.sketches[tabs.current.displayedSketchIndex].key,
      initialSketch,
      createAndMountInspector,
      codemirrorExtensions,
      triggerRedraw,
      triggerStorage,
      extractTitleFromDoc,
    ),
  };

  function extractTabsForStorage(): TabsObject {
    return {
      displayedSketchIndex: tabs.current.displayedSketchIndex,
      sketches: tabs.current.sketches.map(({ key, title }) => ({ key, title })),
    };
  }

  /** CALLBACKS: ONLY PASSED TO THE ActiveSketch CONSTRUCTOR **/
  async function triggerStorage(
    key: IDBValidKey,
    createdAt: Date,
    updatedAt: Date,
    document: DOCUMENT,
  ) {
    const tx = db.transaction([SKETCHES_DB, TABS_DB], 'readwrite');
    const tabsStore = tx.objectStore(TABS_DB);
    const sketchStore = tx.objectStore(SKETCHES_DB);
    await storeTabs(tabsStore, extractTabsForStorage());
    await storeSketch(sketchStore, key, { createdAt, updatedAt, document });
  }

  /** CODEMIRROR **/
  const view = new EditorView({
    state: displayedSketch.current.codemirrorState,
    parent: document.getElementById('sketchzone-codemirror-root')!,
  });

  /** INSPECTOR CONTROLLER **/
  const inspectorControllerRoot = ReactDOM.createRoot(
    document.getElementById('sketchzone-inspector-controller')!,
  );
  document.getElementById('sketchzone-active-sketch')!.className =
    'active-sketch-is-showing-editor';
  function renderInspectorController() {
    const state =
      displayedSketch.current.inspectorState === null
        ? 'unloaded'
        : displayedSketch.current.inspectorState.isInspectorOutOfDate
        ? 'modified'
        : 'loaded';
    inspectorControllerRoot.render(
      InspectorController({
        state,
        iconSize: ICON_SIZE,
        onLoad: async () => {
          await displayedSketch.current.load(
            displayedSketch.current.codemirrorState.doc.toString(),
          );
          setTimeout(renderInspectorController);
        },
        documentName,
      }),
    );
  }

  /** TABS CONTROLLER **/
  const tabsRoot = ReactDOM.createRoot(document.getElementById('sketchzone-tabs')!);
  function renderSketchTabs() {
    tabsRoot.render(
      SketchTabs({
        tabs: tabs.current,
        iconSize: ICON_SIZE,
        switchToIndex,
        deleteIndex,
        create: createSketch,
      }),
    );
  }

  function switchToIndex(index: number) {
    tabs.current = {
      displayedSketchIndex: index,
      sketches: tabs.current.sketches,
    };
    restoreFromTabs();
  }

  async function deleteIndex(index: number) {
    if (tabs.current.sketches.length === 1) return;

    let displayedSketchIndex;
    if (index === tabs.current.displayedSketchIndex) {
      // Deleting current displayed sketch
      // Expected behavior is that we switch to the next tab to the right,
      // which amounts to keeping the index the same. Move the index left
      // only if we deleted the last thing (and the current displayedSketchIndex
      // would no longer be a valid index into the array)
      displayedSketchIndex =
        index === tabs.current.sketches.length - 1
          ? tabs.current.displayedSketchIndex - 1
          : tabs.current.displayedSketchIndex;
    } else {
      // Deleting a sketch that's not currently displayed
      // Move the index left if that's needed to keep the currently
      // displayed sketch displayed
      displayedSketchIndex =
        index > tabs.current.displayedSketchIndex
          ? tabs.current.displayedSketchIndex
          : tabs.current.displayedSketchIndex - 1;
    }

    tabs.current = { displayedSketchIndex, sketches: tabs.current.sketches.toSpliced(index, 1) };
    await restoreFromTabs();
  }

  async function createSketch() {
    const now = new Date();
    const sketchStore = db.transaction([SKETCHES_DB], 'readwrite').objectStore(SKETCHES_DB);
    const emptyDoc = emptyDocument();
    const key = await addSketch(sketchStore, {
      document: emptyDoc,
      createdAt: now,
      updatedAt: now,
    });
    tabs.current = {
      displayedSketchIndex: tabs.current.sketches.length,
      sketches: tabs.current.sketches.concat([
        { active: false, key, title: extractTitleFromDoc(emptyDoc) },
      ]),
    };

    restoreFromTabs();
  }

  /** RESTORING SKETCH STATUS **/
  async function restoreFromTabs() {
    const tx = db.transaction([TABS_DB, SKETCHES_DB], 'readwrite');
    const tabsStore = tx.objectStore(TABS_DB);
    const sketchStore = tx.objectStore(SKETCHES_DB);
    await storeTabs(tabsStore, extractTabsForStorage());

    if (displayedSketch.current !== tabs.current.sketches[tabs.current.displayedSketchIndex]) {
      await displayedSketch.current.blur();
      if (!tabs.current.sketches.some((sketch) => sketch.key === displayedSketch.current.key)) {
        await displayedSketch.current.terminate();
      }

      const rememberedSketch = await getSketch(
        sketchStore,
        tabs.current.sketches[tabs.current.displayedSketchIndex].key,
      );

      const sketchToRestore = tabs.current.sketches[tabs.current.displayedSketchIndex];
      if (sketchToRestore.active === true) {
        displayedSketch.current = sketchToRestore;
        view.setState(displayedSketch.current.codemirrorState);
        await sketchToRestore.focus();

        // Checks for situations where another browser window has been used to update this sketch
        // It's kind of a code smell to use time comparison as a unique identifier in this way, but
        // because the user can only have one focused window at a time, the possibility of
        // conflicting changes with the same timestamp seems infinitesimal
        if (
          rememberedSketch.updatedAt.getTime() !==
          displayedSketch.current.documentUpdatedAt.getTime()
        ) {
          displayedSketch.current.title = extractTitleFromDoc(rememberedSketch.document);
          view.dispatch({
            changes: {
              from: 0,
              to: displayedSketch.current.codemirrorState.doc.length,
              insert: typeof rememberedSketch.document,
            },
          });
          if (displayedSketch.current.inspectorState !== null) {
            displayedSketch.current.inspectorState.isInspectorOutOfDate = true;
          }
        }
      } else {
        displayedSketch.current = new ActiveSketch(
          sketchToRestore.key,
          rememberedSketch,
          createAndMountInspector,
          codemirrorExtensions,
          triggerRedraw,
          triggerStorage,
          extractTitleFromDoc,
        );
        tabs.current.sketches[tabs.current.displayedSketchIndex] = displayedSketch.current;
        view.setState(displayedSketch.current.codemirrorState);
      }
    }
    triggerRedraw();
  }

  function triggerRedraw() {
    if (window.location.hash !== '') {
      window.location.hash = '';
    }
    document.title = `${title} | ${tabs.current.sketches[tabs.current.displayedSketchIndex].title}`;
    renderInspectorController();
    renderSketchTabs();
  }

  /** GO! **/
  restoreFromTabs();

  return {
    restore: async (sketchKey: IDBValidKey) => {
      let found = false;
      for (const [index, { key }] of tabs.current.sketches.entries()) {
        if (key === sketchKey) {
          tabs.current.displayedSketchIndex = index;
          found = true;
          break;
        }
      }

      if (!found) {
        const sketchStore = db.transaction([SKETCHES_DB], 'readonly').objectStore(SKETCHES_DB);
        const rememberedSketch = await getSketch(sketchStore, sketchKey);
        tabs.current = {
          displayedSketchIndex: tabs.current.sketches.length,
          sketches: tabs.current.sketches.concat([
            new ActiveSketch(
              sketchKey,
              rememberedSketch,
              createAndMountInspector,
              codemirrorExtensions,
              triggerRedraw,
              triggerStorage,
              extractTitleFromDoc,
            ),
          ]),
        };
      }

      await restoreFromTabs();
    },
    share: async () => {
      window.location.hash = await encodeUrlHashAction({
        t: 'open',
        document: displayedSketch.current.codemirrorState.doc.toString(),
      });
      return window.location.toString();
    },
    db,
  };
}

export async function setup(options: SetupProps) {
  // Set up storage
  const title = options.appName ?? document.title;
  if (document.getElementById('sketchzone-logo')!.innerText === '') {
    document.getElementById('sketchzone-logo')!.innerText = title;
  }
  const emptyDocument: () => DOCUMENT = options.emptyDocument ?? (() => '');
  const extractTitleFromDoc =
    options.extractTitleFromDoc ??
    ((doc: DOCUMENT) => {
      const firstLine = doc.split('\n')[0].trim();
      if (firstLine === '') return '<unnamed>';
      return firstLine;
    });
  const hashAction: UrlHashAction | null = await readActionFromURLHash();
  const { db, tabs, sketch } = await initializeStorage(
    hashAction,
    options.defaultEntries ?? [emptyDocument()],
    extractTitleFromDoc,
    (messages) => holdForModal('Error loading workspace', messages[0], messages.slice(1)),
  );

  // Do web setup that can be made independent of the hairy ball of wax
  setupDivider();

  // Set up the hairy ball of multiple-sketch-management wax
  return await setupEditorInteractions(
    emptyDocument,
    extractTitleFromDoc,
    options.createAndMountInspector,
    options.codemirrorExtensions,
    options.documentName ?? 'document',
    title,
    db,
    tabs,
    sketch,
  );
}
