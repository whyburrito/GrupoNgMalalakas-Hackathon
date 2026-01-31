// --- CONFIG & ARCHETYPES ---
const emotions = [
  { hex: "#3498db", r: 52, g: 152, b: 219, name: "Sadness", type: "negative" },
  { hex: "#e74c3c", r: 231, g: 76, b: 60, name: "Anger", type: "negative" },
  { hex: "#f1c40f", r: 241, g: 196, b: 15, name: "Joy", type: "positive" },
  { hex: "#2ecc71", r: 46, g: 204, b: 113, name: "Growth", type: "positive" },
  { hex: "#9b59b6", r: 155, g: 89, b: 182, name: "Fear", type: "negative" },
  { hex: "#e67e22", r: 230, g: 126, b: 34, name: "Shock", type: "neutral" },
  { hex: "#34495e", r: 52, g: 73, b: 94, name: "Numbness", type: "negative" },
  { hex: "#e91e63", r: 233, g: 30, b: 99, name: "Passion", type: "positive" },
];

const STORAGE_KEY = "whitemask_journal_entries";
const STREAK_KEY = "whitemask_negative_streak";

// State
let currentColor = emotions[1].hex;
let currentBrushSize = 25;
let interactionMode = "view";
let activeTool = "brush"; // 'brush' or 'stamp'
let currentShape = "circle"; // 'circle', 'square', 'heart', etc.
let isDrawing = false;
let currentExpression = "neutral";
let currentLeader = { name: "NEUTRAL", count: 0, hex: "#ccc" };

// --- LAYERS SETUP ---
const userPaintLayer = document.createElement("canvas");
userPaintLayer.width = 512;
userPaintLayer.height = 640;
const uCtx = userPaintLayer.getContext("2d");

const finalTextureLayer = document.createElement("canvas");
finalTextureLayer.width = 512;
finalTextureLayer.height = 640;
const fCtx = finalTextureLayer.getContext("2d");

// --- HISTORY SYSTEM ---
const historyStack = [];
let historyStep = -1;
const MAX_HISTORY = 20;

function saveState() {
  if (historyStep < historyStack.length - 1) {
    historyStack.length = historyStep + 1;
  }
  historyStack.push(
    uCtx.getImageData(0, 0, userPaintLayer.width, userPaintLayer.height),
  );
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  else historyStep++;
}

function undo() {
  if (historyStep > 0) {
    historyStep--;
    uCtx.putImageData(historyStack[historyStep], 0, 0);
    renderFinalTexture();
    analyzeMask();
  }
}

function redo() {
  if (historyStep < historyStack.length - 1) {
    historyStep++;
    uCtx.putImageData(historyStack[historyStep], 0, 0);
    renderFinalTexture();
    analyzeMask();
  }
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    undo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "y") {
    e.preventDefault();
    redo();
  }
});

// --- UI REFERENCES ---
const colorWheel = document.getElementById("colorWheelInput");

// --- UTILS ---
function findClosestEmotion(r, g, b) {
  let minDist = Infinity;
  let closest = null;
  emotions.forEach((emo) => {
    let dist = Math.sqrt(
      Math.pow(r - emo.r, 2) + Math.pow(g - emo.g, 2) + Math.pow(b - emo.b, 2),
    );
    if (dist < minDist) {
      minDist = dist;
      closest = emo;
    }
  });
  return closest;
}

function hexToRgb(hex) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// --- INPUTS ---
colorWheel.addEventListener("input", (e) => {
  updateColorState(e.target.value);
});

function updateColorState(hex) {
  currentColor = hex;
  colorWheel.value = hex;
  const rgb = hexToRgb(hex);
  if (rgb) {
    const match = findClosestEmotion(rgb.r, rgb.g, rgb.b);
    document.getElementById("color-name-display").textContent = match
      ? match.name
      : "Custom";
    document.getElementById("color-name-display").style.color = hex;
  }
}

