async function initializeApp() {
  await loadDrawingFromStorage();
  setZoom(1);
  render();
  updateUndoRedoButtons();
}

initializeApp();
