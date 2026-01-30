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
mask.src = "mask.png"; // Your mask PNG
mask.onload = () => {
  drawCanvas();
  loadCanvas();
};

// --- Shape storage ---
let shapeStack = []; // {type, x, y, size, color}
let draggingShape = null; // for canvas dragging
let selectedShapeIndex = null;
let resizing = false;

// --- Update preview shape ---
function drawPreview() {
  const type = shapeSelect.value;
  const color = colorPicker.value;
  shapePreview.innerHTML = ""; // clear
  const div = document.createElement("div");
  div.style.width = "50px";
  div.style.height = "50px";
  div.style.backgroundColor = type === "triangle" ? "transparent" : color;
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

// --- Drag from preview onto canvas ---
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

canvas.addEventListener("mousemove", (e) => {
  if (!draggingShape) return;
  const [x, y] = getMousePos(e);
  draggingShape.x = x;
  draggingShape.y = y;
  drawCanvas();
  // Draw the dragging shape semi-transparent
  ctx.globalAlpha = 0.5;
  drawShape(draggingShape);
  ctx.globalAlpha = 1;
});

canvas.addEventListener("mouseup", (e) => {
  if (!draggingShape) return;
  const [x, y] = getMousePos(e);
  draggingShape.x = x;
  draggingShape.y = y;
  shapeStack.push(draggingShape);
  actionsUsed++;
  localStorage.setItem("actionsUsed", actionsUsed);
  updateStatus();
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

// --- Draw a single shape ---
function drawShape(shape) {
  const s = shape.size;
  ctx.fillStyle = shape.color;
  switch (shape.type) {
    case "circle":
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "square":
      ctx.fillRect(shape.x - s / 2, shape.y - s / 2, s, s);
      break;
    case "triangle":
      ctx.beginPath();
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
  const savedShapes = JSON.parse(localStorage.getItem("shapeStack")) || [];
  shapeStack = savedShapes;
  drawCanvas();
}

// --- Helpers ---
function updateStatus() {
  status.innerText = `Actions left today: ${Math.max(maxActions - actionsUsed, 0)}`;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}