document.getElementById("palette-container").innerHTML = "";
emotions.forEach((emo) => {
  const dot = document.createElement("div");
  dot.className = "color-swatch";
  dot.style.backgroundColor = emo.hex;
  dot.onclick = () => updateColorState(emo.hex);
  document.getElementById("palette-container").appendChild(dot);
});

function updateBrushSize(val) {
  currentBrushSize = parseInt(val);
  document.getElementById("size-val").innerText = val;
}

// --- NEW: TOOL & SHAPE SWITCHING ---
window.setToolType = function (type) {
  activeTool = type;
  document.getElementById("type-brush").className =
    type === "brush" ? "btn btn-active" : "btn";
  document.getElementById("type-stamp").className =
    type === "stamp" ? "btn btn-active" : "btn";

  // Toggle Shape Selector
  const shapeSelector = document.getElementById("shape-selector-container");
  if (type === "stamp") {
    shapeSelector.style.display = "block";
  } else {
    shapeSelector.style.display = "none";
  }
};

window.setShape = function (shape) {
  currentShape = shape;
  // Visually update active button
  const buttons = document.querySelectorAll(".shape-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));
  // Find the button clicked (simple heuristic for this demo)
  event.currentTarget.classList.add("active");
};

// --- MODE SWITCHING ---
function setMode(mode) {
  interactionMode = mode;
  document.getElementById("tool-move").className =
    mode === "view" ? "btn btn-active" : "btn";
  document.getElementById("tool-paint").className =
    mode === "paint" ? "btn btn-active" : "btn";
  if (controls) controls.enabled = mode === "view";
  const c = document.querySelector("#viewer canvas");
  if (c) c.style.cursor = mode === "paint" ? "crosshair" : "grab";
}

// --- EXPRESSION TOGGLES ---
window.setExpression = function (type) {
  currentExpression = type;
  document.getElementById("mode-neutral").className =
    type === "neutral" ? "btn btn-active" : "btn";
  document.getElementById("mode-happy").className =
    type === "happy" ? "btn btn-active" : "btn";
  document.getElementById("mode-sad").className =
    type === "sad" ? "btn btn-active" : "btn";
  renderFinalTexture();
};

// --- COMPOSITING ---
function renderFinalTexture() {
  fCtx.clearRect(0, 0, finalTextureLayer.width, finalTextureLayer.height);

  // 1. Base White
  fCtx.globalCompositeOperation = "source-over";
  fCtx.fillStyle = "white";
  fCtx.fillRect(0, 0, finalTextureLayer.width, finalTextureLayer.height);

  // 2. User Paint
  fCtx.drawImage(userPaintLayer, 0, 0);

  // 3. Cut Holes
  fCtx.globalCompositeOperation = "destination-out";

  fCtx.beginPath();
  fCtx.ellipse(100, 280, 55, 35, 0, 0, Math.PI * 2);
  fCtx.fill();
  fCtx.beginPath();
  fCtx.ellipse(412, 280, 55, 35, 0, 0, Math.PI * 2);
  fCtx.fill();

  fCtx.beginPath();
  if (currentExpression === "happy") {
    fCtx.arc(256, 480, 40, 0, Math.PI, false);
    fCtx.lineWidth = 15;
    fCtx.stroke();
  } else if (currentExpression === "sad") {
    fCtx.arc(256, 520, 40, Math.PI, 0, false);
    fCtx.lineWidth = 15;
    fCtx.stroke();
  } else {
    fCtx.ellipse(256, 480, 60, 5, 0, 0, Math.PI * 2);
    fCtx.fill();
  }

  fCtx.globalCompositeOperation = "source-over";
  fCtx.lineWidth = 1;

  if (mat) {
    mat.map.needsUpdate = true;
    mat.emissiveMap.needsUpdate = true;
  }
}

// --- SHAPE DRAWING LOGIC ---
function drawSpecificShape(ctx, shape, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();

  switch (shape) {
    case "square":
      ctx.rect(x - size, y - size, size * 2, size * 2);
      break;
    case "circle":
      ctx.arc(x, y, size, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x - size, y + size);
      ctx.closePath();
      break;
    case "heart":
      // Bezier heart
      ctx.moveTo(x, y - size * 0.3);
      ctx.bezierCurveTo(
        x,
        y - size * 0.6,
        x - size * 1.5,
        y - size * 0.6,
        x - size * 1.5,
        y - size * 0.3,
      );
      ctx.bezierCurveTo(
        x - size * 1.5,
        y + size * 0.4,
        x,
        y + size * 0.8,
        x,
        y + size,
      );
      ctx.bezierCurveTo(
        x,
        y + size * 0.8,
        x + size * 1.5,
        y + size * 0.4,
        x + size * 1.5,
        y - size * 0.3,
      );
      ctx.bezierCurveTo(
        x + size * 1.5,
        y - size * 0.6,
        x,
        y - size * 0.6,
        x,
        y - size * 0.3,
      );
      break;
    case "star":
      for (let i = 0; i < 5 * 2; i++) {
        let rot = (Math.PI / 2) * 3;
        let cx = x;
        let cy = y;
        let dist = i % 2 === 0 ? size : size / 2;
        let angle = (i * Math.PI) / 5;
        ctx.lineTo(
          cx + Math.cos(angle - Math.PI / 2) * dist,
          cy + Math.sin(angle - Math.PI / 2) * dist,
        );
      }
      ctx.closePath();
      break;
    case "cloud":
      ctx.arc(x - size * 0.5, y, size * 0.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(x, y - size * 0.5, size * 0.6, Math.PI * 1, Math.PI * 2);
      ctx.arc(x + size * 0.5, y, size * 0.5, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath();
      break;
    case "bolt":
      ctx.moveTo(x + size * 0.2, y - size);
      ctx.lineTo(x - size * 0.4, y + size * 0.1);
      ctx.lineTo(x, y + size * 0.1);
      ctx.lineTo(x - size * 0.2, y + size);
      ctx.lineTo(x + size * 0.4, y - size * 0.1);
      ctx.lineTo(x, y - size * 0.1);
      ctx.closePath();
      break;
    case "pentagon":
      for (let i = 0; i < 5; i++) {
        let angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
      }
      ctx.closePath();
      break;
    case "flower":
      for (let i = 0; i < 5; i++) {
        let angle = (i * 2 * Math.PI) / 5;
        let ex = x + Math.cos(angle) * (size * 0.5);
        let ey = y + Math.sin(angle) * (size * 0.5);
        ctx.moveTo(x, y);
        ctx.ellipse(ex, ey, size * 0.5, size * 0.2, angle, 0, Math.PI * 2);
      }
      break;
    case "leaf":
      ctx.moveTo(x, y - size);
      ctx.quadraticCurveTo(x + size, y - size * 0.5, x, y + size);
      ctx.quadraticCurveTo(x - size, y - size * 0.5, x, y - size);
      break;
    case "spiral":
      // Archimedean spiral approximation
      let turns = 3;
      let step = size / (turns * 10);
      ctx.beginPath(); // Reset so we don't fill, just stroke
      for (let i = 0; i < turns * 10; i++) {
        let angle = 0.5 * i;
        let r = step * i;
        let px = x + r * Math.cos(angle);
        let py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineWidth = currentBrushSize / 4;
      ctx.strokeStyle = color;
      ctx.stroke();
      return; // Exit because we stroked, didn't fill
  }

  ctx.fill();
}

// --- ANALYSIS ENGINE ---
function analyzeMask() {
  const imgData = uCtx.getImageData(
    0,
    0,
    userPaintLayer.width,
    userPaintLayer.height,
  ).data;
  let emotionCounts = {};
  emotions.forEach((e) => (emotionCounts[e.name] = 0));
  let totalPaintedPixels = 0;

  for (let i = 0; i < imgData.length; i += 40) {
    const r = imgData[i],
      g = imgData[i + 1],
      b = imgData[i + 2],
      a = imgData[i + 3];
    if (a > 50) {
      totalPaintedPixels++;
      const closest = findClosestEmotion(r, g, b);
      if (closest) emotionCounts[closest.name]++;
    }
  }

  const barContainer = document.getElementById("intensityBar");
  barContainer.innerHTML = "";
  let totalIntensityPct = Math.min((totalPaintedPixels / 5000) * 100, 100);
  barContainer.style.width = totalIntensityPct + "%";
  document.getElementById("intensityLabel").innerText =
    `Intensity: ${Math.round(totalIntensityPct)}%`;

  let leader = { name: "NEUTRAL", count: 0, hex: "#ccc" };
  const sortedEmotions = Object.keys(emotionCounts)
    .filter((name) => emotionCounts[name] > 0)
    .sort((a, b) => emotionCounts[b] - emotionCounts[a]);

  let pieGradient = [];
  let currentDeg = 0;
  let legendHTML = "";

  if (sortedEmotions.length === 0) {
    document.getElementById("visualPie").style.background =
      `conic-gradient(#334155 0% 100%)`;
    document.getElementById("pieLegend").innerHTML =
      `<div style="font-style: italic; color: #64748b; font-size: 0.65rem">Paint to see breakdown...</div>`;
  } else {
    sortedEmotions.forEach((name) => {
      const count = emotionCounts[name];
      const emoObj = emotions.find((e) => e.name === name);
      const percent = (count / totalPaintedPixels) * 100;
      if (count > leader.count)
        leader = { name: name, count: count, hex: emoObj.hex };
      const endDeg = currentDeg + percent * 3.6;
      pieGradient.push(`${emoObj.hex} ${currentDeg}deg ${endDeg}deg`);
      currentDeg = endDeg;
      legendHTML += `<div class="legend-item" style="display:flex; align-items:center; justify-content:space-between; font-size:0.65rem; color:#cbd5e1; margin-bottom:2px;"><div style="display:flex; align-items:center;"><span style="width:8px; height:8px; border-radius:50%; background:${emoObj.hex}; margin-right:6px; display:inline-block;"></span>${name}</div><span>${Math.round(percent)}%</span></div>`;
    });
    document.getElementById("visualPie").style.background =
      `conic-gradient(${pieGradient.join(", ")})`;
    document.getElementById("pieLegend").innerHTML = legendHTML;
  }

  currentLeader = leader;
  document.getElementById("leadingEmotion").innerText = leader.name;
  document.getElementById("leadingEmotion").style.color = leader.hex;

  const aiText = document.getElementById("aiText");
  if (totalIntensityPct < 5)
    aiText.innerText =
      "The canvas is blank. Start painting on the mask to reveal insights.";
  else
    aiText.innerHTML = `Dominant Energy: <strong style="color:${leader.hex}">${leader.name}</strong>. `;
}

// --- SAVING & LOADING ---
window.initiateSave = function () {
  document.getElementById("saveModal").style.display = "flex";
  document.getElementById("journalEntryText").value = "";
};

window.confirmSave = function () {
  const userText = document.getElementById("journalEntryText").value.trim();
  const aiText = document.getElementById("aiText").innerText;
  const finalNote = userText || aiText;
  const rawDataURL = userPaintLayer.toDataURL("image/png");

  const entry = {
    id: Date.now(),
    date:
      new Date().toLocaleDateString() +
      " " +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    emotion: currentLeader.name,
    color: currentLeader.hex,
    image: rawDataURL,
    expression: currentExpression,
    note: finalNote,
  };

  let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  closeModal("saveModal");
  alert("Saved to Journal!");
  renderJournalList();
  updateStreakAndCheck(currentLeader.name);
};

function updateStreakAndCheck(emotionName) {
  const NEGATIVE = ["Anger", "Sadness", "Fear", "Numbness"];
  let streak = parseInt(localStorage.getItem(STREAK_KEY) || "0");
  if (NEGATIVE.includes(emotionName)) streak++;
  else streak = 0;
  localStorage.setItem(STREAK_KEY, streak);
  if (streak >= 3) {
    document.getElementById("patternModal").style.display = "flex";
    localStorage.setItem(STREAK_KEY, "0");
  }
}

window.loadJournalEntry = function (entry) {
  if (!confirm("Load this entry? Unsaved work will be overwritten.")) return;
  const img = new Image();
  img.onload = function () {
    uCtx.clearRect(0, 0, userPaintLayer.width, userPaintLayer.height);
    uCtx.drawImage(img, 0, 0);
    setExpression(entry.expression || "neutral");
    analyzeMask();
    saveState();
  };
  img.src = entry.image;
};

function renderJournalList() {
  const container = document.getElementById("journalList");
  const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  container.innerHTML = "";
  if (entries.length === 0) {
    container.innerHTML =
      "<div style='font-size:0.7rem; color:#64748b; font-style:italic;'>No entries yet.</div>";
    return;
  }
  entries.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "journal-entry";
    div.innerHTML = `<div class="entry-info"><strong>${entry.date}</strong></div><div class="entry-emotion" style="background:${entry.color}">${entry.emotion}</div>`;
    div.onclick = () => loadJournalEntry(entry);
    container.appendChild(div);
  });
}

window.closeModal = function (id) {
  document.getElementById(id).style.display = "none";
};
function resetFace() {
  uCtx.clearRect(0, 0, userPaintLayer.width, userPaintLayer.height);
  setExpression("neutral");
  saveState();
  analyzeMask();
}

// --- THREE.JS ENGINE ---
let scene, camera, renderer, mat, mesh, controls;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function init3D() {
  const container = document.getElementById("viewer");
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 0, 9.5);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const geo = new THREE.SphereGeometry(2.8, 128, 128, 0, Math.PI);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    pos.setX(i, x * 1.05);
    pos.setY(i, y * 1.4);
    uv.setXY(i, x / 2.8 + 0.5, y / 3.6 + 0.5);
    let nose = Math.exp(-(x * x * 25 + Math.pow(y - 0.1, 2) * 12));
    z += nose * 0.45;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const canvasTex = new THREE.CanvasTexture(finalTextureLayer);
  canvasTex.encoding = THREE.sRGBEncoding;
  mat = new THREE.MeshStandardMaterial({
    map: canvasTex,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.0,
    emissive: 0xffffff,
    emissiveMap: canvasTex,
    emissiveIntensity: 0.85,
  });
  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  const camLight = new THREE.DirectionalLight(0xffffff, 0.5);
  camera.add(camLight);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("mouseup", onMouseUp);
  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  resetFace();
  animate();
  setMode("view");
  renderJournalList();
  const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  checkWellnessPatterns(entries);
}

function getIntersects(event, object) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObject(object);
}

