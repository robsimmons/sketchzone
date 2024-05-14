import { EnterIcon, MagnifyingGlassIcon, ReaderIcon } from '@radix-ui/react-icons';

interface Props {
  state: 'unloaded' | 'loaded' | 'modified';
  iconSize: string;
  onLoad: () => void;
}

export default function InspectorController({ state, iconSize, onLoad }: Props) {
  return (
    <>
      <button
        id="sketchzone-inspector-load"
        title={`Load program`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('sketchzone-active-sketch')!.className =
            'active-sketch-is-showing-inspector';
          onLoad();
        }}
      >
        <EnterIcon width={iconSize} height={iconSize} />
        {state === 'unloaded'
          ? `load program`
          : state === 'loaded'
          ? `reload program`
          : `program changed! reload?`}
      </button>
      <button
        id="sketchzone-inspector-view"
        title={`View program`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('sketchzone-active-sketch')!.className =
            'active-sketch-is-showing-editor';
        }}
      >
        <ReaderIcon width={iconSize} height={iconSize} />
        view program
      </button>
      {state !== 'unloaded' && (
        <button
          id="sketchzone-inspector-inspect"
          title={`Inspect program without reloading`}
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
