import { EnterIcon, MagnifyingGlassIcon, ReaderIcon } from '@radix-ui/react-icons';
// @ts-ignore: 'React' is declared but its value is never read.
import React from 'react';

interface Props {
  state: 'unloaded' | 'loaded' | 'modified';
  iconSize: string;
  documentName: string;
  onLoad: () => void;
}

export default function InspectorController({ state, iconSize, onLoad, documentName }: Props) {
  return (
    <>
      <button
        id="sketchzone-inspector-load"
        title={`Load ${documentName}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('sketchzone-active-sketch')!.className =
            'active-sketch-is-showing-inspector';
          onLoad();
        }}
        className={state === 'modified' ? 'sketchzone-inspector-load-modified' : undefined}
      >
        <EnterIcon width={iconSize} height={iconSize} />
        {state === 'unloaded'
          ? `load ${documentName}`
          : state === 'loaded'
          ? `reload ${documentName}`
          : `${documentName} changed! reload?`}
      </button>
      <button
        id="sketchzone-inspector-view"
        title={`View ${documentName}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('sketchzone-active-sketch')!.className =
            'active-sketch-is-showing-editor';
        }}
      >
        <ReaderIcon width={iconSize} height={iconSize} />
        view {documentName}
      </button>
      {state !== 'unloaded' && (
        <button
          id="sketchzone-inspector-inspect"
          title={`Inspect without reloading`}
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('sketchzone-active-sketch')!.className =
              'active-sketch-is-showing-inspector';
          }}
        >
          <MagnifyingGlassIcon width={iconSize} height={iconSize} />
          inspect
        </button>
      )}
    </>
  );
}
