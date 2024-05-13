const MIN_PANE_PIXEL = 250;
let referenceSessionDividerStatus: null | {
  mouseDownX: number;
  currentDeltaX: number;
  initialCodemirrorWidth: number;
  initialInspectorWidth: number;
} = null;

function setDividerProportion(fr: number) {
  document
    .getElementById('body-root')!
    .style.setProperty(
      '--sessionzone-text-editor-panel-width',
      `minmax(${MIN_PANE_PIXEL}px, ${fr}fr)`,
    );
}

function sessionDividerMove(event: MouseEvent) {
  const { mouseDownX, initialCodemirrorWidth, initialInspectorWidth } =
    referenceSessionDividerStatus!;
  const deltaX = event.clientX - mouseDownX;
  let newCodemirrorWidth = initialCodemirrorWidth + deltaX;
  if (initialCodemirrorWidth + deltaX < MIN_PANE_PIXEL) {
    newCodemirrorWidth = MIN_PANE_PIXEL;
  } else if (initialInspectorWidth - deltaX < MIN_PANE_PIXEL) {
    newCodemirrorWidth = initialCodemirrorWidth + initialInspectorWidth - MIN_PANE_PIXEL;
  }
  document
    .getElementById('body-root')!
    .style.setProperty('--sessionzone-text-editor-panel-width', `${newCodemirrorWidth}px`);
  referenceSessionDividerStatus!.currentDeltaX = newCodemirrorWidth - initialCodemirrorWidth;
}

function sessionDividerStop() {
  window.removeEventListener('mousemove', sessionDividerMove);
  window.removeEventListener('mouseup', sessionDividerStop);
  const { currentDeltaX, initialCodemirrorWidth, initialInspectorWidth } =
    referenceSessionDividerStatus!;
  const newTextWidth = initialCodemirrorWidth + currentDeltaX;
  const newEngineWidth = initialInspectorWidth - currentDeltaX;
  setDividerProportion(newTextWidth / newEngineWidth);
  localStorage.setItem('session-divider-proportion', `${newTextWidth / newEngineWidth}`);
}

/**
 * Sets up the event handler for the sessionDivider, which will in turn manipulate the
 * page by setting --sessionzone-text-editor-panel-width on the <body> element.
 */
export default function setupSessionDivider() {
  const codemirrorRoot = document.getElementById('sessionzone-codemirror-root')!;
  const dividerRoot = document.getElementById('sessionzone-divider')!;
  const inspectorRoot = document.getElementById('sessionzone-inspector-root')!;

  let dividerProportion = parseFloat(localStorage.getItem('session-divider-proportion') ?? '1');
  if (isNaN(dividerProportion)) dividerProportion = 1;
  setDividerProportion(dividerProportion);

  dividerRoot.onmousedown = (event) => {
    event.preventDefault();
    referenceSessionDividerStatus = {
      mouseDownX: event.clientX,
      currentDeltaX: 0,
      initialCodemirrorWidth: codemirrorRoot.getBoundingClientRect().width,
      initialInspectorWidth: inspectorRoot.getBoundingClientRect().width,
    };
    window.addEventListener('mousemove', sessionDividerMove);
    window.addEventListener('mouseup', sessionDividerStop);
  };
}
