import { EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';

import type { DOCUMENT } from './document.js';
import type { Inspector } from './implementer-types.js';
import type { SketchObject } from './storage.js';

const EDITOR_SYNC_DEBOUNCE_MS = 250;

interface ActiveSketchInspectorState {
  inspector: Inspector;
  isInspectorOutOfDate: boolean;
  root: HTMLDivElement;
}

/**
 * An ActiveSketch is a tab that has additional resources beyond what's
 * stored in the database: an active codemirrorState (that keeps stuff
 * like undo history) and any data by the currently loaded Inspector.
 */
export default class ActiveSketch {
  key: IDBValidKey;
  title: string;
  readonly active: true = true;
  inspectorState: null | ActiveSketchInspectorState = null;
  codemirrorState: EditorState;

  private readonly documentCreatedAt: Date;
  documentUpdatedAt: Date;
  private persistSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private extractTitleFromDoc: (doc: DOCUMENT) => string;
  private createAndMountInspector: (elem: HTMLDivElement, doc: DOCUMENT) => Inspector | void;

  private immediatelyRead() {
    const doc: string = this.codemirrorState.doc.toString();
    const newTitle = this.extractTitleFromDoc(doc);

    if (newTitle !== this.title) {
      this.title = newTitle;
    }
    return doc;
  }

  constructor(
    key: IDBValidKey,
    sketch: SketchObject,
    createAndMountInspector: (elem: HTMLDivElement, doc: DOCUMENT) => Inspector | void,
    codemirrorExtensions: Extension[],
    triggerRedraw: () => void,
    triggerStorage: (
      key: IDBValidKey,
      createdAt: Date,
      updatedAt: Date,
      document: DOCUMENT,
    ) => Promise<void>,
    extractTitleFromDoc: (doc: DOCUMENT) => string,
  ) {
    this.createAndMountInspector = createAndMountInspector;
    this.documentCreatedAt = sketch.createdAt;
    this.documentUpdatedAt = sketch.updatedAt;
    this.title = extractTitleFromDoc(sketch.document);
    this.key = key;
    this.extractTitleFromDoc = extractTitleFromDoc;

    this.codemirrorState = EditorState.create({
      extensions: codemirrorExtensions.concat([
        EditorView.updateListener.of((update: ViewUpdate) => {
          this.codemirrorState = update.state;
          if (update.docChanged) {
            this.documentUpdatedAt = new Date();
            if (this.inspectorState !== null && !this.inspectorState.isInspectorOutOfDate) {
              this.inspectorState.isInspectorOutOfDate = true;
            }
            if (this.persistSyncTimeout !== null) {
              clearTimeout(this.persistSyncTimeout);
            }
            this.persistSyncTimeout = setTimeout(async () => {
              this.persistSyncTimeout = null;
              await triggerStorage(
                this.key,
                this.documentCreatedAt,
                this.documentUpdatedAt,
                this.immediatelyRead(),
              );
              triggerRedraw();
            }, EDITOR_SYNC_DEBOUNCE_MS);
          }
        }),
      ]),
      doc: sketch.document,
    });
  }

  async load(doc: DOCUMENT) {
    if (this.inspectorState) {
      if (this.inspectorState.inspector.reload) {
        await this.inspectorState.inspector.reload(doc);
        return;
      } else {
        if (!(await this.inspectorState.inspector.unmount?.())) {
          await this.inspectorState.inspector.destroy?.();
        }
        this.inspectorState = null;
        document.getElementById('sketchzone-inspector-contents')!.innerHTML = '';
        // Fallthrough!
      }
    }

    const root = document.createElement('div');
    this.inspectorState = {
      isInspectorOutOfDate: false,
      inspector: this.createAndMountInspector(root, doc) ?? {},
      root,
    };
    document.getElementById('sketchzone-inspector-contents')!.appendChild(this.inspectorState.root);
  }

  async blur() {
    if (this.inspectorState) {
      if (await this.inspectorState.inspector.unmount?.()) {
        this.inspectorState = null;
      }
    }
    document.getElementById('sketchzone-inspector-contents')!.innerHTML = '';
  }

  async focus() {
    if (this.inspectorState) {
      document.getElementById('sketchzone-inspector-contents')!.append(this.inspectorState.root);
      await this.inspectorState.inspector.remount?.();
    }
  }

  async terminate() {
    if (this.inspectorState) {
      await this.inspectorState.inspector.destroy?.();
      this.inspectorState = null;
    }
  }
}
