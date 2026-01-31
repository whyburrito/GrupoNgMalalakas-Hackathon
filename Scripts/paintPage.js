// --- CONFIG & ARCHETYPES ---
const emotions = [
  {
    hex: "#3498db",
    r: 52,
    g: 152,
    b: 219,
    name: "Sadness",
    type: "negative",
  },
  {
    hex: "#e74c3c",
    r: 231,
    g: 76,
    b: 60,
    name: "Anger",
    type: "negative",
  },
  {
    hex: "#f1c40f",
    r: 241,
    g: 196,
    b: 15,
    name: "Joy",
    type: "positive",
  },
  {
    hex: "#2ecc71",
    r: 46,
    g: 204,
    b: 113,
    name: "Growth",
    type: "positive",
  },
  {
    hex: "#9b59b6",
    r: 155,
    g: 89,
    b: 182,
    name: "Fear",
    type: "negative",
  },
  {
    hex: "#e67e22",
    r: 230,
    g: 126,
    b: 34,
    name: "Shock",
    type: "neutral",
  },
  {
    hex: "#34495e",
    r: 52,
    g: 73,
    b: 94,
    name: "Numbness",
    type: "negative",
  },
  {
    hex: "#e91e63",
    r: 233,
    g: 30,
    b: 99,
    name: "Passion",
    type: "positive",
  },
];

// State
let currentColor = emotions[1].hex;
let currentBrushSize = 25;
let currentExpression = "neutral";
let isDrawing = false;

// --- OFFSCREEN PAINT LAYER ---
const paintLayer = document.createElement("canvas");
paintLayer.width = 512;
paintLayer.height = 640;
const pCtx = paintLayer.getContext("2d");

// --- UI REFERENCES ---
const paletteContainer = document.getElementById("palette-container");
const nameDisplay = document.getElementById("color-name-display");
const mapDisplay = document.getElementById("color-map-display");
const colorWheel = document.getElementById("colorWheelInput");

// --- COLOR UTILS ---
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

// --- INIT COLOR INPUTS ---
colorWheel.addEventListener("input", (e) => {
  const hex = e.target.value;
  currentColor = hex;
  const rgb = hexToRgb(hex);
  const match = findClosestEmotion(rgb.r, rgb.g, rgb.b);
  nameDisplay.textContent = match.name;
  nameDisplay.style.color = match.hex;
  mapDisplay.textContent = `Maps to: ${match.name}`;
});

emotions.forEach((emo) => {
  const dot = document.createElement("div");
  dot.className = "color-swatch";
  dot.style.backgroundColor = emo.hex;
  dot.onclick = () => {
    currentColor = emo.hex;
    colorWheel.value = emo.hex;
    nameDisplay.textContent = emo.name;
    nameDisplay.style.color = emo.hex;
    mapDisplay.textContent = "Exact Match";
  };
  paletteContainer.appendChild(dot);
});

function updateBrushSize(val) {
  currentBrushSize = parseInt(val);
  document.getElementById("size-val").innerText = val;
}

// --- CANVAS LOGIC ---
const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");

function setExpression(mode) {
  currentExpression = mode;
  ["neutral", "happy", "sad"].forEach((m) => {
    document.getElementById(`mode-${m}`).className =
      m === mode ? "btn btn-active" : "btn";
  });
  resetFace(true);
}

canvas.onmousedown = () => {
  isDrawing = true;
};
window.onmouseup = () => {
  if (isDrawing) {
    isDrawing = false;
    analyzeMask();
  }
};
canvas.onmousemove = (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  pCtx.save();
  pCtx.fillStyle = currentColor;
  pCtx.beginPath();
  pCtx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
  pCtx.fill();
  pCtx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = currentColor;
  ctx.beginPath();
  ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (mat) {
    mat.map.needsUpdate = true;
    mat.alphaMap.needsUpdate = true;
    mat.emissiveMap.needsUpdate = true;
  }
};

