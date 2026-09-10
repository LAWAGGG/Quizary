import { useEffect, useRef } from 'react'

export function useInfiniteScroll({ loading, loadingMore, hasMore, onLoadMore, rootMargin = '400px' }) {
  const sentinelRef = useRef(null)
  const cbRef = useRef(onLoadMore)
  cbRef.current = onLoadMore
  const stateRef = useRef({ loading, loadingMore, hasMore })
  stateRef.current = { loading, loadingMore, hasMore }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        const s = stateRef.current
        if (entries[0].isIntersecting && !s.loading && !s.loadingMore && s.hasMore) {
          cbRef.current?.()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, rootMargin])

  return sentinelRef
}
