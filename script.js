const canvas = document.getElementById("maskCanvas");
const ctx = canvas.getContext("2d");
const shapeSelect = document.getElementById("shapeSelect");
const colorPicker = document.getElementById("colorPicker");
const undoBtn = document.getElementById("undoBtn");
const saveBtn = document.getElementById("saveBtn");
const status = document.getElementById("status");
const shapePreview = document.getElementById("shapePreview");

let maxActions = 3;
let actionsUsed = parseInt(localStorage.getItem("actionsUsed")) || 0;
updateStatus();

const mask = new Image();
mask.src = "mask.png"; // your mask image
mask.onload = () => {
  drawCanvas();
  loadCanvas();
};

// --- Shape storage ---
let shapeStack = []; // {type, x, y, size, color}
let draggingShape = null;

// --- Draw preview ---
function drawPreview() {
  shapePreview.innerHTML = ""; // clear
  const type = shapeSelect.value;
  const color = colorPicker.value;
  const div = document.createElement("div");
  div.style.width = "50px";
  div.style.height = "50px";
  div.style.position = "relative";

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
drawPreview();
shapeSelect.addEventListener("change", drawPreview);
colorPicker.addEventListener("input", drawPreview);

// --- Drag & Drop ---
shapePreview.addEventListener("mousedown", (e) => {
  if (actionsUsed >= maxActions) return alert("Daily limit reached!");
  draggingShape = {
    type: shapeSelect.value,
    color: colorPicker.value,
    size: 50,
    x: 0,
    y: 0,
  };
});

document.addEventListener("mousemove", (e) => {
  if (!draggingShape) return;
  const rect = canvas.getBoundingClientRect();
  draggingShape.x = e.clientX - rect.left;
  draggingShape.y = e.clientY - rect.top;
  drawCanvas();
  // Draw semi-transparent dragging shape
  ctx.globalAlpha = 0.5;
  drawShape(draggingShape);
  ctx.globalAlpha = 1;
});

document.addEventListener("mouseup", (e) => {
  if (!draggingShape) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Only drop if inside canvas
  if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
    draggingShape.x = x;
    draggingShape.y = y;
    shapeStack.push(draggingShape);
    actionsUsed++;
    localStorage.setItem("actionsUsed", actionsUsed);
    updateStatus();
  }
  draggingShape = null;
  drawCanvas();
});

// --- Undo ---
undoBtn.addEventListener("click", () => {
  if (shapeStack.length === 0) return;
  shapeStack.pop();
  actionsUsed--;
  if (actionsUsed < 0) actionsUsed = 0;
  localStorage.setItem("actionsUsed", actionsUsed);
  updateStatus();
  drawCanvas();
});

// --- Draw canvas ---
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  shapeStack.forEach(drawShape);
}

// --- Draw shape ---
function drawShape(shape) {
  const s = shape.size;
  ctx.fillStyle = shape.color;
  ctx.beginPath();
  switch (shape.type) {
    case "circle":
      ctx.arc(shape.x, shape.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "square":
      ctx.fillRect(shape.x - s / 2, shape.y - s / 2, s, s);
      break;
    case "triangle":
      ctx.moveTo(shape.x, shape.y - s / 2);
      ctx.lineTo(shape.x - s / 2, shape.y + s / 2);
      ctx.lineTo(shape.x + s / 2, shape.y + s / 2);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

// --- Save / Load ---
saveBtn.addEventListener("click", () => {
  localStorage.setItem("maskCanvasData", canvas.toDataURL());
  localStorage.setItem("shapeStack", JSON.stringify(shapeStack));
  localStorage.setItem("actionsUsed", actionsUsed);
  alert("Canvas saved!");
});

function loadCanvas() {
  try {
    const savedShapes = JSON.parse(localStorage.getItem("shapeStack") || "[]");
    shapeStack = savedShapes;
  } catch (e) {
    console.error("Error loading shapes:", e);
    shapeStack = [];
  }
  drawCanvas();
}

// --- Helpers ---
function updateStatus() {
  status.innerText = `Actions left today: ${Math.max(maxActions - actionsUsed, 0)}`;
}
