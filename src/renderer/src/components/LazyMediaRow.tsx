import { useState, useEffect, useCallback, type ReactNode } from 'react'
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

  // Initial load (and reset whenever the fetcher changes, e.g. provider switch).
  useEffect(() => {
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
  }, [fetchPage, maxItems])

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
  )
}