// --- ANALYSIS ENGINE ---
function analyzeMask() {
  const imgData = pCtx.getImageData(
    0,
    0,
    paintLayer.width,
    paintLayer.height,
  ).data;
  let emotionCounts = {};
  emotions.forEach((e) => (emotionCounts[e.name] = 0));
  let totalPaintedPixels = 0;

  for (let i = 0; i < imgData.length; i += 40) {
    const r = imgData[i],
      g = imgData[i + 1],
      b = imgData[i + 2],
      a = imgData[i + 3];
    if (a > 10) {
      totalPaintedPixels++;
      const closest = findClosestEmotion(r, g, b);
      if (closest) emotionCounts[closest.name]++;
    }
  }

  const barContainer = document.getElementById("intensityBar");
  barContainer.innerHTML = "";
  const maxCapacity = 5000;
  let totalIntensityPct = Math.min(
    (totalPaintedPixels / maxCapacity) * 100,
    100,
  );
  barContainer.style.width = totalIntensityPct + "%";

  let leaderName = "NEUTRAL",
    leaderColor = "#cbd5e1",
    maxCount = 0;
  let gradientParts = [],
    currentDeg = 0;
  const legendContainer = document.getElementById("pieLegend");
  legendContainer.innerHTML = "";

  let activeEmotions = [];
  let negativeScore = 0;

  if (totalPaintedPixels > 0) {
    emotions.forEach((emo) => {
      const count = emotionCounts[emo.name];
      if (count > maxCount) {
        maxCount = count;
        leaderName = emo.name;
        leaderColor = emo.hex;
      }
      if (count > 0) {
        const pct = (count / totalPaintedPixels) * 100;
        const segment = document.createElement("div");
        segment.className = "bar-segment";
        segment.style.backgroundColor = emo.hex;
        segment.style.width = pct + "%";
        barContainer.appendChild(segment);

        const startPct = currentDeg;
        const endPct = currentDeg + pct;
        gradientParts.push(`${emo.hex} ${startPct}% ${endPct}%`);
        currentDeg += pct;

        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `<div><span class="legend-color" style="background:${emo.hex}"></span>${emo.name}</div><span>${Math.round(pct)}%</span>`;
        legendContainer.appendChild(item);

        activeEmotions.push({ name: emo.name, pct: pct, type: emo.type });
        if (["Sadness", "Fear", "Numbness", "Anger"].includes(emo.name)) {
          negativeScore += pct;
        }
      }
    });
    document.getElementById("visualPie").style.background =
      `conic-gradient(${gradientParts.join(", ")})`;
  } else {
    document.getElementById("visualPie").style.background =
      `conic-gradient(#334155 0% 100%)`;
    legendContainer.innerHTML =
      '<div style="font-style:italic; color:#64748b; font-size:0.65rem;">Paint to see breakdown...</div>';
  }

  const dominanceRatio = maxCount / totalPaintedPixels;
  let balanced = false;
  if (totalPaintedPixels > 50 && dominanceRatio < 0.4) {
    leaderName = "BALANCED";
    leaderColor = "#cbd5e1";
    balanced = true;
  } else if (totalPaintedPixels <= 20) {
    leaderName = "NEUTRAL";
    leaderColor = "#cbd5e1";
  }

  document.getElementById("leadingEmotion").innerText = leaderName;
  document.getElementById("leadingEmotion").style.color = leaderColor;
  document.getElementById("intensityLabel").innerText =
    `Intensity: ${Math.round(totalIntensityPct)}%`;

  generateSummary(
    activeEmotions,
    totalIntensityPct,
    balanced,
    negativeScore,
    leaderName,
  );
}

