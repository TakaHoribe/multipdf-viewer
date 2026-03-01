import { useState, useRef, useEffect } from 'react'
import PDFViewer from './components/PDFViewer'
import ControlPanel from './components/ControlPanel'
import { usePDFSync } from './hooks/usePDFSync'
import './App.css'

function App() {
  const [viewers, setViewers] = useState([{ id: 1 }, { id: 2 }])
  const [syncEnabled, setSyncEnabled] = useState(true)
  const viewerRefsMap = useRef({})

  // デバッグ情報
  useEffect(() => {
    console.log('App component mounted')
    console.log('Viewers count:', viewers.length)
    console.log('Sync enabled:', syncEnabled)
  }, [viewers.length, syncEnabled])

  const { syncScroll, syncZoom } = usePDFSync(viewerRefsMap, syncEnabled)

  const addViewer = () => {
    if (viewers.length < 10) {
      const newId = Math.max(...viewers.map(v => v.id), 0) + 1
      setViewers([...viewers, { id: newId }])
    }
  }

  const removeViewer = (id) => {
    if (viewers.length > 1) {
      setViewers(viewers.filter(v => v.id !== id))
      delete viewerRefsMap.current[id]
    }
  }

  const registerViewerRef = (id, ref) => {
    viewerRefsMap.current[id] = ref
  }

  const toggleSync = () => {
    setSyncEnabled(!syncEnabled)
  }

  const alignToViewer = (sourceId, scrollTop, scrollLeft, scale) => {
    Object.entries(viewerRefsMap.current).forEach(([id, ref]) => {
      if (id !== String(sourceId) && ref && ref.current) {
        try {
          ref.current.setZoom(scale)
          setTimeout(() => {
            ref.current.scrollTo(scrollTop, scrollLeft)
          }, 100)
        } catch (error) {
          console.error('Error aligning viewer:', error)
        }
      }
    })
  }

  return (
    <div className="app">
      <div className="control-panel-wrapper">
        <ControlPanel 
          onAddPages={addViewer}
          syncEnabled={syncEnabled}
          onToggleSync={toggleSync}
          canAdd={viewers.length < 10}
        />
      </div>
      <div className="viewers-container">
        {viewers.map(viewer => (
          <PDFViewer
            key={viewer.id}
            id={viewer.id}
            onRemove={() => removeViewer(viewer.id)}
            onRegisterRef={registerViewerRef}
            syncScroll={syncScroll}
            syncZoom={syncZoom}
            syncEnabled={syncEnabled}
            onAlignToThis={alignToViewer}
          />
        ))}
      </div>
    </div>
  )
}

export default App
