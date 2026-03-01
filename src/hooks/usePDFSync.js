import { useCallback, useRef, useEffect } from 'react'

export function usePDFSync(viewerRefsMapRef, syncEnabled) {
  const syncingRef = useRef(false)
  const pendingRef = useRef(null)
  const rafIdRef = useRef(null)

  const syncScroll = useCallback(
    (sourceId, scrollDelta, scrollLeftDelta) => {
      if (!syncEnabled) return
      if (scrollDelta === 0 && scrollLeftDelta === 0) return

      const prev = pendingRef.current
      const accTop =
        (prev?.sourceId === sourceId ? prev.scrollDelta : 0) + scrollDelta
      const accLeft =
        (prev?.sourceId === sourceId ? prev.scrollLeftDelta : 0) +
        scrollLeftDelta
      pendingRef.current = {
        sourceId,
        scrollDelta: accTop,
        scrollLeftDelta: accLeft,
      }

      if (rafIdRef.current != null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const pending = pendingRef.current
        if (!pending) return

        const {
          sourceId: sid,
          scrollDelta: dTop,
          scrollLeftDelta: dLeft,
        } = pending
        pendingRef.current = null

        const viewerRefsMap = viewerRefsMapRef.current || {}
        Object.entries(viewerRefsMap).forEach(([id, ref]) => {
          if (id === String(sid) || !ref?.current) return
          try {
            const pos = ref.current.getScrollPosition()
            const newTop = Math.round(pos.scrollTop + dTop)
            const newLeft = Math.round(pos.scrollLeft + dLeft)
            ref.current.scrollTo(newTop, newLeft)
          } catch (error) {
            console.error(`[Sync] Error syncing scroll to viewer ${id}:`, error)
          }
        })
      })
    },
    [syncEnabled]
  )

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  // sync OFF になったら保留中の適用を破棄
  useEffect(() => {
    if (!syncEnabled) {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      pendingRef.current = null
    }
  }, [syncEnabled])

  const syncZoom = useCallback(
    (sourceId, scale) => {
      if (!syncEnabled || syncingRef.current) return

      syncingRef.current = true

      // viewerRefsMapRef.currentから最新のrefを取得（常に最新の状態を参照）
      const viewerRefsMap = viewerRefsMapRef.current || {}

      Object.entries(viewerRefsMap).forEach(([id, ref]) => {
        if (id !== String(sourceId) && ref?.current) {
          try {
            ref.current.setZoom(scale)
          } catch (error) {
            console.error('Error syncing zoom:', error)
          }
        }
      })

      setTimeout(() => {
        syncingRef.current = false
      }, 50)
    },
    [syncEnabled]
  )

  return {
    syncScroll,
    syncZoom,
  }
}
