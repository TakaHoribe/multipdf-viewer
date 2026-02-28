import { useState, useRef } from 'react'
import PDFViewer from './components/PDFViewer'
import ControlPanel from './components/ControlPanel'
import { usePDFSync } from './hooks/usePDFSync'
import './App.css'

function App() {
  const [viewers, setViewers] = useState([{ id: 1 }, { id: 2 }, { id: 3 }])
  const [syncEnabled, setSyncEnabled] = useState(true)
  const viewerRefsMap = useRef({})

  const { syncScroll, syncZoom } = usePDFSync(viewerRefsMap.current, syncEnabled)

  const addViewer = () => {
    if (viewers.length < 4) {
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

  return (
    <div className="app">
      <ControlPanel 
        onAddPages={addViewer}
        syncEnabled={syncEnabled}
        onToggleSync={toggleSync}
        canAdd={viewers.length < 4}
      />
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
          />
        ))}
      </div>
    </div>
  )
}

export default App
