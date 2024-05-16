# sketchzone

![Build passing](https://github.com/robsimmons/sketchzone/actions/workflows/compile.yml/badge.svg)
[![NPM Module](https://img.shields.io/npm/v/sketchzone.svg)](https://www.npmjs.com/package/sketchzone)

You want to create a little inspector for your programming language or data structure or something: your user writes some text document and you will use your "inspector" to show them something --- some JavaScript widget that will render something based on the text the user provided provided.

I talked more about the motivation behind sketchzone in [this blog post](https://typesafety.net/rob/blog/endless-sketchzone). The sketchzone package is intended to encapsulate a bunch of "price of entry" quality-of-life issues that a browser-based implementation of such a tool is going to encounter. You provide the inspector, and sketchzone provides:

- Codemirror integration for the editor
- Persistance of multiple sketches via [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- Multiple tabs
- Browse/reopen closed documents
- Sharable links using URL hashes
- A mobile-friendly mode that switches between the editor and inspector
- Light/dark mode

This is fundamentally made for an audience of one (me), but [reach out](https://social.wub.site/@simrob) if you'd like to use it yourself and run into trouble. sketchzone is currently licensed under the GPL-3 and CC-BY-NC-SA licenses (whichever you prefer), but if neither of those licenses work for you [let me know](https://social.wub.site/@simrob).

## Implementing an inspector

Your job if you're using this library is to implement the types in [impelementer-types.ts](src/implementer-types.ts). Specifically, you need to provide a function `createAndMountInspector` that takes a DOM element and a string document, creates and mounts the inspector to the given DOM element, and optionally returns an `Inspector` object.

I highly recommend using your own codemirror extensions rather than relying on the defaults:

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

## Examples

These examples are all built on Glitch as a static site that uses [Vite](https://vitejs.dev/) to roll up sessionzone's dependencies on React and Codemirror.

- [Simplest possible example](https://glitch.com/edit/#!/sketchzone-simplest?path=index.js) - deceptively simple enough, uses defaults for everything. Loading a document just displays its length.
- [Simple example](https://glitch.com/edit/#!/sketchzone-simple?path=index.js) - a better example of a basic configuration, which uses a button to show off how tabs maintain their own inspectors.
- [Simple example (react)](https://glitch.com/edit/#!/sketchzone-simple-react?path=index.jsx) - sketchzone works really well with writing a simple inspector in React. This is exactly the same as the last simple example, but built with React instead of injecting using `innerHTML` to slam a bunch of HTML into the document.

By returning an object containing 1-4 functions from the `createAndMountInspector()` function, the behavior of sketchzone can be configured to support a couple of different uses cases:

- [Using unmount() to always unload](https://glitch.com/edit/#!/sketchzone-always-unload?path=index.jsx) - the `unmount()` function is called whenever you are about to stop viewing an inspector, and in this example, we return a truthy value from the unmount() function so that sketchzone will terminate and destroy the inspector.
- [Using destroy() to reclaim resources](https://glitch.com/edit/#!/sketchzone-cleanup?path=index.jsx) - if an inspector uses resources that need to be reclaimed when the tab is closed for good, that can be done in the `destroy()` function.
- [Using reload() to stick around](https://glitch.com/edit/#!/sketchzone-reload?path=index.jsx) - the default behavior is to unmount, destroy, and re-initialize an inspector whenever the reload button is pressed. It's possible to keep the inspector around by defining `reload()`
- [Using unmount() and remount() to pause](https://glitch.com/edit/#!/sketchzone-pausing?path=index.jsx) - having `unmount()` return `true` can keep tabs that aren't open from consuming resources, but if you want to do a little bit more work to tell the inspector how to suspend itself when it's unmounted, and then resume when it's remounted, it's possible to conserve resources without deleting all the user's state.

All those examples have the same index.html file. It's also possible to change the index.html file to add custom fonts and styles. That's demonstrated on [github here](https://github.com/robsimmons/sketchzone-disco) and [deployed here](https://sketchzone.disco.typesafety.net/) with [Disco](https://letsdisco.dev/).

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
  <main id="main-root">
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
  --sketchzone-mono-font-family: 'Fira Mono', monospace;
  --sketchzone-ui-font-family: 'Fira Sans Condensed', sans-serif;
  --sketchzone-line-numbers-font-family: var(--sketchzone-mono);
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

Light and dark mode both use 10 colors. The scheme here uses [OKLCH](https://oklch.com/) to maintain a consistency of relative perceptual brightness when switching between light and dark mode, while keeping text in a range that allows light mode to have vibrant and contrasting color schemes.

```css
body {
  /**** Dark mode ****/
  /* Zone 1 is the area where config and codemirror lives */
  --sketchzone-dark-1-background: oklch(27% 0 0);
  --sketchzone-dark-1-text: oklch(67% 0 0);
  --sketchzone-dark-1-active-button-background: oklch(32% 0 0);
  --sketchzone-dark-1-active-button-text: oklch(72% 0 0);

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
