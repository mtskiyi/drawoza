function saveHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(clone(objects));
  historyIndex = history.length - 1;
  saveDrawingToStorage();
  updateUndoRedoButtons();
}

function undo() {
  commitTextEditor();

  if (historyIndex <= 0) return;

  historyIndex--;
  objects = clone(history[historyIndex]);
  selectedIndex = -1;

  saveDrawingToStorage();
  render();
  updateUndoRedoButtons();
}

function redo() {
  commitTextEditor();

  if (historyIndex >= history.length - 1) return;

  historyIndex++;
  objects = clone(history[historyIndex]);
  selectedIndex = -1;

  saveDrawingToStorage();
  render();
  updateUndoRedoButtons();
}

function canUndo() {
  return historyIndex > 0;
}

function canRedo() {
  return historyIndex < history.length - 1;
}

function updateUndoRedoButtons() {
  document.getElementById('undoBtn').disabled = !canUndo();
  document.getElementById('redoBtn').disabled = !canRedo();
}

function getCachedImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);

  const image = new Image();

  image.onload = render;
  image.src = src;
  imageCache.set(src, image);

  return image;
}

function drawObject(object) {
  ctx.save();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = object.color || '#000000';
  ctx.fillStyle = object.color || '#000000';
  ctx.lineWidth = object.width || 2;

  if (object.type === 'path') {
    if (object.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(object.points[0].x, object.points[0].y);

      for (const point of object.points.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }

      ctx.stroke();
    }
  }

  if (object.type === 'brush') {
    ctx.fillStyle = '#ffffff';
    drawBrushPath(object.points, object.width || 2);
  }

  if (object.type === 'rect') {
    ctx.strokeRect(object.x, object.y, object.w, object.h);
  }

  if (object.type === 'circle') {
    ctx.beginPath();
    ctx.ellipse(
      object.x + object.w / 2,
      object.y + object.h / 2,
      Math.abs(object.w / 2),
      Math.abs(object.h / 2),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  if (object.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(object.x1, object.y1);
    ctx.lineTo(object.x2, object.y2);
    ctx.stroke();
  }

  if (object.type === 'text') {
    ctx.font = `${object.size}px ${object.font}`;
    getTextLines(object).forEach((line, index) => {
      ctx.fillText(line, object.x, object.y + index * getTextLineHeight(object));
    });
  }

  if (object.type === 'image') {
    const image = getCachedImage(object.src);

    if (image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, object.x, object.y, object.w, object.h);
    }
  }

  ctx.restore();
}

function getTextLines(object) {
  return String(object.text || '').split('\n');
}

function getTextLineHeight(object) {
  return object.size * 1.25;
}

function drawBrushPath(points, width) {
  const radius = Math.max(2, width / 2);
  const spacing = Math.max(1, radius * 0.45);

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const previous = points[i - 1];

    if (!previous) {
      drawBrushDab(point, radius);
      continue;
    }

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;

      drawBrushDab(
        {
          x: previous.x + dx * t,
          y: previous.y + dy * t,
        },
        radius
      );
    }
  }
}

function drawBrushDab(point, radius) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function getBounds(object) {
  if (object.type === 'path' || object.type === 'brush') {
    const xs = object.points.map((point) => point.x);
    const ys = object.points.map((point) => point.y);

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }

  if (object.type === 'rect' || object.type === 'circle' || object.type === 'image') {
    return {
      x: Math.min(object.x, object.x + object.w),
      y: Math.min(object.y, object.y + object.h),
      w: Math.abs(object.w),
      h: Math.abs(object.h),
    };
  }

  if (object.type === 'line') {
    return {
      x: Math.min(object.x1, object.x2),
      y: Math.min(object.y1, object.y2),
      w: Math.abs(object.x2 - object.x1),
      h: Math.abs(object.y2 - object.y1),
    };
  }

  if (object.type === 'text') {
    ctx.save();
    ctx.font = `${object.size}px ${object.font}`;
    const lines = getTextLines(object);
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
    ctx.restore();

    return {
      x: object.x,
      y: object.y - object.size,
      w: width,
      h: Math.max(object.size * 1.25, lines.length * getTextLineHeight(object)),
    };
  }

  return { x: 0, y: 0, w: 0, h: 0 };
}

