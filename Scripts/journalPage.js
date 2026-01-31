// Keyword Lists
const sadWords = [
  "sad",
  "depressed",
  "lonely",
  "tired",
  "hate",
  "hurt",
  "pain",
  "hopeless",
  "end",
  "kill",
  "crying",
  "angry",
  "afraid",
];
const happyWords = [
  "happy",
  "great",
  "excited",
  "love",
  "good",
  "joy",
  "wonderful",
  "blessed",
  "content",
  "peace",
];

function analyzeJournal() {
  const textarea = document.getElementById("journalInput");
  const text = textarea.value.toLowerCase();

  // UI Elements
  const emotionEl = document.getElementById("text-emotion");
  const resultEl = document.getElementById("analysis-results");
  const intensityBar = document.getElementById("intensityBar");
  const stabilityEl = document.getElementById("stabilityScore");
  const hotline = document.getElementById("hotlineBox");

  if (text.length === 0) {
    emotionEl.innerText = "NEUTRAL";
    emotionEl.style.color = "#323232";
    intensityBar.style.width = "0%";
    stabilityEl.innerText = "100%";
    resultEl.innerText = "System standing by. Start typing...";
    hotline.style.display = "none";
    return;
  }

  let sCount = 0;
  let hCount = 0;

  // Check for keywords
  sadWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g"); // matches whole words only
    const matches = text.match(regex);
    if (matches) sCount += matches.length;
  });

  happyWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = text.match(regex);
    if (matches) hCount += matches.length;
  });

  // 1. Calculate Intensity (How many emotional words total)
  const intensity = Math.min((sCount + hCount) * 10, 100);
  intensityBar.style.width = intensity + "%";

  // 2. Calculate Stability (Decreases with sad words)
  const stability = Math.max(0, 100 - sCount * 12);
  stabilityEl.innerText = stability + "%";

  // 3. Determine Mood and UI color
  if (sCount > hCount) {
    emotionEl.innerText = "DISTRESSED";
    emotionEl.style.color = "#ef4444";
    resultEl.innerText =
      "The AI detects signs of emotional strain. Continue expressing yourself.";

    // Show Hotline if sCount is high (more than 3 sad words)
    hotline.style.display = sCount > 3 ? "block" : "none";
  } else if (hCount > sCount) {
    emotionEl.innerText = "POSITIVE";
    emotionEl.style.color = "#10b981";
    resultEl.innerText = "The AI detects a positive outlook in your writing.";
    hotline.style.display = "none";
  } else {
    emotionEl.innerText = "NEUTRAL";
    emotionEl.style.color = "#323232";
    resultEl.innerText = "Your entry currently appears balanced.";
    hotline.style.display = "none";
  }
}
