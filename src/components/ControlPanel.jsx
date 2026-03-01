import './ControlPanel.css'

function ControlPanel({ onAddPages, syncEnabled, onToggleSync, canAdd }) {
  return (
    <div className="control-panel">
      <button
        className="add-pages-button"
        onClick={onAddPages}
        disabled={!canAdd}
        title="PDF表示スペースを追加"
      >
        add pages
      </button>
      <button
        className={`sync-button ${syncEnabled ? 'sync-on' : 'sync-off'}`}
        onClick={onToggleSync}
        title="同期を切り替え"
      >
        scroll sync {syncEnabled ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

export default ControlPanel
