import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import './PDFViewer.css'

const PDFViewer = forwardRef(({ 
  id, 
  onRemove, 
  onRegisterRef, 
  syncScroll, 
  syncZoom, 
  syncEnabled 
}, ref) => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const internalRef = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isSyncingRef = useRef(false)
  const pdfjsLibRef = useRef(null)

  // PDF.jsをCDNから読み込む
  useEffect(() => {
    if (window.pdfjsLib) {
      pdfjsLibRef.current = window.pdfjsLib
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      pdfjsLibRef.current = window.pdfjsLib
    }
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  // 親コンポーネントにrefを登録
  useEffect(() => {
    if (onRegisterRef) {
      onRegisterRef(id, internalRef)
    }
  }, [id, onRegisterRef])

  // PDFを読み込む
  const loadPDF = async (file) => {
    if (!pdfjsLibRef.current) {
      console.error('PDF.js is not loaded yet')
      return
    }

    setIsLoading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLibRef.current.getDocument({ data: arrayBuffer })
      const pdfDoc = await loadingTask.promise
      
      setPdf(pdfDoc)
      setTotalPages(pdfDoc.numPages)
      setCurrentPage(1)
      setScale(1.0)
    } catch (error) {
      console.error('Error loading PDF:', error)
      alert('PDFの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // ページをレンダリング
  useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current || !pdfjsLibRef.current) return

      try {
        const page = await pdf.getPage(currentPage)
        const viewport = page.getViewport({ scale: scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        await page.render(renderContext).promise
      } catch (error) {
        console.error('Error rendering page:', error)
      }
    }

    if (pdf && currentPage) {
      renderPage()
    }
  }, [pdf, currentPage, scale])

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

  // スクロール同期
  useEffect(() => {
    if (!scrollContainerRef.current || !syncScroll) return

    const handleScroll = (e) => {
      if (isSyncingRef.current || !syncEnabled) return
      
      isSyncingRef.current = true
      syncScroll(id, scrollContainerRef.current.scrollTop, scrollContainerRef.current.scrollLeft)
      setTimeout(() => {
        isSyncingRef.current = false
      }, 50)
    }

    const container = scrollContainerRef.current
    container.addEventListener('scroll', handleScroll)

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [id, syncScroll, syncEnabled])

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

  // 外部からの同期イベントを受け取る
  useImperativeHandle(internalRef, () => ({
    scrollTo: (scrollTop, scrollLeft) => {
      if (scrollContainerRef.current && !isSyncingRef.current) {
        isSyncingRef.current = true
        scrollContainerRef.current.scrollTop = scrollTop
        scrollContainerRef.current.scrollLeft = scrollLeft
        setTimeout(() => {
          isSyncingRef.current = false
        }, 50)
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

  return (
    <div 
      className={`pdf-viewer ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={containerRef}
    >
      <button className="remove-button" onClick={onRemove} title="削除">
        −
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
          <div className="pdf-controls">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              ←
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              →
            </button>
            <button onClick={() => handleZoom(scale - 0.1)}>−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => handleZoom(scale + 0.1)}>+</button>
          </div>
          
          <div className="pdf-scroll-container" ref={scrollContainerRef}>
            <canvas ref={canvasRef} className="pdf-canvas"></canvas>
          </div>
        </>
      )}
    </div>
  )
})

PDFViewer.displayName = 'PDFViewer'

export default PDFViewer