function getSelectionBounds(object) {
  const bounds = getBounds(object);

  return {
    x: bounds.x - selectionPadding,
    y: bounds.y - selectionPadding,
    w: bounds.w + selectionPadding * 2,
    h: bounds.h + selectionPadding * 2,
  };
}

function getResizeHandleBounds(object) {
  const bounds = getSelectionBounds(object);

  return {
    x: bounds.x + bounds.w - resizeHandleSize / 2,
    y: bounds.y + bounds.h - resizeHandleSize / 2,
    w: resizeHandleSize,
    h: resizeHandleSize,
  };
}

function hitResizeHandle(point) {
  if (selectedIndex < 0 || !objects[selectedIndex]) return false;

  const handle = getResizeHandleBounds(objects[selectedIndex]);

  return (
    point.x >= handle.x &&
    point.x <= handle.x + handle.w &&
    point.y >= handle.y &&
    point.y <= handle.y + handle.h
  );
}

function drawSelection(index) {
  if (index < 0 || !objects[index]) return;

  const bounds = getSelectionBounds(objects[index]);
  const handle = getResizeHandleBounds(objects[index]);

  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4f46e5';

  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(handle.x, handle.y, handle.w, handle.h);
  ctx.strokeRect(handle.x, handle.y, handle.w, handle.h);

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  objects.forEach(drawObject);

  if (currentObject) {
    drawObject(currentObject);
  }

  drawSelection(selectedIndex);
}

function isSelectableObject(object) {
  return object?.type !== 'brush';
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  const x = start.x + t * dx;
  const y = start.y + t * dy;

  return Math.hypot(point.x - x, point.y - y);
}

function segmentIntersectsSegment(a, b, c, d) {
  const direction = (p1, p2, p3) =>
    (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
  const onSegment = (p1, p2, p3) =>
    Math.min(p1.x, p2.x) <= p3.x &&
    p3.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p3.y &&
    p3.y <= Math.max(p1.y, p2.y);
  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return (
    (d1 === 0 && onSegment(c, d, a)) ||
    (d2 === 0 && onSegment(c, d, b)) ||
    (d3 === 0 && onSegment(a, b, c)) ||
    (d4 === 0 && onSegment(a, b, d))
  );
}

function distanceBetweenSegments(a, b, c, d) {
  if (segmentIntersectsSegment(a, b, c, d)) return 0;

  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b)
  );
}

function pointInsideBounds(point, bounds) {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.h
  );
}

function segmentIntersectsBounds(start, end, bounds, tolerance = 0) {
  const expanded = {
    x: bounds.x - tolerance,
    y: bounds.y - tolerance,
    w: bounds.w + tolerance * 2,
    h: bounds.h + tolerance * 2,
  };
  const topLeft = { x: expanded.x, y: expanded.y };
  const topRight = { x: expanded.x + expanded.w, y: expanded.y };
  const bottomRight = { x: expanded.x + expanded.w, y: expanded.y + expanded.h };
  const bottomLeft = { x: expanded.x, y: expanded.y + expanded.h };

  return (
    pointInsideBounds(start, expanded) ||
    pointInsideBounds(end, expanded) ||
    segmentIntersectsSegment(start, end, topLeft, topRight) ||
    segmentIntersectsSegment(start, end, topRight, bottomRight) ||
    segmentIntersectsSegment(start, end, bottomRight, bottomLeft) ||
    segmentIntersectsSegment(start, end, bottomLeft, topLeft)
  );
}

function erasePathObject(object, start, end, radius) {
  const threshold = radius + (object.width || 2) / 2;
  const segments = [];
  let currentSegment = [];
  let changed = false;

  object.points.forEach((point) => {
    if (distanceToSegment(point, start, end) <= threshold) {
      changed = true;

      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }

      currentSegment = [];
      return;
    }

    currentSegment.push(point);
  });

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  if (!changed) {
    return { changed: false, objects: [object] };
  }

  return {
    changed: true,
    objects: segments.map((points) => ({
      ...object,
      points,
    })),
  };
}

