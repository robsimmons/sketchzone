import ConfigMenu from '../src/components/Config.tsx';
import { setup } from '../src/main.js';
import ReactDOM from 'react-dom/client';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

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

const { db, restore, share } = await setup({
  extractTitleFromDoc: (document) => {
    if (typeof document !== 'string') return '<empty placeholder>';
    const firstLine = document.split('\n')[0].trim();
    if (firstLine === '') return '<unnamed>';
    return firstLine;
  },
  emptyDocument: () => '',
  codemirrorExtensions,
  defaultEntries: [lorem(1), lorem(2), lorem(3)],
  title: 'MyEd',
});

const configRoot = ReactDOM.createRoot(document.getElementById('sessionzone-config-root')!);
configRoot.render(<ConfigMenu db={db} restore={restore} share={share} />);
