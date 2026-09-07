import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import MediaRow from './MediaRow'
import type { TMDBMovie, TMDBTvShow, TMDBMediaItem } from '@/types'

type AnyMedia = TMDBMovie | TMDBTvShow | TMDBMediaItem

interface PageResult {
  results: AnyMedia[]
  page: number
  total_pages: number
}

interface LazyMediaRowProps {
  title: string
  Icon?: LucideIcon
  badge?: string
  ranked?: boolean
  /** Cap the number of items and disable load-more (e.g. a Top 10 row). */
  maxItems?: number
  /** Fetches one page. Changing its identity resets the row (used by the provider dropdown). */
  fetchPage: (page: number) => Promise<PageResult>
  headerRight?: ReactNode
}

export default function LazyMediaRow({
  title,
  Icon,
  badge,
  ranked,
  maxItems,
  fetchPage,
  headerRight
}: LazyMediaRowProps): JSX.Element {
  const [items, setItems] = useState<AnyMedia[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Despite the name, this row used to fetch the moment it mounted — "lazy"
  // only ever described its pagination. Home mounts a dozen of these, so the
  // page opened by firing every row's request at once. Now a row waits until
  // it is within a screen of the viewport.
  const [visible, setVisible] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) return
    const el = holderRef.current
    if (!el) return
    // No IntersectionObserver (or a detached node): fall back to loading now
    // rather than showing a row that never fills.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  // Initial load (and reset whenever the fetcher changes, e.g. provider switch).
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setItems([])
    setPage(1)
    fetchPage(1)
      .then((d) => {
        if (cancelled) return
        setItems(maxItems ? d.results.slice(0, maxItems) : d.results)
        setTotalPages(d.total_pages)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchPage, maxItems, visible])

  const loadMore = useCallback(() => {
    if (loading || maxItems || page >= totalPages) return
    const next = page + 1
    setLoading(true)
    fetchPage(next)
      .then((d) => {
        setItems((prev) => [...prev, ...d.results])
        setPage(next)
      })
      .finally(() => setLoading(false))
  }, [loading, maxItems, page, totalPages, fetchPage])

  return (
    <div ref={holderRef}>
      <MediaRow
        title={title}
        Icon={Icon}
        badge={badge}
        ranked={ranked}
        items={items}
        loading={loading}
        hasMore={!maxItems && page < totalPages}
        onLoadMore={loadMore}
        headerRight={headerRight}
      />
    </div>
  )
}