function eraseObjectsAlongSegment(start, end, width) {
  const radius = Math.max(2, width / 2);
  let changed = false;
  const nextObjects = [];

  objects.forEach((object) => {
    if (object.type === 'path') {
      const result = erasePathObject(object, start, end, radius);

      changed = changed || result.changed;
      nextObjects.push(...result.objects);
      return;
    }

    if (object.type === 'brush') {
      nextObjects.push(object);
      return;
    }

    if (object.type === 'line') {
      const threshold = radius + (object.width || 2) / 2;
      const lineStart = { x: object.x1, y: object.y1 };
      const lineEnd = { x: object.x2, y: object.y2 };

      if (distanceBetweenSegments(start, end, lineStart, lineEnd) <= threshold) {
        changed = true;
        return;
      }

      nextObjects.push(object);
      return;
    }

    if (segmentIntersectsBounds(start, end, getBounds(object), radius + (object.width || 2) / 2)) {
      changed = true;
      return;
    }

    nextObjects.push(object);
  });

  if (changed) {
    objects = nextObjects;
    selectedIndex = -1;
  }

  return changed;
}

function pointHitsBrushObject(point, object) {
  const threshold = Math.max(6, (object.width || 2) / 2);

  if (object.points.length === 1) {
    return Math.hypot(point.x - object.points[0].x, point.y - object.points[0].y) <= threshold;
  }

  for (let index = 1; index < object.points.length; index++) {
    if (distanceToSegment(point, object.points[index - 1], object.points[index]) <= threshold) {
      return true;
    }
  }

  return false;
}

function hitTest(point) {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i].type === 'brush') {
      if (pointHitsBrushObject(point, objects[i])) return -1;
      continue;
    }

    if (!isSelectableObject(objects[i])) continue;

    const bounds = getBounds(objects[i]);
    const tolerance = 12;

    const inside =
      point.x >= bounds.x - tolerance &&
      point.x <= bounds.x + bounds.w + tolerance &&
      point.y >= bounds.y - tolerance &&
      point.y <= bounds.y + bounds.h + tolerance;

    if (inside) return i;
  }

  return -1;
}

function moveObject(object, dx, dy) {
  if (object.type === 'path' || object.type === 'brush') {
    object.points.forEach((point) => {
      point.x += dx;
      point.y += dy;
    });
  }

  if (
    object.type === 'rect' ||
    object.type === 'circle' ||
    object.type === 'text' ||
    object.type === 'image'
  ) {
    object.x += dx;
    object.y += dy;
  }

  if (object.type === 'line') {
    object.x1 += dx;
    object.y1 += dy;
    object.x2 += dx;
    object.y2 += dy;
  }
}

function moveObjectCenterToPoint(object, point) {
  const bounds = getBounds(object);
  const centerX = bounds.x + bounds.w / 2;
  const centerY = bounds.y + bounds.h / 2;

  moveObject(object, point.x - centerX, point.y - centerY);
}

function hideContextMenu() {
  contextMenu.classList.remove('open');
  contextMenu.setAttribute('aria-hidden', 'true');
  contextMenuPoint = null;
}

function setContextMenuButtonState() {
  contextMenu.querySelector('[data-action="copy"]').disabled = selectedIndex < 0;
  contextMenu.querySelector('[data-action="cut"]').disabled = selectedIndex < 0;
  contextMenu.querySelector('[data-action="paste"]').disabled = !copiedObject;
  contextMenu.querySelector('[data-action="undo"]').disabled = !canUndo();
  contextMenu.querySelector('[data-action="redo"]').disabled = !canRedo();
  contextMenu.querySelector('[data-action="delete"]').disabled = selectedIndex < 0;
}

