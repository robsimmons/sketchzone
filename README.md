The `session-editor-zone` package is initially intended to encapsulate the "non-dusa" parts of the [dusa.rocks](https://dusa.rocks) editor, but also to encapsulate the fact that I seem to continually spawn [Codemirror](https://codemirror.net/)-based web editors to allow

- [Tutch](https://retutch.github.io/), a reimplementation of Andreas Abel's
- [Jaco](https://c0.surge.sh/), a reimplementation of the C0 language
- [Dusa](https://dusa.rocks/docs/), a logic programming language designed by Chris Martens and myself
- Multiple iterations of the [Twelf Live](https://jcreedcmu.github.io/twelf-wasm/) idea, the most recent of which was primarly implemented by Jason Reed
- Multiple projects that I worked on for days to years at places like Brilliant.org as the basis of internal authoring systems

Furthermore, this is a pattern that other people continuously come up with

- [Ellie](https://ellie-app.com/new) for testing out Elm
- [GraphiQL](https://github.com/graphql/graphiql) for interacting with GraphQL servers
- [MicroCeptre](https://microceptre.glitch.me/) is a bit different, because it's a structure editor and not a text editor, but it has similar vibes

But there's a high barrier to entry for doing each of these things reasonably well. If you want to make one of these things, you've got to deal with:

- Codemirror setup
- Persistent storage (so that your work doesn't disappear when your browser crashes)
- Synchronizing state between Codemirror, storage, and whatever interpreter/inspector/explorer
  you're using
- Link sharing: how will you get your examples from your computer to my computer?
- Mobile friendliness?
- Dark mode?!?!

I don't have any illusions I'm making the one true editor that everyone else is going to adopt: the goal for this project is to allow me, personally, to start my next "write some text and have some kind of interpreted inspector view" without spending any time working on a web design project that's 100% unrelated to the actual task I want to accomplish.

# Configuration

Many CSS variables attached to the `<body>` element are intended to be overwritten.

## Style

```css
body {
  --sessionzone-mono: 'Fira Mono', monospace;
  --sessionzone-ui: 'Fira Sans Condensed', sans-serif;
  --sessionzone-radius: 8px;
  --sessionzone-button-size: 2rem;
}
```

## Dimensions

```css
body {
  --sessionzone-outer-padding: 12px;
  --sessionzone-small-padding: 8px;
  --sessionzone-large-padding: 16px;
  --sessionzone-tab-bottom-padding: 10px;
  --sessionzone-fixed-padding: 16px;

  --sessionzone-outer-padding-narrow: 4px;
  --sessionzone-small-padding-narrow: 6px;
  --sessionzone-large-padding-narrow: 10px;
}
```

When the page width is narrower than 650px, a media query switches in the `-narrow` variants, as well as going from a 2-pane view showing both the text and the inspector a 1-pane view that switches between the text and the inspector.

Vertical height is determined by the following:

```
------------------------------------
| --sessionzone-outer-padding
------------------------------------ begin main rectangle
| --sessionzone-small-padding
------------------------------------
| --sessionzone-button-size
| Tab switcher buttons & Logo
------------------------------------
| --sessionzone-tab-bottom-padding
------------------------------------ begin session-specific rectangles
| --sessionzone-session-height (calculated)
------------------------------------ begin session-specific rectangles
| --sessionzone-small-padding
------------------------------------ end main rectangle
| --sessionzone-outer-padding
------------------------------------
```

## Color scheme

Light and dark mode both use 11 colors. The scheme here uses [OKLCH](https://oklch.com/) to maintain a consistency of relative perceptual brightness when switching between light and dark mode, while keeping text in a range that allows light mode to have vibrant and contrasting color schemes.

```css
body {
  /**** Dark mode ****/
  /* Zone 1 is the area where config and codemirror lives */
  --sessionzone-dark-1-background: oklch(27% 0 0);
  --sessionzone-dark-1-text: oklch(67% 0 0);
  --sessionzone-dark-1-active-button-background: oklch(32% 0 0);
  --sessionzone-dark-1-active-button-text: oklch(72% 0 0);
  --sessionzone-dark-1-hint-text: oklch(47% 0 0);

  /* Zone 2 is the area where the session tab switcher lives */
  --sessionzone-dark-2-background: oklch(37% 0 0);
  --sessionzone-dark-2-text: oklch(77% 0 0);
  --sessionzone-dark-2-active-button-background: oklch(42% 0 0);
  --sessionzone-dark-2-active-button-text: oklch(82% 0 0);

  /* Color of the modal background and drop shadows */
  --sessionzone-dark-shadow: oklch(72% 0 0);
  --sessionzone-dark-overlay: oklch(72% 0 0 / 30%);

  /**** Light mode ****/
  /* Zone 1 is the area where config and codemirror lives */
  --sessionzone-light-1-background: oklch(97% 0 0);
  --sessionzone-light-1-text: oklch(57% 0 0);
  --sessionzone-light-1-active-button-background: oklch(92% 0 0);
  --sessionzone-light-1-active-button-text: oklch(52% 0 0);
  --sessionzone-light-1-hint-text: oklch(77% 0 0);

  /* Zone 2 is the area where the session tab switcher lives */
  --sessionzone-light-2-background: oklch(87% 0 0);
  --sessionzone-light-2-text: oklch(47% 0 0);
  --sessionzone-light-2-active-button-background: oklch(82% 0 0);
  --sessionzone-light-2-active-button-text: oklch(42% 0 0);

  /* Color of the modal background and drop shadows */
  --sessionzone-light-shadow: oklch(52% 0 0);
  --sessionzone-light-overlay: oklch(52% 0 0 / 30%);
}
```