function drawOnTexture(uv) {
  let x = uv.x * userPaintLayer.width;
  let y = (1 - uv.y) * userPaintLayer.height;

  if (activeTool === "brush") {
    uCtx.beginPath();
    uCtx.arc(x, y, currentBrushSize * 2, 0, Math.PI * 2);
    uCtx.fillStyle = currentColor;
    uCtx.fill();
  } else if (activeTool === "stamp") {
    // Draw Shape Once (Used in mousedown)
    drawSpecificShape(
      uCtx,
      currentShape,
      x,
      y,
      currentBrushSize * 3,
      currentColor,
    );
  }

  renderFinalTexture();
}

function onMouseDown(e) {
  if (interactionMode !== "paint") return;
  const intersects = getIntersects(e, mesh);
  if (intersects.length > 0) {
    isDrawing = true;
    if (activeTool === "stamp") {
      // Stamp only triggers ONCE per click
      drawOnTexture(intersects[0].uv);
      isDrawing = false; // Prevent dragging stamps
      saveState();
      analyzeMask();
    } else {
      // Brush triggers drag
      drawOnTexture(intersects[0].uv);
    }
  }
}

function onMouseMove(e) {
  if (!isDrawing || interactionMode !== "paint" || activeTool === "stamp")
    return;
  const intersects = getIntersects(e, mesh);
  if (intersects.length > 0) {
    drawOnTexture(intersects[0].uv);
  }
}

function onMouseUp() {
  if (isDrawing && activeTool === "brush") {
    isDrawing = false;
    saveState();
    analyzeMask();
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init3D();