function showContextMenu(event, point) {
  contextMenuPoint = point;
  setContextMenuButtonState();

  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.classList.add('open');
  contextMenu.setAttribute('aria-hidden', 'false');

  const bounds = contextMenu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - bounds.width - 8);
  const top = Math.min(event.clientY, window.innerHeight - bounds.height - 8);

  contextMenu.style.left = `${Math.max(8, left)}px`;
  contextMenu.style.top = `${Math.max(8, top)}px`;
}

function scaleObjectFromBounds(object, original, originalBounds, nextPoint) {
  const minSize = 8;
  const nextWidth = Math.max(minSize, nextPoint.x - originalBounds.x);
  const nextHeight = Math.max(minSize, nextPoint.y - originalBounds.y);
  let scaleX = nextWidth / Math.max(1, originalBounds.w);
  let scaleY = nextHeight / Math.max(1, originalBounds.h);

  if (original.type === 'image') {
    const scale = Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
  }

  if (original.type === 'path' || original.type === 'brush') {
    object.points = original.points.map((point) => ({
      x: originalBounds.x + (point.x - originalBounds.x) * scaleX,
      y: originalBounds.y + (point.y - originalBounds.y) * scaleY,
    }));
  }

  if (original.type === 'rect' || original.type === 'circle' || original.type === 'image') {
    object.x = originalBounds.x + (original.x - originalBounds.x) * scaleX;
    object.y = originalBounds.y + (original.y - originalBounds.y) * scaleY;
    object.w = original.w * scaleX;
    object.h = original.h * scaleY;
  }

  if (original.type === 'line') {
    object.x1 = originalBounds.x + (original.x1 - originalBounds.x) * scaleX;
    object.y1 = originalBounds.y + (original.y1 - originalBounds.y) * scaleY;
    object.x2 = originalBounds.x + (original.x2 - originalBounds.x) * scaleX;
    object.y2 = originalBounds.y + (original.y2 - originalBounds.y) * scaleY;
  }

  if (original.type === 'text') {
    const scale = Math.max(0.25, Math.min(scaleX, scaleY));

    object.x = originalBounds.x + (original.x - originalBounds.x) * scaleX;
    object.y = originalBounds.y + (original.y - originalBounds.y) * scale;
    object.size = Math.max(8, original.size * scale);
  }
}

function scaleImageSize(width, height) {
  const scale = Math.min(1, maxImportedImageSize / Math.max(width, height));

  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  };
}

function addImageFromSrc(src, point = { x: canvas.width / 2, y: canvas.height / 2 }) {
  const image = new Image();

  image.onload = () => {
    const size = scaleImageSize(image.naturalWidth, image.naturalHeight);
    const x = Math.min(canvas.width - size.w, Math.max(0, point.x - size.w / 2));
    const y = Math.min(canvas.height - size.h, Math.max(0, point.y - size.h / 2));

    imageCache.set(src, image);
    objects.push({
      type: 'image',
      src,
      x,
      y,
      w: size.w,
      h: size.h,
    });

    selectedIndex = -1;
    saveHistory();
    render();
  };

  image.src = src;
}

function importImageFile(file, point) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();

  reader.onload = () => {
    addImageFromSrc(reader.result, point);
  };

  reader.readAsDataURL(file);
}

function focusTextEditor(selectText = false) {
  requestAnimationFrame(() => {
    textEditor.focus();

    if (selectText) {
      textEditor.select();
    }
  });
}

function resizeTextEditorFromPoint(point) {
  if (!dragStart) return;

  const x = Math.min(dragStart.x, point.x);
  const y = Math.min(dragStart.y, point.y);
  const width = Math.max(120, Math.abs(point.x - dragStart.x));
  const height = Math.max(44, Math.abs(point.y - dragStart.y));

  textEditor.style.left = `${x}px`;
  textEditor.style.top = `${y}px`;
  textEditor.style.width = `${width}px`;
  textEditor.style.height = `${height}px`;
}

