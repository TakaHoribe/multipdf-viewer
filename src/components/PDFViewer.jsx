import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react'
import PDFDropZone from './PDFDropZone'
import PDFViewerToolbar from './PDFViewerToolbar'
import './PDFViewer.css'

const PDFJS_VERSION = '3.11.174'
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`
const PDFJS_DIST_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`
const PAGE_GAP = 20
const SYNC_DEBOUNCE_MS = 50
const ALIGN_DELAY_MS = 100
const DEFAULT_PAGE_HEIGHT = 1000

const isTransformCorrect = (context) => {
  const t = context.getTransform()
  return t.d >= 0 && t.a >= 0
}

const PDFViewer = forwardRef(
  (
    {
      id,
      onRemove,
      onRegisterRef,
      syncScroll,
      syncZoom,
      syncEnabled,
      onAlignToThis,
    },
    _ref
  ) => {
    const containerRef = useRef(null)
    const scrollContainerRef = useRef(null)
    const internalRef = useRef(null)
    const canvasRefs = useRef({})
    const [pdf, setPdf] = useState(null)
    const [totalPages, setTotalPages] = useState(0)
    const [pdfTitle, setPdfTitle] = useState('')
    const [currentPage, setCurrentPage] = useState(0)
    const [scale, setScale] = useState(1.0)
    const [isDragging, setIsDragging] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [, setRenderedPages] = useState(new Set())
    const renderedPagesRef = useRef(new Set()) // 最新のrenderedPagesを保持
    const isSyncingRef = useRef(false)
    const lastScrollTopRef = useRef(0)
    const lastScrollLeftRef = useRef(0)
    const pdfjsLibRef = useRef(null)
    const pageHeights = useRef({})
    const renderingPages = useRef(new Set()) // レンダリング中のページを追跡

    // PDF.js load from CDN
    useEffect(() => {
      if (window.pdfjsLib) {
        pdfjsLibRef.current = window.pdfjsLib
        return
      }

      const script = document.createElement('script')
      script.src = `${PDFJS_CDN_BASE}/pdf.min.js`
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`
        pdfjsLibRef.current = window.pdfjsLib
      }
      script.onerror = (error) => {
        console.error('[PDFViewer] Failed to load PDF.js:', error)
      }
      document.head.appendChild(script)

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }
    }, [id])

    // 親コンポーネントにrefを登録
    useEffect(() => {
      if (onRegisterRef) {
        onRegisterRef(id, internalRef)
      }
    }, [id, onRegisterRef])

    const loadPDF = async (file) => {
      if (!pdfjsLibRef.current) {
        alert('PDF.jsが読み込まれていません。ページを再読み込みしてください。')
        return
      }

      setIsLoading(true)
      try {
        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjsLibRef.current.getDocument({
          data: arrayBuffer,
          cMapUrl: `${PDFJS_DIST_BASE}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${PDFJS_DIST_BASE}/standard_fonts/`,
          useSystemFonts: true,
        })
        const pdfDoc = await loadingTask.promise
        setPdf(pdfDoc)
        setTotalPages(pdfDoc.numPages)
        setPdfTitle(file.name)
        setScale(1.0)
        setRenderedPages(new Set())
        setCurrentPage(0)
        pageHeights.current = {}
        renderingPages.current = new Set() // レンダリング中のページをリセット
        lastScrollTopRef.current = 0
        lastScrollLeftRef.current = 0
      } catch (error) {
        console.error('[PDFViewer] Error loading PDF:', error)
        alert(`PDFの読み込みに失敗しました: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    // ページをレンダリング
    const renderPage = useCallback(
      async (pageNum, force = false) => {
        if (!pdf || !pdfjsLibRef.current) return

        // 既にレンダリング中または完了している場合はスキップ（force=trueの場合は再レンダリング）
        // renderedPagesRef.currentを使用して最新の状態を参照
        if (
          !force &&
          (renderedPagesRef.current.has(pageNum) ||
            renderingPages.current.has(pageNum))
        ) {
          return
        }

        if (force && renderedPagesRef.current.has(pageNum)) {
          setRenderedPages((prev) => {
            const newSet = new Set(prev)
            newSet.delete(pageNum)
            renderedPagesRef.current = newSet
            return newSet
          })
        }

        const canvas = canvasRefs.current[pageNum]
        if (!canvas) return

        // レンダリング中としてマーク
        renderingPages.current.add(pageNum)

        try {
          const page = await pdf.getPage(pageNum)

          const viewport = page.getViewport({
            scale: scale,
            rotation: page.rotate,
          })

          // 重要: canvas.height/widthを設定するとcontextが自動的にリセットされる
          // 拡大ボタンを押した時に正しく動作するのは、このリセットが確実に実行されるため
          // 初回レンダリング時も同じように、必ずサイズを設定してcontextをリセットする
          canvas.width = viewport.width
          canvas.height = viewport.height

          // サイズ設定後、contextを取得（この時点でcontextはリセットされている）
          const context = canvas.getContext('2d', { willReadFrequently: false })

          // 念のため、明示的にtransformをリセット（上下逆転を防ぐ）
          // 単位行列を設定: (a=1, b=0, c=0, d=1, e=0, f=0)
          context.setTransform(1, 0, 0, 1, 0, 0)

          // Canvasをクリア（拡大ボタンを押した時と同じ状態にする）
          context.clearRect(0, 0, canvas.width, canvas.height)

          pageHeights.current[pageNum] = viewport.height

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          }

          // PDF.jsでレンダリング（リトライロジック付き）
          let renderSuccess = false
          let retryCount = 0
          const maxRetries = 3

          while (!renderSuccess && retryCount < maxRetries) {
            try {
              await page.render(renderContext).promise
              renderSuccess = true
            } catch (renderError) {
              retryCount++

              if (retryCount < maxRetries) {
                // リトライ前に少し待機
                await new Promise((resolve) =>
                  setTimeout(resolve, 100 * retryCount)
                )
                // Canvasを再初期化
                canvas.width = viewport.width
                canvas.height = viewport.height
                const retryContext = canvas.getContext('2d', {
                  willReadFrequently: false,
                })
                retryContext.setTransform(1, 0, 0, 1, 0, 0)
                retryContext.clearRect(0, 0, canvas.width, canvas.height)
                renderContext.canvasContext = retryContext
              } else {
                throw renderError
              }
            }
          }

          const isCorrect = isTransformCorrect(context)

          if (!isCorrect) {
            // 拡大ボタンを押した時と同じ処理: 完全にリセットして再レンダリング
            // 1. Canvasサイズを再設定（これでcontextがリセットされる）
            canvas.width = viewport.width
            canvas.height = viewport.height

            // 2. Contextを再取得
            const newContext = canvas.getContext('2d', {
              willReadFrequently: false,
            })

            // 3. Transformをリセット
            newContext.setTransform(1, 0, 0, 1, 0, 0)

            // 4. Canvasをクリア
            newContext.clearRect(0, 0, canvas.width, canvas.height)

            // 5. 再レンダリング
            const newRenderContext = {
              canvasContext: newContext,
              viewport: viewport,
            }
            await page.render(newRenderContext).promise
          }

          setRenderedPages((prev) => {
            const newSet = new Set([...prev, pageNum])
            renderedPagesRef.current = newSet
            return newSet
          })
        } catch (error) {
          console.error('[PDFViewer] Error rendering page:', error)
          // エラー時はレンダリング済みから除外して、再試行可能にする
          setRenderedPages((prev) => {
            const newSet = new Set(prev)
            newSet.delete(pageNum)
            renderedPagesRef.current = newSet
            return newSet
          })
          throw error // エラーを再スローして、呼び出し元で処理できるようにする
        } finally {
          // レンダリング完了（成功・失敗問わず）したらマークを解除
          renderingPages.current.delete(pageNum)
        }
      },
      [pdf, scale, id]
    )

    useEffect(() => {
      if (!pdf || !pdfjsLibRef.current || totalPages === 0) return

      const renderPromises = []
      for (let i = 1; i <= totalPages; i++) {
        renderPromises.push(renderPage(i).catch(() => {}))
      }
      Promise.all(renderPromises)
    }, [pdf, totalPages, id, renderPage])

    useEffect(() => {
      if (!pdf || !pdfjsLibRef.current || totalPages === 0) return

      setRenderedPages(new Set())
      renderingPages.current = new Set()
      pageHeights.current = {}

      const renderPromises = []
      for (let i = 1; i <= totalPages; i++) {
        renderPromises.push(renderPage(i, true).catch(() => {}))
      }
      Promise.all(renderPromises)
    }, [scale, pdf, totalPages, id, renderPage])

    // スクロール位置から現在のページ数を計算（表示用）
    useEffect(() => {
      if (!pdf || !scrollContainerRef.current || totalPages === 0) return

      const container = scrollContainerRef.current

      const updateCurrentPage = () => {
        const containerTop = container.scrollTop

        // 現在のページ数を計算（スクロール位置から）
        let currentPageNum = 0
        let currentTopForPage = 0
        for (let i = 1; i <= totalPages; i++) {
          const pageHeight =
            pageHeights.current[i] || DEFAULT_PAGE_HEIGHT * scale
          const pageBottom = currentTopForPage + pageHeight

          if (containerTop >= currentTopForPage && containerTop < pageBottom) {
            currentPageNum = i
            break
          }
          currentTopForPage = pageBottom + PAGE_GAP
        }
        if (currentPageNum > 0) {
          setCurrentPage(currentPageNum)
        }
      }

      container.addEventListener('scroll', updateCurrentPage, { passive: true })
      updateCurrentPage() // 初回実行

      return () => {
        container.removeEventListener('scroll', updateCurrentPage)
      }
    }, [pdf, totalPages, scale, id])

    // ドラッグ&ドロップ処理
    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isDragging) {
        setIsDragging(true)
      }
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setIsDragging(false)
      }
    }

    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const pdfFile = files.find((file) => file.type === 'application/pdf')

      if (pdfFile) {
        loadPDF(pdfFile)
      } else {
        alert('PDFファイルをドロップしてください')
      }
    }

    // sync ON になったタイミングで lastScrollRef を現在位置にリセット（sync OFF 中の移動量を蓄積しない）
    useEffect(() => {
      if (syncEnabled && scrollContainerRef.current) {
        lastScrollTopRef.current = scrollContainerRef.current.scrollTop
        lastScrollLeftRef.current = scrollContainerRef.current.scrollLeft
      }
    }, [syncEnabled])

    useEffect(() => {
      if (!pdf || !scrollContainerRef.current || !syncScroll) return

      const handleScroll = () => {
        if (!syncEnabled) return

        const currentTop = scrollContainerRef.current.scrollTop
        const currentLeft = scrollContainerRef.current.scrollLeft

        if (isSyncingRef.current) {
          lastScrollTopRef.current = currentTop
          lastScrollLeftRef.current = currentLeft
          return
        }

        const scrollDelta = currentTop - lastScrollTopRef.current
        const scrollLeftDelta = currentLeft - lastScrollLeftRef.current

        if (scrollDelta === 0 && scrollLeftDelta === 0) return

        lastScrollTopRef.current = currentTop
        lastScrollLeftRef.current = currentLeft

        if (syncScroll) {
          syncScroll(id, scrollDelta, scrollLeftDelta)
        }
      }

      const container = scrollContainerRef.current
      container.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        container.removeEventListener('scroll', handleScroll)
      }
    }, [id, syncScroll, syncEnabled, pdf])

    // ズーム同期
    const handleZoom = (newScale) => {
      if (isSyncingRef.current || !syncEnabled) {
        setScale(newScale)
        return
      }

      isSyncingRef.current = true
      setScale(newScale)
      if (syncZoom) {
        syncZoom(id, newScale)
      }
      setTimeout(() => {
        isSyncingRef.current = false
      }, SYNC_DEBOUNCE_MS)
    }

    // このページに揃える
    const handleAlignToThis = () => {
      if (!scrollContainerRef.current || !pdf) return

      const scrollTop = scrollContainerRef.current.scrollTop
      const scrollLeft = scrollContainerRef.current.scrollLeft

      if (onAlignToThis) {
        onAlignToThis(id, scrollTop, scrollLeft, scale)
      }
    }

    // 外部からの同期イベントを受け取る
    useImperativeHandle(internalRef, () => ({
      scrollTo: (scrollTop, scrollLeft) => {
        if (scrollContainerRef.current) {
          isSyncingRef.current = true
          scrollContainerRef.current.scrollTop = scrollTop
          scrollContainerRef.current.scrollLeft = scrollLeft
          lastScrollTopRef.current = scrollTop
          lastScrollLeftRef.current = scrollLeft
          setTimeout(() => {
            isSyncingRef.current = false
          }, ALIGN_DELAY_MS)
        }
      },
      setZoom: (newScale) => {
        if (!isSyncingRef.current) {
          isSyncingRef.current = true
          setScale(newScale)
          setTimeout(() => {
            isSyncingRef.current = false
          }, SYNC_DEBOUNCE_MS)
        }
      },
      getScale: () => scale,
      getScrollPosition: () => {
        if (scrollContainerRef.current) {
          return {
            scrollTop: scrollContainerRef.current.scrollTop,
            scrollLeft: scrollContainerRef.current.scrollLeft,
          }
        }
        return { scrollTop: 0, scrollLeft: 0 }
      },
    }))

    // ページコンテナの高さを計算
    const getTotalHeight = () => {
      let total = 0
      for (let i = 1; i <= totalPages; i++) {
        total +=
          (pageHeights.current[i] || DEFAULT_PAGE_HEIGHT * scale) + PAGE_GAP
      }
      return total
    }

    return (
      <div
        className={`pdf-viewer ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        ref={containerRef}
      >
        <button className="remove-button" onClick={onRemove} title="削除">
          ×
        </button>

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">読み込み中...</div>
          </div>
        )}

        {!pdf && !isLoading && <PDFDropZone />}

        {pdf && (
          <>
            <PDFViewerToolbar
              pdfTitle={pdfTitle}
              currentPage={currentPage}
              totalPages={totalPages}
              scale={scale}
              onZoom={handleZoom}
              onAlignToThis={handleAlignToThis}
            />
            <div className="pdf-scroll-container" ref={scrollContainerRef}>
              <div
                className="pdf-pages-container"
                style={{ minHeight: getTotalHeight() }}
              >
                {Array.from({ length: totalPages }, (_, i) => {
                  const pageNum = i + 1
                  return (
                    <div key={pageNum} className="pdf-page-wrapper">
                      <canvas
                        ref={(el) => {
                          if (el) {
                            canvasRefs.current[pageNum] = el
                          }
                        }}
                        className="pdf-canvas"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }
)

PDFViewer.displayName = 'PDFViewer'

export default PDFViewer
