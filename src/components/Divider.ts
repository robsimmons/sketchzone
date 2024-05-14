const MIN_PANE_PIXEL = 250;
let referenceDividerStatus: null | {
  mouseDownX: number;
  currentDeltaX: number;
  initialCodemirrorWidth: number;
  initialInspectorWidth: number;
} = null;

const DIVIDER_PROPORTION_KEY = 'divider-proportion';

function setDividerProportion(fr: number) {
  document
    .getElementById('body-root')!
    .style.setProperty(
      '--sketchzone-text-editor-panel-width',
      `minmax(${MIN_PANE_PIXEL}px, ${fr}fr)`,
    );
}

function onDividerMove(event: MouseEvent) {
  const { mouseDownX, initialCodemirrorWidth, initialInspectorWidth } = referenceDividerStatus!;
  const deltaX = event.clientX - mouseDownX;
  let newCodemirrorWidth = initialCodemirrorWidth + deltaX;
  if (initialCodemirrorWidth + deltaX < MIN_PANE_PIXEL) {
    newCodemirrorWidth = MIN_PANE_PIXEL;
  } else if (initialInspectorWidth - deltaX < MIN_PANE_PIXEL) {
    newCodemirrorWidth = initialCodemirrorWidth + initialInspectorWidth - MIN_PANE_PIXEL;
  }
  document
    .getElementById('body-root')!
    .style.setProperty('--sketchzone-text-editor-panel-width', `${newCodemirrorWidth}px`);
  referenceDividerStatus!.currentDeltaX = newCodemirrorWidth - initialCodemirrorWidth;
}

function onDividerStop() {
  window.removeEventListener('mousemove', onDividerMove);
  window.removeEventListener('mouseup', onDividerStop);
  const { currentDeltaX, initialCodemirrorWidth, initialInspectorWidth } = referenceDividerStatus!;
  const newTextWidth = initialCodemirrorWidth + currentDeltaX;
  const newEngineWidth = initialInspectorWidth - currentDeltaX;
  setDividerProportion(newTextWidth / newEngineWidth);
  localStorage.setItem(DIVIDER_PROPORTION_KEY, `${newTextWidth / newEngineWidth}`);
}

/**
 * Sets up the event handler for the divider, which will in turn manipulate the
 * page by setting --sketchzone-text-editor-panel-width on the <body> element.
 */
export default function setupDivider() {
  const codemirrorRoot = document.getElementById('sketchzone-codemirror-root')!;
  const dividerRoot = document.getElementById('sketchzone-divider')!;
  const inspectorRoot = document.getElementById('sketchzone-inspector-root')!;

  let dividerProportion = parseFloat(localStorage.getItem(DIVIDER_PROPORTION_KEY) ?? '1');
  if (isNaN(dividerProportion)) dividerProportion = 1;
  setDividerProportion(dividerProportion);

  dividerRoot.onmousedown = (event) => {
    event.preventDefault();
    referenceDividerStatus = {
      mouseDownX: event.clientX,
      currentDeltaX: 0,
      initialCodemirrorWidth: codemirrorRoot.getBoundingClientRect().width,
      initialInspectorWidth: inspectorRoot.getBoundingClientRect().width,
    };
    window.addEventListener('mousemove', onDividerMove);
    window.addEventListener('mouseup', onDividerStop);
  };
}