function startTextEditor(point, existingIndex = -1) {
  const settings = getSettings();
  const existing = objects[existingIndex];

  editingTextIndex = existingIndex;

  if (existing) {
    fontFamilySelect.value = existing.font;
    fontSizeInput.value = existing.size;
    colorPicker.value = existing.color;
  }

  textEditor.value = existing ? existing.text : '';
  textEditor.style.display = 'block';

  textEditor.style.left = `${existing ? existing.x : point.x}px`;
  textEditor.style.top = `${existing ? existing.y - existing.size : point.y - settings.size}px`;

  textEditor.style.fontFamily = existing ? existing.font : settings.font;
  textEditor.style.fontSize = `${existing ? existing.size : settings.size}px`;
  textEditor.style.color = existing ? existing.color : settings.color;

  textEditor.style.width = existing
    ? `${Math.max(160, getBounds(existing).w + 30)}px`
    : '180px';

  textEditor.style.height = `${Math.max(
    44,
    (existing ? existing.size : settings.size) * 1.4
  )}px`;
}

function commitTextEditor() {
  if (textEditor.style.display !== 'block') return;

  const text = textEditor.value.trim();
  const x = parseFloat(textEditor.style.left);
  const top = parseFloat(textEditor.style.top);
  const size = parseFloat(textEditor.style.fontSize);

  const object = {
    type: 'text',
    x,
    y: top + size,
    text,
    font: fontFamilySelect.value,
    size,
    color: colorPicker.value,
  };

  textEditor.style.display = 'none';

  if (!text) {
    if (editingTextIndex >= 0) {
      objects.splice(editingTextIndex, 1);
      selectedIndex = -1;
      saveHistory();
    }

    editingTextIndex = -1;
    render();
    return;
  }

  if (editingTextIndex >= 0) {
    objects[editingTextIndex] = object;
    selectedIndex = -1;
  } else {
    objects.push(object);
    selectedIndex = -1;
  }

  editingTextIndex = -1;

  saveHistory();
  render();
}

function setZoom(nextZoom) {
  const previousZoom = zoom;

  zoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));

  const previousCenter = {
    x: (canvasViewport.scrollLeft + canvasViewport.clientWidth / 2) / previousZoom,
    y: (canvasViewport.scrollTop + canvasViewport.clientHeight / 2) / previousZoom,
  };

  paperStage.style.width = `${canvas.width * zoom}px`;
  paperStage.style.height = `${canvas.height * zoom}px`;
  paperWrap.style.transform = `scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;

  if (updatePaperPlacement()) {
    return;
  }

  requestAnimationFrame(() => {
    canvasViewport.scrollLeft =
      previousCenter.x * zoom - canvasViewport.clientWidth / 2;
    canvasViewport.scrollTop =
      previousCenter.y * zoom - canvasViewport.clientHeight / 2;
  });
}

function getViewportContentSize() {
  const viewportWidth = canvasViewport.clientWidth || window.innerWidth;
  const viewportHeight = canvasViewport.clientHeight || window.innerHeight;
  const style = getComputedStyle(canvasViewport);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  return {
    width: Math.max(1, viewportWidth - horizontalPadding),
    height: Math.max(1, viewportHeight - verticalPadding),
  };
}

function updatePaperPlacement() {
  const contentSize = getViewportContentSize();
  const paperFits =
    canvas.width * zoom <= contentSize.width &&
    canvas.height * zoom <= contentSize.height;

  canvasViewport.classList.toggle('paper-centered', paperFits);

  if (paperFits) {
    canvasViewport.scrollLeft = 0;
    canvasViewport.scrollTop = 0;
  }

  return paperFits;
}

function getFitZoom() {
  const availableSize = getViewportContentSize();

  return Math.min(
    1,
    Math.max(
      minZoom,
      Math.min(availableSize.width / canvas.width, availableSize.height / canvas.height)
    )
  );
}

function centerPaper() {
  if (updatePaperPlacement()) return;

  requestAnimationFrame(() => {
    canvasViewport.scrollLeft =
      (paperStage.offsetWidth - canvasViewport.clientWidth) / 2;
    canvasViewport.scrollTop =
      (paperStage.offsetHeight - canvasViewport.clientHeight) / 2;
  });
}

function getTouchGestureState() {
  const points = Array.from(activeTouchPointers.values());

  if (points.length < 2) return null;

  const [first, second] = points;
  const center = {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };

  return {
    center,
    distance: Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY
    ),
  };
}

function cancelCanvasInteraction() {
  activeTouchPointers.forEach((_, pointerId) => {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  });

  currentObject = null;
  isDrawing = false;
  isMoving = false;
  isPlacingText = false;
  isResizing = false;
  resizeStartBounds = null;
  resizeStartObject = null;
  dragStart = null;
  eraseChanged = false;
  canvas.style.cursor = '';
  render();
}

function beginViewportGesture() {
  const gestureState = getTouchGestureState();

  if (!gestureState) return;

  canvasViewport.classList.add('is-gesturing');
  commitTextEditor();
  hideContextMenu();
  cancelCanvasInteraction();

  viewportGesture = {
    ...gestureState,
    zoom,
    scrollLeft: canvasViewport.scrollLeft,
    scrollTop: canvasViewport.scrollTop,
  };
}

function updateViewportGesture() {
  if (!viewportGesture) return false;

  const gestureState = getTouchGestureState();

  if (!gestureState) return false;

  const startDistance = Math.max(1, viewportGesture.distance);
  const nextZoom = viewportGesture.zoom * (gestureState.distance / startDistance);
  const rect = canvasViewport.getBoundingClientRect();
  const focusX =
    (viewportGesture.scrollLeft + viewportGesture.center.x - rect.left) /
    viewportGesture.zoom;
  const focusY =
    (viewportGesture.scrollTop + viewportGesture.center.y - rect.top) /
    viewportGesture.zoom;
  const centerDx = gestureState.center.x - viewportGesture.center.x;
  const centerDy = gestureState.center.y - viewportGesture.center.y;

  zoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));
  paperStage.style.width = `${canvas.width * zoom}px`;
  paperStage.style.height = `${canvas.height * zoom}px`;
  paperWrap.style.transform = `scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;

  if (updatePaperPlacement()) {
    return true;
  }

  canvasViewport.scrollLeft =
    focusX * zoom - (viewportGesture.center.x - rect.left) - centerDx;
  canvasViewport.scrollTop =
    focusY * zoom - (viewportGesture.center.y - rect.top) - centerDy;

  return true;
}

