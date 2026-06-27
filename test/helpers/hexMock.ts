export function hexMock(byte: 'a' | 'b', len = 32): string {
  return byte.repeat(len * 2);
}
