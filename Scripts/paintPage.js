// --- APP STATE ---
const emotions = [
  { hex: "#3498db", r: 52, g: 152, b: 219, name: "Sadness" },
  { hex: "#e74c3c", r: 231, g: 76, b: 60, name: "Anger" },
  { hex: "#f1c40f", r: 241, g: 196, b: 15, name: "Joy" },
  { hex: "#2ecc71", r: 46, g: 204, b: 113, name: "Growth" },
  { hex: "#9b59b6", r: 155, g: 89, b: 182, name: "Fear" },
  { hex: "#e91e63", r: 233, g: 30, b: 99, name: "Passion" },
  { hex: "#34495e", r: 52, g: 73, b: 94, name: "Numb" },
  { hex: "#1e293b", r: 30, g: 41, b: 59, name: "Void" },
];

let currentColor = "#e74c3c";
let currentBrushSize = 25;
let currentExpression = "neutral";
let isDrawing = false;
let isFullscreen = false;

// --- TABS LOGIC ---
function openTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  event.currentTarget.classList.add("active");
}

// --- CANVAS SETUP ---
const paintLayer = document.createElement("canvas");
paintLayer.width = 512;
paintLayer.height = 640;
const pCtx = paintLayer.getContext("2d");
const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");

// UI Init
const paletteContainer = document.getElementById("palette-container");
emotions.forEach((emo) => {
  const dot = document.createElement("div");
  dot.className = "color-swatch";
  dot.style.backgroundColor = emo.hex;
  dot.onclick = () => {
    currentColor = emo.hex;
    document.getElementById("colorWheelInput").value = emo.hex;
  };
  paletteContainer.appendChild(dot);
});

function updateBrushSize(val) {
  currentBrushSize = parseInt(val);
  document.getElementById("size-val").innerText = val;
}

function toggleFullscreen() {
  const sidebar = document.getElementById("sidebar");
  isFullscreen = !isFullscreen;
  sidebar.style.transform = isFullscreen
    ? "translateX(-340px)"
    : "translateX(0)";
  setTimeout(resize, 400);
}

function resize() {
  renderer.setSize(
    document.getElementById("viewer").clientWidth,
    document.getElementById("viewer").clientHeight,
  );
  camera.aspect =
    document.getElementById("viewer").clientWidth /
    document.getElementById("viewer").clientHeight;
  camera.updateProjectionMatrix();
}

function setExpression(mode) {
  currentExpression = mode;
  ["neutral", "happy", "sad"].forEach((m) => {
    document.getElementById(`mode-${m}`).className =
      m === mode ? "btn btn-active" : "btn";
  });
  resetFace(true);
}

// --- PAINTING ---
canvas.onmousedown = () => (isDrawing = true);
window.onmouseup = () => {
  if (isDrawing) {
    isDrawing = false;
    analyzeMask();
  }
};
canvas.onmousemove = (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (512 / rect.width);
  const y = (e.clientY - rect.top) * (640 / rect.height);

  pCtx.fillStyle = currentColor;
  pCtx.beginPath();
  pCtx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
  pCtx.fill();

  redrawCanvas();
  if (mat) mat.map.needsUpdate = true;
};

function redrawCanvas() {
  ctx.clearRect(0, 0, 512, 640);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 512, 640);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(100, 280, 55, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(412, 280, 55, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  if (currentExpression === "neutral") {
    ctx.beginPath();
    ctx.ellipse(256, 480, 60, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (currentExpression === "happy") {
    ctx.beginPath();
    ctx.arc(256, 450, 60, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();
  } else if (currentExpression === "sad") {
    ctx.beginPath();
    ctx.arc(256, 530, 60, 1.1 * Math.PI, 1.9 * Math.PI, false);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-atop";
  ctx.drawImage(paintLayer, 0, 0);
}

function resetFace(keepPaint = false) {
  if (!keepPaint) pCtx.clearRect(0, 0, 512, 640);
  redrawCanvas();
  if (!keepPaint) analyzeMask();
  if (mat) mat.map.needsUpdate = true;
}

// --- ANALYTICS ---
function analyzeMask() {
  const imgData = pCtx.getImageData(0, 0, 512, 640).data;
  let counts = {};
  emotions.forEach((e) => (counts[e.name] = 0));
  let total = 0;

  for (let i = 0; i < imgData.length; i += 50) {
    if (imgData[i + 3] > 10) {
      total++;
      let minDist = Infinity,
        closest = emotions[0];
      emotions.forEach((e) => {
        let d = Math.sqrt(
          Math.pow(imgData[i] - e.r, 2) +
            Math.pow(imgData[i + 1] - e.g, 2) +
            Math.pow(imgData[i + 2] - e.b, 2),
        );
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      });
      counts[closest.name]++;
    }
  }

  const bar = document.getElementById("intensityBar");
  bar.innerHTML = "";
  let leader = "NEUTRAL",
    lCol = "#64748b",
    max = 0,
    grad = [];
  let cur = 0;

  if (total > 0) {
    emotions.forEach((e) => {
      let p = (counts[e.name] / total) * 100;
      if (p > 0) {
        const seg = document.createElement("div");
        seg.style.width = p + "%";
        seg.style.backgroundColor = e.hex;
        bar.appendChild(seg);
        grad.push(`${e.hex} ${cur}% ${cur + p}%`);
        cur += p;
        if (counts[e.name] > max) {
          max = counts[e.name];
          leader = e.name;
          lCol = e.hex;
        }
      }
    });
    document.getElementById("visualPie").style.background =
      `conic-gradient(${grad.join(",")})`;
    document.getElementById("aiText").innerText =
      `Detection reveals a dominant ${leader} state. The application of color indicates a complex emotional response.`;
  } else {
    document.getElementById("visualPie").style.background = "#334155";
    document.getElementById("aiText").innerText =
      "Canvas is clear. Express a state to begin analysis.";
  }
  document.getElementById("leadingEmotion").innerText = leader;
  document.getElementById("leadingEmotion").style.color = lCol;
  document.getElementById("intensityLabel").innerText =
    `Energy Level: ${Math.min(Math.round(total / 40), 100)}%`;
}

// --- THREE.JS ---
let scene, camera, renderer, mat;
function init3D() {
  const container = document.getElementById("viewer");
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );
  camera.position.z = 9;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  new THREE.OrbitControls(camera, renderer.domElement);

  const geo = new THREE.SphereGeometry(2.8, 64, 64, 0, Math.PI);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    pos.setX(i, x * 1.05);
    pos.setY(i, y * 1.4);
    uv.setXY(i, x / 2.8 + 0.5, y / 3.6 + 0.5);
    z += Math.exp(-(x * x * 25 + (y - 0.1) ** 2 * 12)) * 0.45;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.1,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.3,
  });

  scene.add(new THREE.Mesh(geo, mat));
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const light = new THREE.DirectionalLight(0xffffff, 0.4);
  light.position.set(5, 5, 5);
  scene.add(light);

  window.addEventListener("resize", resize);
  resetFace();
  (function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  })();
}

init3D();
