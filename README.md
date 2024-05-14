The `sketchzone` package is initially intended to encapsulate the "non-dusa" parts of the [dusa.rocks](https://dusa.rocks) editor, but also a project that aims to help me out with the fact that I seem to continually spawn browser-based web editors to allow text to be edited side-by-side with some computational artifact that is in conversation with that text.

Here are a few examples, so you see what I mean:

- [Tutch](https://retutch.github.io/), a re-implementation of [Andreas Abel's Tutch](https://www2.tcs.ifi.lmu.de/~abel/tutch/)
- [Jaco](https://c0.surge.sh/), a re-implementation of the [C0 language](https://c0.cs.cmu.edu/docs/c0-reference.pdf)
- [Dusa](https://dusa.rocks/docs/), a logic programming language designed by Chris Martens and myself
- Multiple internal projects that I worked on from anywhere from a few days to a few years years at places like Brilliant.org
- Multiple iterations of the [Twelf Live](https://jcreedcmu.github.io/twelf-wasm/) idea, the most recent of which was primarly implemented by Jason Reed

Furthermore, this is a pattern that other people continuously come up with

- [Ellie](https://ellie-app.com/new) for testing out Elm
- [The p5.js editor](https://editor.p5js.org/) for testing out p5.js
- [GraphiQL](https://github.com/graphql/graphiql) for interacting with GraphQL servers
- [MicroCeptre](https://microceptre.glitch.me/) is a bit different, because it's a structure editor and not a text editor, but it has similar vibes

But there's a high barrier to entry for doing each of these things reasonably well! If you want to make one of these things, you've got to deal with:

- Text editing: you can start with a `<textarea>`, but it is unlikely to be satisfying for long
- Persistent storage (so that your work doesn't disappear when your browser crashes)
- Synchronizing state between your text editing solution, storage, and whatever interpreter/inspector/explorer you're using
- Link sharing: how will you get your examples from your computer to my computer?
- Mobile friendliness?
- Dark mode?!?!

I don't have any illusions I'm making the one true solution that everyone else is going to adopt: the goal for this project is to allow me, personally, to start my next "write some text and have some kind of interpreted inspector view" without spending any time working on a web design project that's 100% unrelated to the actual task I want to accomplish.

# Concepts

There's only one relevant word that actual end users need to understand: the name of the thing in the editor that gets loaded when one presses the button that says "load." This is currently "program" but will definitely need to be generalized. (In P5.js this would be "sketch", in a JSON viewer this would be "JSON".) Internally, this thing is called a document, and the document is edited in the editor.

The part that sketchzone doesn't define, and that you must define in order to use sketchzone in your project, is the "inspector." Documents are loaded into the inspector from the editor by the inspector controller. If you're looking at a sketchzone webpage, it looks like this:

```
C /-------------------------------------\
O | Tab1 x  Tab2 x  Tab3 x  Ta[+] Title |
N | /--------\ /----------------------\ |
F | | Editor | | Inspector controller | |
I | |        | \----------------------/ |
G | |        | /----------------------\ |
  | |        | | Inspector            | |
M | |        | |                      | |
E | |        | |                      | |
N | \--------/ \----------------------/ |
U \-------------------------------------/
```

Sketches, visually, are the combination of the editor and inspector that switch between when you switch between tabs. Sketches, as data, are document + metadata (createdAt, etc), and ActiveSketches are data sketches + the runtime state of codemirror + runtime information for the inspector...

# Configuration

Many CSS variables attached to the `<body>` element are intended to be overwritten.

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
