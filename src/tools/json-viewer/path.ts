const FIRST = /[A-Za-z_$]/;
const REST = /[A-Za-z0-9_$]/;

function isSafeIdentifier(key: string): boolean {
  if (key.length === 0) return false;
  if (!FIRST.test(key[0])) return false;
  for (let i = 1; i < key.length; i++) {
    if (!REST.test(key[i])) return false;
  }
  return true;
}

export function joinObjectKey(parent: string, key: string): string {
  if (isSafeIdentifier(key)) {
    return parent ? `${parent}.${key}` : key;
  }
  const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${parent}["${escaped}"]`;
}

export function joinArrayIndex(parent: string, index: number): string {
  return `${parent}[${index}]`;
}
