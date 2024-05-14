import { EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import type { DOCUMENT, SketchObject } from './storage.js';
import type { Inspector } from './inspector.ts';

const EDITOR_SYNC_DEBOUNCE_MS = 250;

interface ActiveSketchInspectorState {
  inspector: Inspector;
  isInspectorOutOfDate: boolean;
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
  private createAndMountInspector: (doc: DOCUMENT) => Inspector;

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
    createAndMountInspector: (doc: DOCUMENT) => Inspector,
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
      doc: typeof sketch.document === 'string' ? sketch.document : '<object placeholder>',
    });
  }

  load(doc: DOCUMENT) {
    if (this.inspectorState) {
      this.inspectorState.inspector.reload(doc);
    } else {
      this.inspectorState = {
        isInspectorOutOfDate: false,
        inspector: this.createAndMountInspector(doc),
      };
    }
  }

  async blur() {
    if (this.inspectorState) {
      if (await this.inspectorState.inspector.unmount()) {
        this.inspectorState = null;
      }
    }
  }

  async focus() {
    if (this.inspectorState) {
      await this.inspectorState.inspector.remount();
    }
  }

  async terminate() {
    if (this.inspectorState) {
      await this.inspectorState.inspector.destroy();
      this.inspectorState = null;
    }
  }
}
