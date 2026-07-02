function saveDrawingToStorage() {
  try {
    localStorage.setItem(drawingStorageKey, JSON.stringify(objects));
  } catch (error) {
    console.warn('Could not save drawing locally.', error);
  }
}

function chooseSavedProject() {
  return new Promise((resolve) => {
    projectPrompt.classList.add('open');
    projectPrompt.setAttribute('aria-hidden', 'false');
    oldProjectBtn.focus();

    const finish = (shouldRestore) => {
      projectPrompt.classList.remove('open');
      projectPrompt.setAttribute('aria-hidden', 'true');
      newProjectBtn.removeEventListener('click', startNew);
      oldProjectBtn.removeEventListener('click', openOld);
      resolve(shouldRestore);
    };

    const startNew = () => finish(false);
    const openOld = () => finish(true);

    newProjectBtn.addEventListener('click', startNew);
    oldProjectBtn.addEventListener('click', openOld);
  });
}

async function loadDrawingFromStorage() {
  try {
    const savedDrawing = localStorage.getItem(drawingStorageKey);

    if (!savedDrawing) return;

    const parsedObjects = JSON.parse(savedDrawing);

    if (!Array.isArray(parsedObjects)) return;
    if (!parsedObjects.length) return;

    const shouldRestore = await chooseSavedProject();

    if (!shouldRestore) {
      localStorage.removeItem(drawingStorageKey);
      return;
    }

    objects = parsedObjects;
    history = [clone(objects)];
    historyIndex = 0;
  } catch (error) {
    console.warn('Could not load saved drawing.', error);
  }
}
