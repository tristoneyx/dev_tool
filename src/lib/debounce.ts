// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Debounced<F extends (...args: any[]) => void> {
  (...args: Parameters<F>): void;
  cancel(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<F extends (...args: any[]) => void>(
  fn: F,
  waitMs: number,
): Debounced<F> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<F> | null = null;

  const debounced = ((...args: Parameters<F>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }, waitMs);
  }) as Debounced<F>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}
