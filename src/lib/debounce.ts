export interface Debounced<F extends (...args: unknown[]) => void> {
  (...args: Parameters<F>): void;
  cancel(): void;
}

export function debounce<F extends (...args: never[]) => void>(
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
