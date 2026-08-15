import { RefObject, useLayoutEffect, useState } from 'react';

/**
 * Distance from the top of a scroll container to the top of one list inside it.
 *
 * A virtualizer measures the scroll offset against the container it scrolls,
 * not against the element the items are drawn in. That is invisible while a
 * page has one list — the two tops coincide, near enough — and wrong the moment
 * it has two: the second list still believes it starts at scroll offset zero,
 * so it renders the wrong window and leaves a blank band where its rows should
 * be. `scrollMargin` is what tells it otherwise, and this measures the value.
 *
 * The offset moves whenever anything above the list changes height, which
 * includes the first list measuring its own rows, so it is observed rather than
 * read once on mount.
 */
export const useScrollMargin = (
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): number => {
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return undefined;

    const measure = () => {
      const offset =
        contentElement.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top +
        scrollElement.scrollTop;

      // Sub-pixel churn would re-render on every scroll frame for nothing.
      setScrollMargin((current) => (Math.abs(current - offset) < 0.5 ? current : offset));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(scrollElement);
    // The scroll container's own child is what grows as rows are measured, so
    // observing the container alone would never fire.
    const scrollContent = scrollElement.firstElementChild;
    if (scrollContent) observer.observe(scrollContent);

    return () => observer.disconnect();
  }, [scrollRef, contentRef]);

  return scrollMargin;
};
