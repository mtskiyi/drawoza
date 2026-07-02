canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;

  hideContextMenu();

  const point = pointFromEvent(event);

  dragStart = point;

  if (tool === 'text') {
    commitTextEditor();

    const clicked = hitTest(point);

    if (clicked >= 0 && objects[clicked].type === 'text') {
      startTextEditor(point, clicked);
      focusTextEditor(true);
    } else {
      selectedIndex = -1;
      startTextEditor(point);
      resizeTextEditorFromPoint(point);
      isPlacingText = true;
      canvas.setPointerCapture(event.pointerId);
    }

    render();
    return;
  }

  canvas.setPointerCapture(event.pointerId);

  if (tool === 'select') {
    commitTextEditor();

    if (hitResizeHandle(point)) {
      isResizing = true;
      resizeStartBounds = getBounds(objects[selectedIndex]);
      resizeStartObject = clone(objects[selectedIndex]);
    } else {
      selectedIndex = hitTest(point);
      isMoving = selectedIndex >= 0;
    }

    render();
    return;
  }

  selectedIndex = -1;
  isDrawing = true;

  const settings = getSettings();

  if (tool === 'pen') {
    currentObject = {
      type: 'path',
      points: [point],
      color: settings.color,
      width: settings.width,
    };
  }

  if (tool === 'brush') {
    currentObject = {
      type: 'brush',
      points: [point],
      width: settings.width,
    };
  }

  if (tool === 'rect') {
    currentObject = {
      type: 'rect',
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
      color: settings.color,
      width: settings.width,
    };
  }

  if (tool === 'circle') {
    currentObject = {
      type: 'circle',
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
      color: settings.color,
      width: settings.width,
    };
  }

  if (tool === 'line') {
    currentObject = {
      type: 'line',
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      color: settings.color,
      width: settings.width,
    };
  }
});

canvas.addEventListener('pointermove', (event) => {
  const point = pointFromEvent(event);

  if (
    tool === 'select' &&
    !isMoving &&
    !isResizing &&
    !isDrawing &&
    !isPlacingText
  ) {
    canvas.style.cursor = hitResizeHandle(point) ? 'nwse-resize' : '';
  }

  if (isPlacingText) {
    resizeTextEditorFromPoint(point);
    return;
  }

  if (isResizing && selectedIndex >= 0 && resizeStartBounds && resizeStartObject) {
    scaleObjectFromBounds(
      objects[selectedIndex],
      resizeStartObject,
      resizeStartBounds,
      point
    );
    render();
    return;
  }

  if (isMoving && selectedIndex >= 0 && dragStart) {
    const dx = point.x - dragStart.x;
    const dy = point.y - dragStart.y;

    moveObject(objects[selectedIndex], dx, dy);

    dragStart = point;
    render();
    return;
  }

  if (!isDrawing || !currentObject || !dragStart) return;

  if (currentObject.type === 'path' || currentObject.type === 'brush') {
    const lastPoint = currentObject.points[currentObject.points.length - 1];
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);

    if (currentObject.type === 'path' || distance >= 3) {
      currentObject.points.push(point);
    }
  }

  if (currentObject.type === 'rect' || currentObject.type === 'circle') {
    currentObject.w = point.x - currentObject.x;
    currentObject.h = point.y - currentObject.y;
  }

  if (currentObject.type === 'line') {
    currentObject.x2 = point.x;
    currentObject.y2 = point.y;
  }

  render();
});

canvas.addEventListener('pointerup', (event) => {
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (isPlacingText) {
    isPlacingText = false;
    focusTextEditor();
    return;
  }

  if (isResizing) {
    isResizing = false;
    resizeStartBounds = null;
    resizeStartObject = null;
    canvas.style.cursor = '';
    saveHistory();
    render();
    return;
  }

  if (isMoving) {
    isMoving = false;
    canvas.style.cursor = '';
    saveHistory();
    return;
  }

  if (isDrawing && currentObject) {
    objects.push(currentObject);
    selectedIndex = -1;

    currentObject = null;
    isDrawing = false;

    saveHistory();
    render();
  }
});

canvas.addEventListener('dblclick', (event) => {
  const point = pointFromEvent(event);
  const index = hitTest(point);

  if (index >= 0 && objects[index].type === 'text') {
    setTool('text');
    startTextEditor(point, index);
  }
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  commitTextEditor();

  const point = pointFromEvent(event);
  const clickedIndex = hitTest(point);

  selectedIndex = clickedIndex;
  currentObject = null;
  isDrawing = false;
  isMoving = false;
  isPlacingText = false;
  isResizing = false;

  render();
  showContextMenu(event, point);
});

