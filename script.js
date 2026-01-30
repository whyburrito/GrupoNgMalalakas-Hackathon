const canvas = document.getElementById("maskCanvas");
const ctx = canvas.getContext("2d");
const shapeSelect = document.getElementById("shapeSelect");
const colorPicker = document.getElementById("colorPicker");
const sizeSlider = document.getElementById("sizeSlider");
const sizeValue = document.getElementById("sizeValue");
const rotationSlider = document.getElementById("rotationSlider"); // NEW
const rotationValue = document.getElementById("rotationValue");   // NEW
const undoBtn = document.getElementById("undoBtn");
const saveBtn = document.getElementById("saveBtn");
const status = document.getElementById("status");
const shapePreview = document.getElementById("shapePreview");

let maxActions = 3;
let actionsUsed = parseInt(localStorage.getItem("actionsUsed")) || 0;
let lastMousePos = { x: 0, y: 0 };
let isMouseOver = false;

updateStatus();

const mask = new Image();
mask.src = "mask.png";
mask.onload = () => {
  drawCanvas();
  loadCanvas();
};

// --- Shape storage ---
let shapeStack = []; 

// --- Update sidebar icon (Static preview) ---
function drawSidebarPreview() {
  const type = shapeSelect.value;
  const color = colorPicker.value;
  shapePreview.innerHTML = "";
  const div = document.createElement("div");
  div.style.width = "50px"; 
  div.style.height = "50px";
  div.style.position = "relative";
  // Apply rotation to sidebar preview too for clarity
  div.style.transform = `rotate(${rotationSlider.value}deg)`; 

  if (type === "circle") {
    div.style.borderRadius = "50%";
    div.style.backgroundColor = color;
  } else if (type === "triangle") {
    div.style.width = "0";
    div.style.height = "0";
    div.style.borderLeft = "25px solid transparent";
    div.style.borderRight = "25px solid transparent";
    div.style.borderBottom = `50px solid ${color}`;
  } else {
    div.style.backgroundColor = color;
  }
  shapePreview.appendChild(div);
}

drawSidebarPreview();

// --- Event Listeners for Controls ---
function updateControlState() {
  drawSidebarPreview();
  if(isMouseOver) drawGhost(lastMousePos.x, lastMousePos.y);
}

shapeSelect.addEventListener("change", updateControlState);
colorPicker.addEventListener("input", updateControlState);

sizeSlider.addEventListener("input", (e) => {
  sizeValue.innerText = e.target.value;
  updateControlState();
});

rotationSlider.addEventListener("input", (e) => {
  rotationValue.innerText = e.target.value;
  updateControlState();
});

// --- Keyboard Shortcuts (Ctrl+Z) ---
window.addEventListener("keydown", (e) => {
  // Check for Ctrl+Z (Windows) or Cmd+Z (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault(); // Stop browser undo
    performUndo();
  }
});


// --- Canvas Interaction ---

canvas.addEventListener("mousemove", (e) => {
  const [x, y] = getMousePos(e);
  lastMousePos = { x, y };
  isMouseOver = true;
  drawGhost(x, y);
});

canvas.addEventListener("mouseleave", () => {
  isMouseOver = false;
  drawCanvas();
});

canvas.addEventListener("click", (e) => {
  if (actionsUsed >= maxActions) {
    alert("Daily limit reached!");
    return;
  }

  const [x, y] = getMousePos(e);
  const currentSize = parseInt(sizeSlider.value);
  const currentRotation = parseInt(rotationSlider.value);

  const newShape = {
    type: shapeSelect.value,
    color: colorPicker.value,
    size: currentSize,
    rotation: currentRotation, // Save rotation
    x: x,
    y: y,
  };

  shapeStack.push(newShape);
  actionsUsed++;
  localStorage.setItem("actionsUsed", actionsUsed);
  updateStatus();

  drawCanvas(); 
  if (actionsUsed < maxActions) {
    drawGhost(x, y);
  }
});

// --- Helper: Draw Ghost ---
function drawGhost(x, y) {
  drawCanvas(); 

  if (actionsUsed < maxActions) {
    const currentSize = parseInt(sizeSlider.value);
    const currentRotation = parseInt(rotationSlider.value);
    
    ctx.globalAlpha = 0.5;
    drawShape({
      type: shapeSelect.value,
      color: colorPicker.value,
      size: currentSize,
      rotation: currentRotation,
      x: x,
      y: y
    });
    ctx.globalAlpha = 1.0;
  }
}

// --- Undo Logic ---
function performUndo() {
  if (shapeStack.length === 0) return;
  shapeStack.pop();
  actionsUsed--;
  if (actionsUsed < 0) actionsUsed = 0;
  localStorage.setItem("actionsUsed", actionsUsed);
  updateStatus();
  drawCanvas();
  // If mouse is still over canvas, redraw ghost immediately
  if(isMouseOver) drawGhost(lastMousePos.x, lastMousePos.y);
}

undoBtn.addEventListener("click", performUndo);

// --- Draw Full Canvas ---
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mask.complete && mask.naturalWidth !== 0) {
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  }
  shapeStack.forEach(drawShape);
}

// --- Draw Single Shape (with Rotation) ---
function drawShape(shape) {
  const s = shape.size;
  const rad = (shape.rotation || 0) * (Math.PI / 180); // Convert degrees to radians

  ctx.save(); // Save context state (origin, rotation, etc)
  
  // 1. Move origin to shape's center
  ctx.translate(shape.x, shape.y);
  // 2. Rotate
  ctx.rotate(rad);
  
  ctx.fillStyle = shape.color;
  ctx.beginPath();
  
  // 3. Draw shape centered at (0, 0)
  switch (shape.type) {
    case "circle":
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "square":
      ctx.fillRect(-s / 2, -s / 2, s, s);
      break;
    case "triangle":
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(-s / 2, s / 2);
      ctx.lineTo(s / 2, s / 2);
      ctx.closePath();
      ctx.fill();
      break;
  }

  ctx.restore(); // Restore context to original state for next shape
}

// --- Save / Load ---
saveBtn.addEventListener("click", () => {
  localStorage.setItem("maskCanvasData", canvas.toDataURL());
  localStorage.setItem("shapeStack", JSON.stringify(shapeStack));
  localStorage.setItem("actionsUsed", actionsUsed);
  alert("Canvas saved!");
});

function loadCanvas() {
  const savedShapes = JSON.parse(localStorage.getItem("shapeStack")) || [];
  shapeStack = savedShapes;
  drawCanvas();
}

function updateStatus() {
  status.innerText = `Actions left today: ${Math.max(maxActions - actionsUsed, 0)}`;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}