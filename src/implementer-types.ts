import type { Extension } from '@codemirror/state';
import type { DOCUMENT } from './document.js';

export interface SetupProps {
  /**
   * Given a document, create a new Inspector instance and render it to the DOM element
   * provided.
   *
   * @param doc
   * @returns
   */
  createAndMountInspector: (elem: HTMLDivElement, doc: DOCUMENT) => Inspector | void;

  /**
   * Codemirror extensions to pass to new codemirror views. The default is
   *
   * ```javascript
   * import { EditorView, keymap, lineNumbers } from '@codemirror/view';
   * import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
   *
   * [
   *   lineNumbers(),
   *   history(),
   *   EditorView.lineWrapping,
   *   keymap.of([...defaultKeymap, ...historyKeymap]),
   * ]
   * ```
   *
   */
  codemirrorExtensions?: Extension[];

  /**
   * sketchzone follows the GraphiQL convention of pulling the tab title out of the
   * document itself, rather than having some separate UI for document names. This means
   * that the implementor needs to tell sketchzone how to parse a document just enough
   * to get a title.
   *
   * Optional: if omitted, the first line of the document is used
   *
   * @param doc
   * @returns
   */
  extractTitleFromDoc?: (doc: DOCUMENT) => string;

  /**
   * Creates a new document.
   *
   * Optional: if omitted, just creates the empty-string doc
   */
  emptyDocument?: () => DOCUMENT;

  /**
   * What should we call a document? What should the button that says "load ___" and
   * loads a document into the inspector say in that blank?
   *
   * Optional: if omitted, they're called "document"
   */
  documentName?: string;

  /**
   * What's the name of the editor? This will be used to change the page title: if you
   * put "Jibber" then a document with title "Jabber #4 THIS ONE" will cause the page
   * title to be "Jibber | Jabber #4 THIS ONE". This title get inserted into the
   * #sketchzone-logo element **if that element is non-empty**.
   *
   * Optional: if omitted, the `document.title` value will be used instead.
   */
  appName?: string;

  /**
   * If this is a brand session for sketchzone, with no saved sketches, it can be
   * confusing to look at a totally blank editor for the first time, so providing a
   * couple of template sketches is a friendly thing to do.
   *
   * Optional: if omitted, there will be a single sketch containing a new empty
   * document.
   */
  defaultEntries?: DOCUMENT[];

  /**
   * Where should the circle-question-mark button in the upper left go?
   *
   * Option: if omitted, there won't be a circle-question-mark button.
   */
  infoUrl?: string;
}

export interface Inspector {
  /**
   * Called when the "reload" button is pressed with the updated document.
   *
   * Will only be called on a mounted Inspector. If omitted, reloading will be done
   * by first calling unmount(), then calling destroy(), then calling the initial
   * `createAndMountInspector` function again.
   */
  reload?: (doc: DOCUMENT) => Promise<void>;

  /**
   * Called when we switch to another tab, so that the #sketchzone-inspector-contents
   * needs to be taken over by something else.
   *
   * If unmount returns `true`, that signals that any resources associated with this
   * inspector have been reclaimed. No additional methods on this object (including
   * destroy()) will ever be called. If the tab is re-opened, a new `Inspector`
   * object will be created.
   *
   * Will only be called on a mounted inspector, just before the element the inspector
   * is mounted to is removed from the DOM tree.
   *
   * Optional: if omitted, does nothing.
   */
  unmount?: () => Promise<boolean | void>;

  /**
   * Called when we return to a tab that had an active inspector.
   *
   * The previously active inspectors unmount() method will already have returned
   * before this method is called.
   *
   * Will only be called on an unmounted Inspector, just after the element the inspector
   * is mounted to is re-inserted into the DOM tree.
   *
   * Optional: if omitted, does nothing.
   */
  remount?: () => Promise<void>;

  /**
   * If the Inspector is keeping state around after unmounting, this function signals
   * that the relevant resources should be reclaimed. No additional methods on this
   * object will be called after destroy() is called.
   *
   * Will only be called on an unmounted Inspector.
   *
   * Optional: if omitted, does nothing.
   */
  destroy?: () => Promise<void>;
}
