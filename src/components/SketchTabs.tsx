import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
// @ts-ignore: 'React' is declared but its value is never read.
import React from 'react';

import type { TabsObject } from '../storage.js';

interface Props {
  tabs: TabsObject;
  iconSize: string;
  switchToIndex: (index: number) => void;
  deleteIndex: (index: number) => void;
  create: () => void;
  documentName: string;
}

export default function SketchTabs({
  tabs,
  switchToIndex,
  deleteIndex,
  create,
  iconSize,
  documentName,
}: Props) {
  const canClose = tabs.sketches.length > 1;
  return (
    <>
      <div className="sketchzone-current-tabs">
        {tabs.sketches.map((sketch, index) => (
          <div
            key={`${sketch.key}`}
            className={`sketchzone-tab ${index === tabs.displayedSketchIndex ? 'zone1' : 'zone2'} `}
          >
            <button
              className={canClose ? 'sketchzone-tab-left' : 'sketchzone-tab-solo'}
              aria-label="Switch to this tab"
              onClick={(event) => {
                event.preventDefault();
                switchToIndex(index);
              }}
            >
              {sketch.title}
            </button>
            {canClose && (
              <button
                className="sketchzone-tab-close"
                aria-label="Close tab"
                onClick={(event) => {
                  event.preventDefault();
                  deleteIndex(index);
                }}
              >
                <Cross2Icon />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sketchzone-tab sketchzone-tab-add">
        <button
          title={`Create a new ${documentName}`}
          onClick={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <PlusIcon width={iconSize} height={iconSize} />
        </button>
      </div>
    </>
  );
}
