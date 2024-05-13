import { EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import type { DOCUMENT, SessionObject } from './storage.js';

const EDITOR_SYNC_DEBOUNCE_MS = 250;

interface ActiveSessionData<SessionData> {
  client: SessionData;
  isClientOutOfDate: boolean;
}

export default class ActiveSession<SessionData> {
  key: IDBValidKey;
  title: string;
  readonly active: true = true;
  sessionData: null | ActiveSessionData<SessionData> = null;
  codemirrorState: EditorState;

  private readonly documentCreatedAt: Date;
  documentUpdatedAt: Date;
  private persistSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private extractTitleFromDoc: (doc: DOCUMENT) => string;

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
    session: SessionObject,
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
    this.documentCreatedAt = session.createdAt;
    this.documentUpdatedAt = session.updatedAt;
    this.title = extractTitleFromDoc(session.document);
    this.key = key;
    this.extractTitleFromDoc = extractTitleFromDoc;

    this.codemirrorState = EditorState.create({
      extensions: codemirrorExtensions.concat([
        EditorView.updateListener.of((update: ViewUpdate) => {
          this.codemirrorState = update.state;
          if (update.docChanged) {
            this.documentUpdatedAt = new Date();
            if (this.sessionData !== null && !this.sessionData.isClientOutOfDate) {
              this.sessionData.isClientOutOfDate = true;
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
      doc: typeof session.document === 'string' ? session.document : '<object placeholder>',
    });
  }

  /** Called when the tab containing this ActiveSession is removed. Currently does nothing. */
  terminate() {}
}