function endViewportGesture() {
  viewportGesture = null;
  canvasViewport.classList.remove('is-gesturing');
}

function copySelection() {
  if (selectedIndex < 0 || !isSelectableObject(objects[selectedIndex])) return;

  copiedObject = clone(objects[selectedIndex]);
}

function cutSelection() {
  if (selectedIndex < 0 || !isSelectableObject(objects[selectedIndex])) return;

  copiedObject = clone(objects[selectedIndex]);
  objects.splice(selectedIndex, 1);
  selectedIndex = -1;

  saveHistory();
  render();
}

function pasteSelection(point = null) {
  if (!copiedObject) return;

  const pasted = clone(copiedObject);

  if (point) {
    moveObjectCenterToPoint(pasted, point);
  } else {
    moveObject(pasted, 30, 30);
  }

  objects.push(pasted);
  selectedIndex = objects.length - 1;
  copiedObject = clone(pasted);

  saveHistory();
  render();
}

function deleteSelection() {
  if (selectedIndex < 0 || !isSelectableObject(objects[selectedIndex])) return;

  objects.splice(selectedIndex, 1);
  selectedIndex = -1;

  saveHistory();
  render();
}

function canvasToBlob() {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

async function savePaper() {
  commitTextEditor();

  const previousSelectedIndex = selectedIndex;
  selectedIndex = -1;
  render();

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `drawoza-${timestamp}.png`;
    let fileHandle = null;

    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'PNG image',
              accept: { 'image/png': ['.png'] },
            },
          ],
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }
      }
    }

    const blob = await canvasToBlob();

    if (!blob) {
      return;
    }

    if (fileHandle) {
      const writable = await fileHandle.createWritable();

      await writable.write(blob);
      await writable.close();
      return;
    }

    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      throw error;
    }
  } finally {
    selectedIndex = previousSelectedIndex;
    render();
  }
}
