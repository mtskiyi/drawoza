async function initializeApp() {
  await loadDrawingFromStorage();
  setZoom(getFitZoom());
  centerPaper();
  render();
  updateUndoRedoButtons();
}

initializeApp();
