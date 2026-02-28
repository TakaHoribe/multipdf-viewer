import { useCallback, useRef } from 'react'

export function usePDFSync(viewerRefsMap, syncEnabled) {
  const syncingRef = useRef(false)

  const syncScroll = useCallback((sourceId, scrollTop, scrollLeft) => {
    if (!syncEnabled || syncingRef.current) return

    syncingRef.current = true
    
    Object.entries(viewerRefsMap).forEach(([id, ref]) => {
      if (id !== String(sourceId) && ref && ref.current) {
        try {
          ref.current.scrollTo(scrollTop, scrollLeft)
        } catch (error) {
          console.error('Error syncing scroll:', error)
        }
      }
    })

    setTimeout(() => {
      syncingRef.current = false
    }, 50)
  }, [viewerRefsMap, syncEnabled])

  const syncZoom = useCallback((sourceId, scale) => {
    if (!syncEnabled || syncingRef.current) return

    syncingRef.current = true
    
    Object.entries(viewerRefsMap).forEach(([id, ref]) => {
      if (id !== String(sourceId) && ref && ref.current) {
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
  }, [viewerRefsMap, syncEnabled])

  return {
    syncScroll,
    syncZoom
  }
}
