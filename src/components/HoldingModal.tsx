import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React from 'react';
import ReactDOM from 'react-dom/client';

/**
 * Use the modal root element to show a blocking, dismissible
 * error message to the user.
 *
 * @param title VisuallyHidden accessibility title for the modal
 * @param description Accessibility description of the modal
 * @param rest Additional paragraphs of text for the modal
 */
export default function holdForModal(
  title: string,
  description: string,
  rest: string[],
): Promise<void> {
  const root = document.createElement('div');
  document.getElementById('modal-root')!.appendChild(root);
  const view = ReactDOM.createRoot(root);

  return new Promise<void>((resolve) => {
    view.render(
      React.createElement(() => {
        return (
          <Dialog.Root
            open
            onOpenChange={() => {
              view.unmount();
              resolve();
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="sketchzone-dialog-overlay" />
              <Dialog.Content className="sketchzone-dialog-content">
                <VisuallyHidden asChild>
                  <Dialog.Title>{title}</Dialog.Title>
                </VisuallyHidden>
                <Dialog.Description>{description}</Dialog.Description>
                {rest.map((str, i) => (
                  <p key={i}>{str}</p>
                ))}
                <Dialog.Close>Ok</Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }),
    );
  });
}