function generateSummary(
  activeEmotions,
  intensity,
  isBalanced,
  negativeScore,
  leader,
) {
  const aiText = document.getElementById("aiText");
  const hotlineBox = document.getElementById("hotlineBox");
  activeEmotions.sort((a, b) => b.pct - a.pct);
  let text = "";

  if (intensity < 5) {
    text =
      "The mask is currently blank. Begin painting to analyze your emotional state.";
    hotlineBox.style.display = "none";
  } else if (isBalanced) {
    text =
      "Your emotions appear harmonious. No single feeling is dominating, suggesting a state of complexity or emotional regulation.";
    hotlineBox.style.display = "none";
  } else {
    const top = activeEmotions[0];
    const secondary = activeEmotions.length > 1 ? activeEmotions[1] : null;
    if (top.name === "Joy" || top.name === "Passion" || top.name === "Growth") {
      text = `You are primarily radiating ${top.name}. `;
      if (secondary && secondary.type === "negative") {
        text += `However, there is an underlying current of ${secondary.name} that may be complicating your positivity.`;
      } else {
        text +=
          "This indicates a generally positive or constructive mindset right now.";
      }
      hotlineBox.style.display = "none";
    } else if (top.name === "Numbness") {
      text =
        "A strong sense of detachment or numbness is detected. This is often a defense mechanism against overwhelming stress.";
    } else if (top.name === "Anger") {
      text =
        "Frustration or anger is the dominant energy. You may be feeling blocked, unheard, or reacting to a perceived injustice.";
    } else if (top.name === "Fear") {
      text =
        "Anxiety or fear is leading. You might be facing uncertainty or feeling unsafe in your current environment.";
    } else if (top.name === "Sadness") {
      text =
        "There is a significant presence of sadness or grief. You may be processing a loss or carrying a heavy emotional weight.";
    } else {
      text = `Your dominant emotion is ${top.name}.`;
    }

    if (negativeScore > 60 && intensity > 30) {
      hotlineBox.style.display = "block";
      text +=
        " <br><br><span style='color:#f87171'><b>Note:</b> The intensity of distress signals is high. It is okay to ask for help.</span>";
    } else {
      hotlineBox.style.display = "none";
    }
  }
  aiText.innerHTML = text;
}

function resetFace(keepPaint = false) {
  if (!keepPaint) pCtx.clearRect(0, 0, 512, 640);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  if (!keepPaint) analyzeMask();
  if (mat) {
    mat.map.needsUpdate = true;
    mat.alphaMap.needsUpdate = true;
    mat.emissiveMap.needsUpdate = true;
  }
}

// --- THREE JS ---
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
  camera.position.set(0, 0, 9.5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);

  // 1. CRITICAL: Use sRGB Encoding to prevent color darkening
  renderer.outputEncoding = THREE.sRGBEncoding;

  // 2. CRITICAL: Disable Tone Mapping to show "Raw" color
  renderer.toneMapping = THREE.NoToneMapping;

  container.appendChild(renderer.domElement);
  new THREE.OrbitControls(camera, renderer.domElement);
  scene.add(camera); // Add camera to scene so light can follow it

  const geo = new THREE.SphereGeometry(2.8, 128, 128, 0, Math.PI);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    pos.setX(i, x * 1.05);
    pos.setY(i, y * 1.4);
    uv.setXY(i, x / 2.8 + 0.5, y / 3.6 + 0.5);
    let nose = Math.exp(-(x * x * 25 + Math.pow(y - 0.1, 2) * 12));
    z += nose * 0.45;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const canvasTex = new THREE.CanvasTexture(canvas);
  canvasTex.encoding = THREE.sRGBEncoding;

  // 3. Switch to Standard Material with High Emissive
  mat = new THREE.MeshStandardMaterial({
    map: canvasTex,
    alphaMap: canvasTex,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.0,
    // 4. CRITICAL: Emissive Intensity > 0.8 makes it glow, fighting all shadow
    emissive: 0xffffff,
    emissiveMap: canvasTex,
    emissiveIntensity: 0.85,
  });

  scene.add(new THREE.Mesh(geo, mat));

  // 5. CRITICAL: Attach light to CAMERA so face is always lit from front
  const camLight = new THREE.DirectionalLight(0xffffff, 0.5);
  camera.add(camLight);

  // Fill Light
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  resetFace();
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
init3D();
