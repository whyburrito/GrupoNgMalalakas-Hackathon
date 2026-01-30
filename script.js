const canvas = document.getElementById("maskCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const shapeSelect = document.getElementById("shapeSelect");
const colorPicker = document.getElementById("colorPicker");
const sizeSlider = document.getElementById("sizeSlider");
const sizeValue = document.getElementById("sizeValue");
const rotationSlider = document.getElementById("rotationSlider");
const rotationValue = document.getElementById("rotationValue");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const status = document.getElementById("status");
const shapePreview = document.getElementById("shapePreview");

// State
let maxActions = 3;
let actionsUsed = parseInt(localStorage.getItem("actionsUsed")) || 0;
let shapeStack = [];
let lastMousePos = { x: 0, y: 0 };
let isMouseOver = false;

// Initialize
function init() {
  resizeCanvas();
  loadCanvas();
  updateStatus();
  drawSidebarPreview();
  
  // Re-draw when window is resized
  window.addEventListener("resize", () => {
    resizeCanvas();
    drawCanvas();
  });
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// --- Helper: Get Base Circle Dimensions ---
// This ensures we always know where the valid area is, even if screen resizes
function getBaseCircle() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
    r: Math.min(canvas.width, canvas.height) * 0.4 // 40% of smallest screen dimension
  };
}

// --- Helper: Check if Point is inside Base Circle ---
function isInsideBaseCircle(x, y) {
  const base = getBaseCircle();
  const dx = x - base.x;
  const dy = y - base.y;
  // Distance formula: distance^2 <= radius^2
  return (dx * dx + dy * dy) <= (base.r * base.r);
}

// --- Drawing Logic ---

// 1. Draw the entire scene
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // A. Draw the "Base" (Large Circle)
  const base = getBaseCircle();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(base.x, base.y, base.r, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 5;
  ctx.stroke();
  
  // Create a clipping region so saved shapes don't "spill" out if they were on the edge
  ctx.clip(); 

  // B. Draw Saved Shapes
  shapeStack.forEach(drawShape);
  
  ctx.restore();
}

// 2. Draw a specific shape
function drawShape(shape) {
  const s = shape.size;
  const rad = (shape.rotation || 0) * (Math.PI / 180);

  ctx.save();
  ctx.translate(shape.x, shape.y);
  ctx.rotate(rad);
  ctx.fillStyle = shape.color;
  ctx.beginPath();

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
  ctx.restore();
}

// 3. Draw Ghost (Preview)
function drawGhost(x, y) {
  drawCanvas(); // Draw background + stack first

  // Only draw ghost if we have actions AND mouse is inside the circle
  if (actionsUsed < maxActions && isInsideBaseCircle(x, y)) {
    const currentSize = parseInt(sizeSlider.value);
    const currentRotation = parseInt(rotationSlider.value);

    ctx.save();
    // We clip again so the ghost gets cut off if it overlaps the edge slightly
    const base = getBaseCircle();
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.r, 0, Math.PI * 2);
    ctx.clip();

    ctx.globalAlpha = 0.5; // Transparent
    drawShape({
      type: shapeSelect.value,
      color: colorPicker.value,
      size: currentSize,
      rotation: currentRotation,
      x: x,
      y: y
    });
    ctx.restore();
  }
}

// --- Interactions ---

canvas.addEventListener("mousemove", (e) => {
  const [x, y] = getMousePos(e);
  lastMousePos = { x, y };
  isMouseOver = true;
  
  // The drawGhost function now internally checks if it should draw
  drawGhost(x, y);
});

canvas.addEventListener("mouseleave", () => {
  isMouseOver = false;
  drawCanvas();
});

canvas.addEventListener("click", (e) => {
  const [x, y] = getMousePos(e);

  // 1. Check Limits
  if (actionsUsed >= maxActions) {
    alert("Daily limit reached! Use 'Reset Actions' if you need more.");
    return;
  }

  // 2. Check Area Constraint
  if (!isInsideBaseCircle(x, y)) {
    // If clicked outside, do nothing (or you could alert)
    return;
  }

  const newShape = {
    type: shapeSelect.value,
    color: colorPicker.value,
    size: parseInt(sizeSlider.value),
    rotation: parseInt(rotationSlider.value),
    x: x,
    y: y,
  };

  shapeStack.push(newShape);
  actionsUsed++;
  saveData();
  updateStatus();
  
  // Redraw
  drawCanvas();
  
  // Show ghost immediately if still valid
  if (actionsUsed < maxActions) drawGhost(x, y);
});

// --- Controls & Tools ---

// Update Preview Icon
function drawSidebarPreview() {
  const type = shapeSelect.value;
  const color = colorPicker.value;
  const rot = rotationSlider.value;
  
  shapePreview.innerHTML = "";
  const div = document.createElement("div");
  div.style.width = "40px";
  div.style.height = "40px";
  div.style.transform = `rotate(${rot}deg)`;

  if (type === "circle") {
    div.style.borderRadius = "50%";
    div.style.backgroundColor = color;
  } else if (type === "triangle") {
    div.style.width = "0";
    div.style.height = "0";
    div.style.borderLeft = "20px solid transparent";
    div.style.borderRight = "20px solid transparent";
    div.style.borderBottom = `40px solid ${color}`;
    div.style.backgroundColor = "transparent";
  } else {
    div.style.backgroundColor = color;
  }
  shapePreview.appendChild(div);
}

// Listeners for inputs
[shapeSelect, colorPicker, sizeSlider, rotationSlider].forEach(el => {
  el.addEventListener("input", (e) => {
    if(e.target === sizeSlider) sizeValue.innerText = sizeSlider.value;
    if(e.target === rotationSlider) rotationValue.innerText = rotationSlider.value;
    drawSidebarPreview();
    if(isMouseOver) drawGhost(lastMousePos.x, lastMousePos.y);
  });
});

// Undo
function performUndo() {
  if (shapeStack.length === 0) return;
  shapeStack.pop();
  actionsUsed--;
  if (actionsUsed < 0) actionsUsed = 0;
  saveData();
  updateStatus();
  drawCanvas();
  if(isMouseOver) drawGhost(lastMousePos.x, lastMousePos.y);
}
undoBtn.addEventListener("click", performUndo);

// Keyboard Undo
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    performUndo();
  }
});

// Reset Actions
resetBtn.addEventListener("click", () => {
  if(confirm("Reset action count and clear shapes?")) {
    actionsUsed = 0;
    shapeStack = [];
    saveData();
    updateStatus();
    drawCanvas();
  }
});

// Download Image
downloadBtn.addEventListener("click", () => {
  const link = document.createElement('a');
  link.download = 'my-mask-design.png';
  link.href = canvas.toDataURL();
  link.click();
});

// --- Helpers ---

function saveData() {
  localStorage.setItem("shapeStack", JSON.stringify(shapeStack));
  localStorage.setItem("actionsUsed", actionsUsed);
}

function loadCanvas() {
  const savedShapes = JSON.parse(localStorage.getItem("shapeStack")) || [];
  shapeStack = savedShapes;
}

function updateStatus() {
  status.innerText = `Actions left: ${Math.max(maxActions - actionsUsed, 0)}`;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

// Start
init();