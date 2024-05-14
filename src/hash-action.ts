import type { DOCUMENT } from './document.js';

/* From Jason Reed in the twelf-wasm repository */

export type UrlHashAction = { t: 'open'; document: DOCUMENT };
export type UrlGeneralAction = UrlHashAction | { t: 'getUrl'; url: string };
export type UrlHashActionWithError = UrlHashAction | { t: 'error'; msg: string };

type Base64 = { t: 'base64'; str: string };

function bytesOfString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function stringOfBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf8').decode(bytes);
}

function bytesOfBase64(base64: Base64): Uint8Array {
  const binString = atob(base64.str.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binString as any, (m: any) => m.codePointAt(0));
}

function base64OfBytes(bytes: Uint8Array): Base64 {
  const binString = String.fromCodePoint(...bytes);
  return {
    t: 'base64',
    str: btoa(binString).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''),
  };
}

async function compressedOf(bytes: Uint8Array): Promise<Uint8Array> {
  return await bytesOfStream(
    streamOfBytes(bytes).pipeThrough(new CompressionStream('deflate-raw')),
  );
}

async function decompressedOf(bytes: Uint8Array): Promise<Uint8Array> {
  return await bytesOfStream(
    streamOfBytes(bytes).pipeThrough(new DecompressionStream('deflate-raw')),
  );
}

function concatenateUint8Arrays(arrays: Uint8Array[]) {
  if (arrays.length == 0) return new Uint8Array([]);
  const totalLength = arrays.map((arr) => arr.length).reduce((a, b) => a + b);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function bytesOfStream(readableStream: ReadableStream): Promise<Uint8Array> {
  const reader = readableStream.getReader();
  let result: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return concatenateUint8Arrays(result);
}

function streamOfBytes(bytes: Uint8Array): ReadableStream {
  return new Blob([bytes]).stream();
}

async function encodeWithJsonz(action: UrlGeneralAction): Promise<string> {
  return encodeURIComponent(
    base64OfBytes(await compressedOf(bytesOfString(JSON.stringify(action)))).str,
  );
}

function validateUrlHashAction(input: any): UrlHashActionWithError {
  if (typeof input !== 'object') {
    return { t: 'error', msg: 'Expected hashAction to be an object, got a ' + typeof input };
  }
  if (!input.t) {
    return { t: 'error', msg: 'Expected hashAction to have a tag field' };
  }

  if (input.t === 'open') {
    if (typeof input.open === 'string') {
      return {
        t: 'error',
        msg: 'The document did not have the expect format (a string)',
      };
    }
    return { t: 'open', document: input.document };
  }
  return { t: 'error', msg: 'Unexpected type field in hash action: ' + input.t };
}

async function performGeneralAction(hashAction: any): Promise<UrlHashActionWithError | null> {
  if (hashAction && hashAction.t === 'getUrl' && typeof hashAction.url === 'string') {
    const response = await fetch(hashAction.url);
    const json = await response.json();
    return validateUrlHashAction(json);
  }
  return validateUrlHashAction(hashAction);
}

async function decodeWithJsonz(fragment: string): Promise<UrlHashActionWithError | null> {
  if (!fragment.matchAll(/[A-Za-z0-9\-_]*/g)) {
    return { t: 'error', msg: 'Fragment was not a valid Base64 string' };
  }

  return await performGeneralAction(
    JSON.parse(stringOfBytes(await decompressedOf(bytesOfBase64({ t: 'base64', str: fragment })))),
  );
}

async function decodeWithJson(fragment: string): Promise<UrlHashActionWithError | null> {
  if (!fragment.matchAll(/[A-Za-z0-9\-_]*/g)) {
    return { t: 'error', msg: 'Fragment was not a valid Base64 string' };
  }
  return await performGeneralAction(
    JSON.parse(atob(fragment.replaceAll('-', '+').replaceAll('_', '/'))),
  );
}

/**
 * Efficiently encodes a URL hash action
 */
export async function encodeUrlHashAction(action: UrlGeneralAction): Promise<string> {
  return '#jsonz=' + (await encodeWithJsonz(action));
}

/**
 * Decode the hash fragment for an editor
 *
 * @param hashFragment The contents of `window.location.hash`
 * @returns null if there's no hash, or if the hash doesn't include an equals sign so is
 * unlikely to be valid. Otherwise returns a hash action or error.
 */
export async function decodeUrlHashAction(
  hashFragment: string,
): Promise<UrlHashActionWithError | null> {
  const sep = hashFragment.indexOf('=');
  if (!hashFragment.startsWith('#') || sep === -1) return null;
  const key = hashFragment.slice(1, sep);
  const value = hashFragment.slice(sep + 1);
  try {
    if (key === 'program') {
      const doc = decodeURIComponent(value);
      return { t: 'open', document: doc };
    }
    if (key === 'jsonz') {
      return await decodeWithJsonz(value);
    }
    if (key === 'json') {
      return await decodeWithJson(value);
    }
    return {
      t: 'error',
      msg: `Unable to interpret the URL hash fragment '${hashFragment.slice(0, 30)}'`,
    };
  } catch (err) {
    return { t: 'error', msg: `${err}` };
  }
}
