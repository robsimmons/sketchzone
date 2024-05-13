import { EnterIcon, MagnifyingGlassIcon, ReaderIcon } from '@radix-ui/react-icons';

interface Props {
  state: 'unloaded' | 'loaded' | 'modified';
  iconSize: string;
}

export default function InspectorController({ state, iconSize }: Props) {
  return (
    <>
      <button id="sessionzone-inspector-load" title={`Load program`}>
        <EnterIcon width={iconSize} height={iconSize} />
        {state === 'unloaded'
          ? `load program`
          : state === 'loaded'
          ? `reload program`
          : `program changed! reload?`}
      </button>
      <button
        id="sessionzone-inspector-view"
        title={`View program`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('sessionzone-active-session')!.className =
            'active-session-is-showing-editor';
        }}
      >
        <ReaderIcon width={iconSize} height={iconSize} />
        view program
      </button>
      {state !== 'unloaded' && (
        <button
          id="sessionzone-inspector-inspect"
          title={`Inspect program without reloading`}
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('sessionzone-active-session')!.className =
              'active-session-is-showing-inspector';
          }}
        >
          <MagnifyingGlassIcon width={iconSize} height={iconSize} />
          inspect
        </button>
      )}
    </>
  );
}
