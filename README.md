# Multi-PDF Sync Viewer

**[Try the app](https://takahoribe.github.io/multipdf-viewer/)**

A web app that displays multiple PDFs side by side with synchronized scrolling and zoom. Compare documents, review translations, or work with several PDFs at once—all in your browser.

## How it works

**Drag and drop** a PDF onto any viewer to load it. Use the **"scroll sync ON/OFF"** button at the top to toggle synchronization — when ON, scrolling and zooming in one viewer are mirrored across the others. Click **"add pages"** to add more viewers (up to 4), or **"×"** on a viewer to remove it. To jump all viewers to the same position, use **"Align to this page"** in the viewer you want to align from.

## Privacy & Security

- All processing happens in your browser
- PDFs are never uploaded or sent to any server

## Supported Browsers

Works in modern browsers (Chrome, Firefox, Safari, Edge). JavaScript must be enabled.

---

## For Developers

```bash
npm install
npm run dev    # Start dev server
npm run build  # Build for production
```

To deploy to GitHub Pages: set `base` in `vite.config.js` to match your repo path (e.g. `/your-repo-name/`), enable GitHub Actions as the Pages source, and push to `main`.
