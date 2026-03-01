function PDFViewerToolbar({
  pdfTitle,
  currentPage,
  totalPages,
  scale,
  onZoom,
  onAlignToThis,
}) {
  return (
    <div className="pdf-utility-bar">
      {pdfTitle && <div className="pdf-title">{pdfTitle}</div>}
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
          <button onClick={() => onZoom(scale - 0.1)}>−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => onZoom(scale + 0.1)}>+</button>
        </div>
        <span className="pdf-utility-sep" />
        <button
          className="align-button-inline"
          onClick={onAlignToThis}
          title="Align other viewers to this page"
        >
          Align to this page
        </button>
      </div>
      <div className="pdf-utility-spacer" />
    </div>
  )
}

export default PDFViewerToolbar
