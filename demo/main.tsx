import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

import { DOCUMENT, Inspector, setup } from '../src/main.js';

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

function getHTML(doc: DOCUMENT, loads: number) {
  return `<div class="sketchzone-rounded-inspector">
    <div>There is/are ${`${doc}`.split('\n').length} line(s)</div>
    <div>You've loaded this document ${loads} times</div>
  </div>`;
}

function createAndMountInspector(root: HTMLDivElement, doc: DOCUMENT): Inspector {
  let loads = 1;
  root.innerHTML = getHTML(doc, loads);

  return {
    reload: async () => {
      loads += 1;
      root.innerHTML = getHTML(doc, loads);
    },
  };
}

await setup({
  createAndMountInspector,
  codemirrorExtensions: [
    lineNumbers(),
    history(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap]),
  ],
  defaultEntries: [lorem(1), lorem(2), lorem(3)],
  appName: 'sketchzone',
  infoUrl: 'https://github.com/robsimmons/sketchzone/',
});
