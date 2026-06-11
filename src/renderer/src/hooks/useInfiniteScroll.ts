import { useCallback, useRef } from 'react'

interface InfiniteScrollOptions {
  hasMore: boolean
  loading: boolean
  rootMargin?: string
}

/**
 * Returns a ref callback to attach to a sentinel element at the end of a list.
 * When the sentinel scrolls within `rootMargin` of the viewport and there's
 * more to load, `onLoadMore` fires. Works inside nested scroll containers
 * because it observes intersection with the viewport, which the sentinel
 * enters as the container scrolls.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  { hasMore, loading, rootMargin = '600px' }: InfiniteScrollOptions
): (node: HTMLElement | null) => void {
  const observer = useRef<IntersectionObserver | null>(null)

  return useCallback(
    (node: HTMLElement | null) => {
      if (observer.current) observer.current.disconnect()
      if (loading || !hasMore || !node) return
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) onLoadMore()
        },
        { rootMargin }
      )
      observer.current.observe(node)
    },
    [onLoadMore, hasMore, loading, rootMargin]
  )
}
