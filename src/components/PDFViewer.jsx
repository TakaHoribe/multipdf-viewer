import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import './PDFViewer.css'

const isTransformCorrect = (context) => {
  const t = context.getTransform()
  return t.d >= 0 && t.a >= 0
}

const PDFViewer = forwardRef(({ 
  id, 
  onRemove, 
  onRegisterRef, 
  syncScroll, 
  syncZoom, 
  syncEnabled,
  onAlignToThis
}, ref) => {
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
  const [renderedPages, setRenderedPages] = useState(new Set())
  const renderedPagesRef = useRef(new Set()) // 最新のrenderedPagesを保持
  const isSyncingRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const lastScrollLeftRef = useRef(0)
  const pdfjsLibRef = useRef(null)
  const pageHeights = useRef({})
  const renderingPages = useRef(new Set()) // レンダリング中のページを追跡

  // PDF.jsをCDNから読み込む
  useEffect(() => {
    console.log(`[PDFViewer ${id}] Initializing PDF.js...`)
    
    if (window.pdfjsLib) {
      console.log(`[PDFViewer ${id}] PDF.js already loaded`)
      pdfjsLibRef.current = window.pdfjsLib
      return
    }

    console.log(`[PDFViewer ${id}] Loading PDF.js from CDN...`)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    
    script.onload = () => {
      console.log(`[PDFViewer ${id}] PDF.js loaded successfully`)
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      pdfjsLibRef.current = window.pdfjsLib
      console.log(`[PDFViewer ${id}] PDF.js worker configured`)
    }
    
    script.onerror = (error) => {
      console.error(`[PDFViewer ${id}] Failed to load PDF.js:`, error)
    }
    
    document.head.appendChild(script)
    console.log(`[PDFViewer ${id}] PDF.js script tag added to head`)

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

  // PDFを読み込む
  const loadPDF = async (file) => {
    console.log(`[PDFViewer ${id}] Loading PDF file:`, file.name, file.size, 'bytes')
    
    if (!pdfjsLibRef.current) {
      console.error(`[PDFViewer ${id}] PDF.js is not loaded yet`)
      alert('PDF.jsが読み込まれていません。ページを再読み込みしてください。')
      return
    }

    setIsLoading(true)
    try {
      console.log(`[PDFViewer ${id}] Reading file as ArrayBuffer...`)
      const arrayBuffer = await file.arrayBuffer()
      console.log(`[PDFViewer ${id}] ArrayBuffer size:`, arrayBuffer.byteLength, 'bytes')
      
      console.log(`[PDFViewer ${id}] Creating PDF document...`)
      const loadingTask = pdfjsLibRef.current.getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise
      
      console.log(`[PDFViewer ${id}] PDF loaded successfully. Pages:`, pdfDoc.numPages)
      
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
      console.error(`[PDFViewer ${id}] Error loading PDF:`, error)
      console.error(`[PDFViewer ${id}] Error stack:`, error.stack)
      alert(`PDFの読み込みに失敗しました: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // ページをレンダリング
  const renderPage = useCallback(async (pageNum, force = false) => {
    if (!pdf || !pdfjsLibRef.current) return
    
    // 既にレンダリング中または完了している場合はスキップ（force=trueの場合は再レンダリング）
    // renderedPagesRef.currentを使用して最新の状態を参照
    if (!force && (renderedPagesRef.current.has(pageNum) || renderingPages.current.has(pageNum))) {
      console.log(`[PDFViewer ${id}] Page ${pageNum} render skipped (already rendered or rendering)`)
      return
    }
    
    const renderStartTime = Date.now()
    console.log(`[PDFViewer ${id}] Page ${pageNum} render started at ${new Date(renderStartTime).toISOString()}, force=${force}`)
    
    // force=trueの場合は、レンダリング済みマークを解除
    if (force && renderedPagesRef.current.has(pageNum)) {
      setRenderedPages(prev => {
        const newSet = new Set(prev)
        newSet.delete(pageNum)
        renderedPagesRef.current = newSet
        return newSet
      })
      console.log(`[PDFViewer ${id}] Page ${pageNum} rendered mark cleared (force=true)`)
    }

    const canvas = canvasRefs.current[pageNum]
    if (!canvas) {
      console.warn(`[PDFViewer ${id}] Page ${pageNum} canvas not found`)
      return
    }

    // レンダリング中としてマーク
    renderingPages.current.add(pageNum)

    try {
      const page = await pdf.getPage(pageNum)
      
      // Viewportを取得（rotation: 0で明示的に指定）
      const viewport = page.getViewport({ scale: scale, rotation: 0 })
      console.log(`[PDFViewer ${id}] Page ${pageNum} viewport: ${viewport.width}x${viewport.height}, scale=${scale}`)
      
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
        viewport: viewport
      }

      // PDF.jsでレンダリング（リトライロジック付き）
      let renderSuccess = false
      let retryCount = 0
      const maxRetries = 3
      const renderPromiseStartTime = Date.now()
      
      while (!renderSuccess && retryCount < maxRetries) {
        try {
          await page.render(renderContext).promise
          renderSuccess = true
          const renderPromiseEndTime = Date.now()
          const renderPromiseTime = renderPromiseEndTime - renderPromiseStartTime
          console.log(`[PDFViewer ${id}] Page ${pageNum} render promise completed in ${renderPromiseTime}ms`)
        } catch (renderError) {
          retryCount++
          console.warn(`[PDFViewer ${id}] Page ${pageNum} render attempt ${retryCount} failed:`, renderError)
          
          if (retryCount < maxRetries) {
            // リトライ前に少し待機
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
            // Canvasを再初期化
            canvas.width = viewport.width
            canvas.height = viewport.height
            const retryContext = canvas.getContext('2d', { willReadFrequently: false })
            retryContext.setTransform(1, 0, 0, 1, 0, 0)
            retryContext.clearRect(0, 0, canvas.width, canvas.height)
            renderContext.canvasContext = retryContext
          } else {
            throw renderError
          }
        }
      }
      
      // レンダリング後のtransformを確認（上下逆転を検出）
      const transformAfter = context.getTransform()
      const isCorrect = isTransformCorrect(context)
      
      if (!isCorrect) {
        console.error(`[PDFViewer ${id}] Page ${pageNum} transform is incorrect after render! Transform:`, transformAfter)
        
        // 拡大ボタンを押した時と同じ処理: 完全にリセットして再レンダリング
        // 1. Canvasサイズを再設定（これでcontextがリセットされる）
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        // 2. Contextを再取得
        const newContext = canvas.getContext('2d', { willReadFrequently: false })
        
        // 3. Transformをリセット
        newContext.setTransform(1, 0, 0, 1, 0, 0)
        
        // 4. Canvasをクリア
        newContext.clearRect(0, 0, canvas.width, canvas.height)
        
        // 5. 再レンダリング
        const newRenderContext = {
          canvasContext: newContext,
          viewport: viewport
        }
        await page.render(newRenderContext).promise
        
        // 再確認
        const transformAfterFix = newContext.getTransform()
        const isCorrectAfterFix = isTransformCorrect(newContext)
        
        if (!isCorrectAfterFix) {
          console.error(`[PDFViewer ${id}] Page ${pageNum} still has incorrect transform after fix attempt:`, transformAfterFix)
        } else {
          console.log(`[PDFViewer ${id}] Page ${pageNum} transform fixed successfully`)
        }
      }
      
      setRenderedPages(prev => {
        const newSet = new Set([...prev, pageNum])
        renderedPagesRef.current = newSet
        return newSet
      })
      const renderEndTime = Date.now()
      const renderTime = renderEndTime - renderStartTime
      console.log(`[PDFViewer ${id}] Page ${pageNum} rendered successfully in ${renderTime}ms`)
    } catch (error) {
      const renderEndTime = Date.now()
      const renderTime = renderEndTime - renderStartTime
      console.error(`[PDFViewer ${id}] Error rendering page ${pageNum} after ${renderTime}ms:`, error)
      // エラー時はレンダリング済みから除外して、再試行可能にする
      setRenderedPages(prev => {
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
  }, [pdf, scale, id])

  // PDF読み込み時に全ページをレンダリング（Chromeの実装を見習う）
  useEffect(() => {
    if (!pdf || !pdfjsLibRef.current || totalPages === 0) return

    console.log(`[PDFViewer ${id}] Starting to render all ${totalPages} pages`)
    const renderStartTime = Date.now()

    // 全ページを並列でレンダリング
    const renderPromises = []
    for (let i = 1; i <= totalPages; i++) {
      renderPromises.push(
        renderPage(i).catch(error => {
          console.error(`[PDFViewer ${id}] Failed to render page ${i}:`, error)
        })
      )
    }

    // すべてのレンダリングが完了するまで待機
    Promise.all(renderPromises).then(() => {
      const renderEndTime = Date.now()
      const renderTime = renderEndTime - renderStartTime
      console.log(`[PDFViewer ${id}] All ${totalPages} pages rendered in ${renderTime}ms`)
    })
  }, [pdf, totalPages, id, renderPage])

  // 拡大縮小時も全ページを再レンダリング
  useEffect(() => {
    if (!pdf || !pdfjsLibRef.current || totalPages === 0) return

    console.log(`[PDFViewer ${id}] Scale changed to ${scale}. Re-rendering all ${totalPages} pages.`)
    const renderStartTime = Date.now()

    // すべてのレンダリング済みマークを解除
    setRenderedPages(new Set())
    renderingPages.current = new Set()
    pageHeights.current = {}

    // 全ページを並列で再レンダリング
    const renderPromises = []
    for (let i = 1; i <= totalPages; i++) {
      renderPromises.push(
        renderPage(i, true).catch(error => {
          console.error(`[PDFViewer ${id}] Failed to re-render page ${i}:`, error)
        })
      )
    }

    // すべてのレンダリングが完了するまで待機
    Promise.all(renderPromises).then(() => {
      const renderEndTime = Date.now()
      const renderTime = renderEndTime - renderStartTime
      console.log(`[PDFViewer ${id}] All ${totalPages} pages re-rendered in ${renderTime}ms`)
    })
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
        const pageHeight = pageHeights.current[i] || 1000 * scale
        const pageBottom = currentTopForPage + pageHeight
        
        if (containerTop >= currentTopForPage && containerTop < pageBottom) {
          currentPageNum = i
          break
        }
        currentTopForPage = pageBottom + 20
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
    const pdfFile = files.find(file => file.type === 'application/pdf')
    
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

  // スクロール同期
  useEffect(() => {
    // PDFが読み込まれていない、またはscrollContainerが存在しない場合はスキップ
    if (!pdf || !scrollContainerRef.current || !syncScroll) {
      console.log(`[PDFViewer ${id}] Scroll sync setup skipped: pdf=${!!pdf}, scrollContainer=${!!scrollContainerRef.current}, syncScroll=${!!syncScroll}`)
      return
    }

    console.log(`[PDFViewer ${id}] Setting up scroll sync: syncEnabled=${syncEnabled}`)

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
    console.log(`[PDFViewer ${id}] Scroll sync event listener added`)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      console.log(`[PDFViewer ${id}] Scroll sync event listener removed`)
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
    }, 50)
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
        }, 100)
      }
    },
    setZoom: (newScale) => {
      if (!isSyncingRef.current) {
        isSyncingRef.current = true
        setScale(newScale)
        setTimeout(() => {
          isSyncingRef.current = false
        }, 50)
      }
    },
    getScale: () => scale,
    getScrollPosition: () => {
      if (scrollContainerRef.current) {
        return {
          scrollTop: scrollContainerRef.current.scrollTop,
          scrollLeft: scrollContainerRef.current.scrollLeft
        }
      }
      return { scrollTop: 0, scrollLeft: 0 }
    }
  }))

  // ページコンテナの高さを計算
  const getTotalHeight = () => {
    let total = 0
    for (let i = 1; i <= totalPages; i++) {
      total += (pageHeights.current[i] || 1000 * scale) + 20
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

      {!pdf && !isLoading && (
        <div className="drop-zone">
          <p>PDFファイルをドラッグ&ドロップ</p>
        </div>
      )}

      {pdf && (
        <>
          <div className="pdf-utility-bar">
            {pdfTitle && (
              <div className="pdf-title">
                {pdfTitle}
              </div>
            )}
            <div className="pdf-utility-spacer" />
            <div className="pdf-utility-center">
              {currentPage > 0 && totalPages > 0 && (
                <>
                  <div className="pdf-page-indicator">
                    {currentPage} / {totalPages}
                  </div>
                  <span className="pdf-utility-sep" />
                </>
              )}
              <div className="pdf-controls">
                <button onClick={() => handleZoom(scale - 0.1)}>−</button>
                <span>{Math.round(scale * 100)}%</span>
                <button onClick={() => handleZoom(scale + 0.1)}>+</button>
              </div>
              <span className="pdf-utility-sep" />
              <button 
                className="align-button-inline" 
                onClick={handleAlignToThis} 
                title="Align other viewers to this page"
              >
                Align to this page
              </button>
            </div>
            <div className="pdf-utility-spacer" />
          </div>
          
          <div className="pdf-scroll-container" ref={scrollContainerRef}>
            <div className="pdf-pages-container" style={{ minHeight: getTotalHeight() }}>
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1
                return (
                  <div key={pageNum} className="pdf-page-wrapper">
                    <canvas 
                      ref={el => {
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
})

PDFViewer.displayName = 'PDFViewer'

export default PDFViewer
