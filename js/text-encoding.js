/** Unicode-safe base64 helpers (btoa/atob only support Latin-1). */

export function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

export function decodeBase64Utf8(value) {
  const binary = atob(String(value));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}
