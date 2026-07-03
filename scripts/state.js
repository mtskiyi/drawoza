const canvas = document.getElementById('paper');
const ctx = canvas.getContext('2d');

const canvasViewport = document.getElementById('canvasViewport');
const paperStage = document.getElementById('paperStage');
const paperWrap = document.getElementById('paperWrap');
const textEditor = document.getElementById('textEditor');
const toolbar = document.querySelector('.toolbar');
const contextMenu = document.getElementById('contextMenu');
const projectPrompt = document.getElementById('projectPrompt');
const newProjectBtn = document.getElementById('newProjectBtn');
const oldProjectBtn = document.getElementById('oldProjectBtn');

const colorPicker = document.getElementById('colorPicker');
const strokeWidthInput = document.getElementById('strokeWidth');
const fontFamilySelect = document.getElementById('fontFamily');
const fontSizeInput = document.getElementById('fontSize');
const zoomLabel = document.getElementById('zoomLabel');
const imageCache = new Map();
const drawingStorageKey = 'drawoza-drawing-v1';

let objects = [];
let history = [[]];
let historyIndex = 0;

let selectedIndex = -1;
let copiedObject = null;
let contextMenuPoint = null;

let tool = 'pen';
let zoom = 1;

let isDrawing = false;
let isMoving = false;
let isPlacingText = false;
let isResizing = false;
let dragStart = null;
let currentObject = null;
let resizeStartBounds = null;
let resizeStartObject = null;
let editingTextIndex = -1;
let activeTouchPointers = new Map();
let viewportGesture = null;

const minZoom = 0.18;
const maxZoom = 2.5;
const zoomStep = 0.1;
const maxImportedImageSize = 520;
const selectionPadding = 8;
const resizeHandleSize = 14;

function setTool(nextTool) {
  commitTextEditor();

  tool = nextTool;
  canvas.style.cursor = '';

  document.querySelectorAll('.tool').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });

  toolbar.classList.toggle('text-tool', tool === 'text');
  canvas.classList.toggle('select-mode', tool === 'select');
}

function getSettings() {
  return {
    color: colorPicker.value,
    width: Number(strokeWidthInput.value) || 2,
    font: fontFamilySelect.value,
    size: Number(fontSizeInput.value) || 32,
  };
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function pointInsideCanvas(point) {
  return point.x >= 0 && point.x <= canvas.width && point.y >= 0 && point.y <= canvas.height;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