textEditor.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    textEditor.style.display = 'none';
    editingTextIndex = -1;
    render();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    const start = textEditor.selectionStart;
    const end = textEditor.selectionEnd;

    textEditor.value = `${textEditor.value.slice(0, start)}\n${textEditor.value.slice(end)}`;
    textEditor.selectionStart = start + 1;
    textEditor.selectionEnd = start + 1;
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    commitTextEditor();
  }
});

textEditor.addEventListener('blur', commitTextEditor);


contextMenu.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button || button.disabled) return;

  const action = button.dataset.action;
  const point = contextMenuPoint ? { ...contextMenuPoint } : null;

  hideContextMenu();

  if (action === 'copy') copySelection();
  if (action === 'cut') cutSelection();
  if (action === 'paste') pasteSelection(point);
  if (action === 'undo') undo();
  if (action === 'redo') redo();
  if (action === 'delete') deleteSelection();
});

window.addEventListener('pointerdown', (event) => {
  if (!contextMenu.contains(event.target)) {
    hideContextMenu();
  }
});

window.addEventListener('resize', hideContextMenu);
window.addEventListener('blur', hideContextMenu);

document.querySelectorAll('.tool').forEach((button) => {
  button.addEventListener('click', () => {
    setTool(button.dataset.tool);
  });
});

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

document.getElementById('zoomOut').addEventListener('click', () => {
  setZoom(zoom - zoomStep);
});

document.getElementById('zoomIn').addEventListener('click', () => {
  setZoom(zoom + zoomStep);
});

window.addEventListener('paste', (event) => {
  if (textEditor.style.display === 'block') return;

  if (copiedObject) {
    event.preventDefault();
    pasteSelection();
    return;
  }

  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith('image/'));

  if (imageItem) {
    event.preventDefault();
    importImageFile(imageItem.getAsFile());
    return;
  }
});

window.addEventListener('dragover', (event) => {
  const hasImageItem = Array.from(event.dataTransfer?.items || []).some((item) =>
    item.type.startsWith('image/')
  );
  const hasFiles = Array.from(event.dataTransfer?.types || []).includes('Files');

  if (!hasImageItem && !hasFiles) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('drop', (event) => {
  const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
    file.type.startsWith('image/')
  );

  if (!files.length) return;

  event.preventDefault();
  commitTextEditor();

  const dropPoint = pointFromEvent(event);
  const startPoint = pointInsideCanvas(dropPoint)
    ? dropPoint
    : { x: canvas.width / 2, y: canvas.height / 2 };

  files.forEach((file, index) => {
    importImageFile(file, {
      x: startPoint.x + index * 28,
      y: startPoint.y + index * 28,
    });
  });
});

window.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep));
  },
  { passive: false }
);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideContextMenu();
  }

  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;

  if (ctrl && key === 's') {
    event.preventDefault();
    savePaper().catch((error) => {
      console.error(error);
    });
    return;
  }

  if (textEditor.style.display === 'block') return;

  if (ctrl && key === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
    return;
  }

  if ((ctrl && key === 'y') || (ctrl && event.shiftKey && key === 'z')) {
    event.preventDefault();
    redo();
    return;
  }

  if (ctrl && key === 'c') {
    event.preventDefault();
    copySelection();
    return;
  }

  if (ctrl && key === 'x') {
    event.preventDefault();
    cutSelection();
    return;
  }

  if (ctrl && key === 'v' && copiedObject) {
    event.preventDefault();
    pasteSelection();
    return;
  }

  if (key === 'delete' || key === 'backspace') {
    event.preventDefault();
    deleteSelection();
    return;
  }

  if (ctrl && key === '=') {
    event.preventDefault();
    setZoom(zoom + zoomStep);
    return;
  }

  if (ctrl && key === '-') {
    event.preventDefault();
    setZoom(zoom - zoomStep);
    return;
  }

  if (key === 'v') setTool('select');
  if (key === 'p') setTool('pen');
  if (key === 'b') setTool('brush');
  if (key === 'r') setTool('rect');
  if (key === 'c') setTool('circle');
  if (key === 'l') setTool('line');
  if (key === 't') setTool('text');
});
