# sketchzone

You want to create a little inspector for your programming language or data structure or something: your user writes some text document and you will use your "inspector" to show them something --- some JavaScript widget that will render something based on the text the user provided provided.

The sketchzone package is intended to encapsulate a bunch of "price of entry" quality-of-life issues that a browser-based implementation of such a tool is going to encounter. You provide the inspector, and sketchzone provides:

- Codemirror integration for the editor
- Persistance of multiple sketches via IndexedDB
- Multiple tabs
- Browse/reopen closed documents
- Sharing links using URL hashes
- A mobile-friendly mode that switches between the editor and inspector
- Light/dark mode

This is fundamentally made for an audience of one --- me --- so [reach out](https://social.wub.site/@simrob) if you'd like to use it yourself and run into trouble. sketchzone is currently licensed under the GPL-3 and CC-BY-NC-SA licenses (whichever you prefer), but if neither of those licenses work for you [let me know](https://social.wub.site/@simrob).

## Implementing an inspector

Your job if you're using this library is to implement the types in [impelementer-types.ts](src/implementer-types.ts). Specifically, you need to provide a function `createAndMountInspector` that takes a DOM element and a string document, creates and mounts the inspector to the given DOM element, and optionally returns an `Inspector` object.

I highly recommend using your own codemirror extensions rather than relying on the defaults.

```javascript
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
const codemirrorExtensions = [
  lineNumbers(),
  history(),
  EditorView.lineWrapping,
  keymap.of([...defaultKeymap, ...historyKeymap]),
];
```

- `documentName` - what should the UI call a "document" (probably `"document"` or `"program"`)
- `appName` - what do you call your app or language?
- ``

# Structure

Internally the thing the user edits is called a document, and the thing that you must define in order to use sketchzone in your project is the "inspector." These are the names that sketchzone uses to talk about itself:

```
C /-------------------------------------\
o | Tab1 x  Tab2 x  Tab3 x  Ta[+] Logo  |
n | /--------\ /----------------------\ |
f | | Editor | | Inspector controller | |
i | |        | \----------------------/ |
g | |        | /----------------------\ |
  | |        | | Inspector            | |
m | |        | |                      | |
e | |        | |                      | |
n | \--------/ \----------------------/ |
u \-------------------------------------/
```

The app assumes it has full control over the window, and that the body of the HTML document looks like this:

```html
<body id="body-root">
  <main id="main-root" class="config-menu-is-closed">
    <div id="sketchzone-config"></div>
    <div id="sketchzone-container">
      <div id="sketchzone-header">
        <div id="sketchzone-tabs"></div>
        <div id="sketchzone-logo"></div>
      </div>
      <div id="sketchzone-active-sketch">
        <div id="sketchzone-codemirror-root"></div>
        <div id="sketchzone-divider"></div>
        <div id="sketchzone-inspector-root">
          <div id="sketchzone-inspector-controller" class="zone1"></div>
          <div id="sketchzone-inspector-contents"></div>
        </div>
      </div>
    </div>
  </main>
  <div id="modal-root"></div>
</body>
```

# Configuring Style

Many CSS variables attached to the `<body>` element are intended to be modified for specific users of sketchzone.

## Style

```css
body {
  --sketchzone-mono: 'Fira Mono', monospace;
  --sketchzone-ui: 'Fira Sans Condensed', sans-serif;
  --sketchzone-radius: 8px;
  --sketchzone-button-size: 2rem;
}
```

## Dimensions

```css
body {
  --sketchzone-outer-padding: 12px;
  --sketchzone-small-padding: 8px;
  --sketchzone-large-padding: 16px;
  --sketchzone-tab-bottom-padding: 10px;
  --sketchzone-fixed-padding: 16px;

  --sketchzone-outer-padding-narrow: 4px;
  --sketchzone-small-padding-narrow: 6px;
  --sketchzone-large-padding-narrow: 10px;
}
```

When the page width is narrower than 650px, a media query switches in the `-narrow` variants, as well as going from a 2-pane view showing both the text and the inspector a 1-pane view that switches between the text and the inspector.

Vertical height is determined by the following:

```
------------------------------------
| --sketchzone-outer-padding
------------------------------------ begin main rectangle
| --sketchzone-small-padding
------------------------------------
| --sketchzone-button-size
| Tab switcher buttons & Logo
------------------------------------
| --sketchzone-tab-bottom-padding
------------------------------------ begin sketch-specific rectangles
| --sketchzone-sketch-height (calculated)
------------------------------------ begin sketch-specific rectangles
| --sketchzone-small-padding
------------------------------------ end main rectangle
| --sketchzone-outer-padding
------------------------------------
```

## Color scheme

Light and dark mode both use 11 colors. The scheme here uses [OKLCH](https://oklch.com/) to maintain a consistency of relative perceptual brightness when switching between light and dark mode, while keeping text in a range that allows light mode to have vibrant and contrasting color schemes.

```css
body {
  /**** Dark mode ****/
  /* Zone 1 is the area where config and codemirror lives */
  --sketchzone-dark-1-background: oklch(27% 0 0);
  --sketchzone-dark-1-text: oklch(67% 0 0);
  --sketchzone-dark-1-active-button-background: oklch(32% 0 0);
  --sketchzone-dark-1-active-button-text: oklch(72% 0 0);
  --sketchzone-dark-1-hint-text: oklch(47% 0 0); /* codemirror line numbers */

  /* Zone 2 is the desaturated area where the tab switcher lives */
  --sketchzone-dark-2-background: oklch(37% 0 0);
  --sketchzone-dark-2-text: oklch(77% 0 0);
  --sketchzone-dark-2-active-button-background: oklch(42% 0 0);
  --sketchzone-dark-2-active-button-text: oklch(82% 0 0);

  /* Color of the modal background and drop shadows */
  --sketchzone-dark-shadow: oklch(72% 0 0);
  --sketchzone-dark-overlay: oklch(72% 0 0 / 30%);

  /**** Light mode ****/
  /* Zone 1 is the area where config and codemirror lives */
  --sketchzone-light-1-background: oklch(97% 0 0);
  --sketchzone-light-1-text: oklch(57% 0 0);
  --sketchzone-light-1-active-button-background: oklch(92% 0 0);
  --sketchzone-light-1-active-button-text: oklch(52% 0 0);
  --sketchzone-light-1-hint-text: oklch(77% 0 0);

  /* Zone 2 is the desaturated area where the tab switcher lives */
  --sketchzone-light-2-background: oklch(87% 0 0);
  --sketchzone-light-2-text: oklch(47% 0 0);
  --sketchzone-light-2-active-button-background: oklch(82% 0 0);
  --sketchzone-light-2-active-button-text: oklch(42% 0 0);

  /* Color of the modal background and drop shadows */
  --sketchzone-light-shadow: oklch(52% 0 0);
  --sketchzone-light-overlay: oklch(52% 0 0 / 30%);
}
```
