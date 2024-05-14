import type { DOCUMENT } from './storage.js';

export interface Inspector {
  /**
   * Called when the "reload" button is pressed with the updated document.
   * 
   * Will only be called on a mounted Inspector.
   */
  reload: (doc: DOCUMENT) => Promise<void>;

  /**
   * Called when we switch to another tab, so that the #sketchzone-inspector-contents
   * needs to be taken over by something else. This function should end by setting
   * `document.getElementById(#sketchzone-inspector-contents).innerText = ''`.
   *
   * If unmount returns `true`, that signals that any resources associated with this
   * inspector have been reclaimed. No additional methods on this object (including
   * destroy()) will ever be called, and if the tab is re-opened a new `Inspector`
   * object will be created.
   * 
   * Will only be called on a mounted inspector.
   */
  unmount: () => Promise<boolean | void>;

  /**
   * Called when we return to a tab that had an active inspector.
   *
   * The previously active inspectors unmount() method will already have been called,
   * which means that it should be the case that
   * `document.getElementById(#sketchzone-inspector-contents).innerText === ''`.
   *
   * Will only be called on an unmounted Inspector.
   */
  remount: () => Promise<void>;

  /**
   * If the Inspector is keeping state around after unmounting, this function signals
   * that the relevant resources should be reclaimed. No additional methods on this
   * object will be called.
   * 
   * Will only be called on an unmounted Inspector.
   */
  destroy: () => Promise<void>;
}
