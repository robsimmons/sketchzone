/* From Jason Reed in the twelf-wasm repository */

export type UrlHashAction<Doc> = { t: 'open'; document: Doc };
export type UrlGeneralAction<Doc> = UrlHashAction<Doc> | { t: 'getUrl'; url: string };
export type UrlHashActionWithError<Doc> = UrlHashAction<Doc> | { t: 'error'; msg: string };

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

async function encodeWithJsonz<Doc>(action: UrlGeneralAction<Doc>): Promise<string> {
  return encodeURIComponent(
    base64OfBytes(await compressedOf(bytesOfString(JSON.stringify(action)))).str,
  );
}

function validateUrlHashAction<Doc>(
  input: any,
  validateDoc?: (blob: any) => null | string,
): UrlHashActionWithError<Doc> {
  if (typeof input !== 'object') {
    return { t: 'error', msg: 'Expected hashAction to be an object, got a ' + typeof input };
  }
  if (!input.t) {
    return { t: 'error', msg: 'Expected hashAction to have a tag field' };
  }

  if (input.t === 'open') {
    const docValidationErrorMsg = validateDoc && validateDoc(input.document);
    if (docValidationErrorMsg) {
      return {
        t: 'error',
        msg: docValidationErrorMsg,
      };
    }
    return { t: 'open', document: input.document as Doc };
  }
  return { t: 'error', msg: 'Unexpected type field in hash action: ' + input.t };
}

async function performGeneralAction<Doc>(
  hashAction: any,
  validateDoc?: (blob: any) => null | string,
): Promise<UrlHashActionWithError<Doc> | null> {
  if (hashAction && hashAction.t === 'getUrl' && typeof hashAction.url === 'string') {
    const response = await fetch(hashAction.url);
    const json = await response.json();
    return validateUrlHashAction(json, validateDoc);
  }
  return validateUrlHashAction(hashAction, validateDoc);
}

async function decodeWithJsonz<Doc>(
  fragment: string,
  validateDoc?: (blob: any) => null | string,
): Promise<UrlHashActionWithError<Doc> | null> {
  if (!fragment.matchAll(/[A-Za-z0-9\-_]*/g)) {
    return { t: 'error', msg: 'Fragment was not a valid Base64 string' };
  }

  return await performGeneralAction(
    JSON.parse(stringOfBytes(await decompressedOf(bytesOfBase64({ t: 'base64', str: fragment })))),
    validateDoc,
  );
}

async function decodeWithJson<Doc>(
  fragment: string,
  validateDoc?: (blob: any) => null | string,
): Promise<UrlHashActionWithError<Doc> | null> {
  if (!fragment.matchAll(/[A-Za-z0-9\-_]*/g)) {
    return { t: 'error', msg: 'Fragment was not a valid Base64 string' };
  }
  return await performGeneralAction(
    JSON.parse(atob(fragment.replaceAll('-', '+').replaceAll('_', '/'))),
    validateDoc,
  );
}

/**
 * Efficiently encodes a URL hash action
 */
export async function encodeUrlHashAction<Doc>(action: UrlGeneralAction<Doc>): Promise<string> {
  return '#jsonz=' + (await encodeWithJsonz(action));
}

/**
 * Decode the hash fragment for an editor
 *
 * @param hashFragment The contents of `window.location.hash`
 * @param validateDoc An optional validation function that makes sure the document has
 * the expected form of a Doc. Otherwise we'll just assume.
 * @returns null if there's no hash, or if the hash doesn't include an equals sign so is
 * unlikely to be valid. Otherwise returns a hash action or error.
 */
export async function decodeUrlHashAction<Doc>(
  hashFragment: string,
  validateDoc?: (blob: any) => null | string,
): Promise<UrlHashActionWithError<Doc> | null> {
  const sep = hashFragment.indexOf('=');
  if (!hashFragment.startsWith('#') || sep === -1) return null;
  const key = hashFragment.slice(1, sep);
  const value = hashFragment.slice(sep + 1);
  try {
    if (key === 'program') {
      const doc = decodeURIComponent(value);
      const docValidationErrorMsg = validateDoc && validateDoc(doc);
      if (docValidationErrorMsg) {
        return {
          t: 'error',
          msg: docValidationErrorMsg,
        };
      }
      return { t: 'open', document: doc as Doc };
    }
    if (key === 'jsonz') {
      return await decodeWithJsonz(value, validateDoc);
    }
    if (key === 'json') {
      return await decodeWithJson(value, validateDoc);
    }
    return {
      t: 'error',
      msg: `Unable to interpret the URL hash fragment '${hashFragment.slice(0, 30)}'`,
    };
  } catch (err) {
    return { t: 'error', msg: `${err}` };
  }
}
