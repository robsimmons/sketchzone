import ConfigMenu from '../src/components/Config.tsx';
import { setup } from '../src/main.js';
import ReactDOM from 'react-dom/client';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { Inspector } from '../src/inspector.ts';
import { DOCUMENT } from '../src/storage.ts';

const lorem = (input: number | string) =>
  `
Lorem ipsum (#${input})

Lorem ipsum dolor sit amet, consectetur adipiscing
elit, sed do eiusmod tempor incididunt ut labore
et dolore magna aliqua. Sed blandit libero
volutpat sed. Ornare arcu odio ut sem nulla
pharetra diam sit amet. Adipiscing elit duis
tristique sollicitudin nibh.

Urna nec tincidunt praesent semper feugiat. Massa
massa ultricies mi quis hendrerit dolor magna
eget. Suspendisse ultrices gravida dictum fusce ut
placerat orci nulla pellentesque. Eget arcu dictum
varius duis at consectetur lorem. Adipiscing at in
tellus integer feugiat scelerisque varius. Tempor
orci dapibus ultrices in iaculis nunc sed.
`.trim();

export const codemirrorExtensions: Extension[] = [
  lineNumbers(),
  history(),
  EditorView.lineWrapping,
  keymap.of([...defaultKeymap, ...historyKeymap]),
];

function getHTML(doc: DOCUMENT, loads: number) {
  return `<div class="sketchzone-rounded-inspector">
    <div>There is/are ${`${doc}`.split('\n').length} line(s)</div>
    <div>You've loaded this document ${loads} times</div>
  </div>`;
}
function newInspector(doc: DOCUMENT): Inspector {
  const root = document.getElementById('sketchzone-inspector-contents')!;
  let loads = 1;
  root.innerHTML = getHTML(doc, loads);

  return {
    reload: async (newDoc) => {
      loads += 1;
      doc = newDoc;
      root.innerHTML = getHTML(doc, loads);
    },
    unmount: async () => {
      root.innerHTML = '';
    },
    remount: async () => {
      root.innerHTML = getHTML(doc, loads);
    },
    destroy: async () => {},
  };
}

const { db, restore, share } = await setup({
  extractTitleFromDoc: (document) => {
    if (typeof document !== 'string') return '<empty placeholder>';
    const firstLine = document.split('\n')[0].trim();
    if (firstLine === '') return '<unnamed>';
    return firstLine;
  },
  emptyDocument: () => '',
  createAndMountInspector: newInspector,
  codemirrorExtensions,
  defaultEntries: [lorem(1), lorem(2), lorem(3)],
  title: 'MyEd',
});

const configRoot = ReactDOM.createRoot(document.getElementById('sketchzone-config-root')!);
configRoot.render(<ConfigMenu db={db} restore={restore} share={share} />);
