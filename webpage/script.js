const TOTAL_ROUNDS = 45;
const INVEST_PER_ROUND = 1000;
const STARTING_CASH = 10000;
const STOCKS = [
  {
    sym: "RNVT",
    name: "Renovate India Ltd",
    industry: "🏗️ Construction",
    color: "#38bdf8",
    trueMean: 120,
    trueStd: 90,
  },
  {
    sym: "KLMR",
    name: "Kalmar Foods",
    industry: "🍱 FMCG",
    color: "#2dd4bf",
    trueMean: -40,
    trueStd: 80,
  },
  {
    sym: "VRDN",
    name: "Vardan Pharma",
    industry: "💊 Healthcare",
    color: "#f0b429",
    trueMean: 80,
    trueStd: 85,
  },
  {
    sym: "PTRL",
    name: "Petroline Energy",
    industry: "⛽ Oil & Gas",
    color: "#fb923c",
    trueMean: -90,
    trueStd: 110,
  },
  {
    sym: "NXGN",
    name: "NextGen Ventures",
    industry: "🚀 Startups",
    color: "#e879f9",
    trueMean: -60,
    trueStd: 130,
  },
];

let state = {};
let gameNum = 1;

function initState() {
  STOCKS.forEach((s) => {
    s.history = [];
    s.tries = 0;
    s.totalGain = 0;
    s.sumGain = 0;
    s.sumGainSq = 0;
    s.sparkPoints = [];
  });
  state = {
    round: 0,
    cash: STARTING_CASH,
    pnl: 0,
    log: [],
    portfolioHistory: [STARTING_CASH],
    gameOver: false,
    gameNum: gameNum,
  };
}

function randn() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleReward(stock) {
  // For positive-mean stocks, inject a bad result in first 2 tries
  // to punish premature exploitation and reward patient exploration
  if (stock.trueMean > 0 && stock.tries < 2) {
    const spike = -(80 + Math.round(Math.random() * 60)); // -80 to -140
    return Math.max(-400, spike);
  }
  const raw = stock.trueMean + stock.trueStd * randn();
  return Math.round(Math.max(-400, Math.min(400, raw)));
}

function playRound(stockIdx) {
  if (state.gameOver || state.round >= TOTAL_ROUNDS) return;

  const stock = STOCKS[stockIdx];
  const gain = sampleReward(stock);
  const win = gain >= 0;

  stock.tries++;
  stock.totalGain += gain;
  stock.sumGain += gain;
  stock.sumGainSq += gain * gain;
  stock.sparkPoints.push(gain);
  stock.history.push({ win, gain });

  state.cash = Math.round(state.cash + gain);
  state.pnl = Math.round(state.pnl + gain);
  state.round++;
  state.portfolioHistory.push(state.cash);

  state.log.unshift({
    round: state.round,
    sym: stock.sym,
    color: stock.color,
    win,
    gain,
  });
  if (state.log.length > 30) state.log.pop();

  if (state.round >= TOTAL_ROUNDS) {
    state.gameOver = true;
    setTimeout(showGameOver, 600);
  }

  updateUI();
  showToast(stock, win, gain);

  // IMP LINE
  sendState(state);
}

function updateUI() {
  document.getElementById("hdr-portfolio").textContent =
    "₹" + state.cash.toLocaleString("en-IN");
  const pnlEl = document.getElementById("hdr-pnl");
  pnlEl.textContent =
    (state.pnl >= 0 ? "+₹" : "-₹") +
    Math.abs(state.pnl).toLocaleString("en-IN");
  pnlEl.className = "meta-value " + (state.pnl >= 0 ? "green" : "red");
  document.getElementById("hdr-round").textContent =
    state.round + " / " + TOTAL_ROUNDS;
  document.getElementById("rounds-left").textContent =
    TOTAL_ROUNDS - state.round;
  renderStocks();
  renderLog();
  renderChart();
}

function renderStocks() {
  const grid = document.getElementById("stocks-grid");
  const disabled = state.gameOver || state.round >= TOTAL_ROUNDS;

  grid.innerHTML = STOCKS.map((s, i) => {
    const last3 = s.history.slice(-3);
    const avg3 =
      last3.length > 0
        ? Math.round(last3.reduce((a, b) => a + b.gain, 0) / last3.length)
        : null;
    const avg3Display =
      avg3 !== null ? (avg3 >= 0 ? "+₹" + avg3 : "-₹" + Math.abs(avg3)) : "???";
    const avg3Color =
      avg3 === null
        ? "var(--muted)"
        : avg3 >= 0
          ? "var(--green)"
          : "var(--red)";
    const avg3Label =
      s.tries === 0
        ? "Recent Avg"
        : s.tries === 1
          ? "Last 1 Avg"
          : s.tries === 2
            ? "Last 2 Avg"
            : "Last 3 Avg";

    return `
    <div class="stock-card ${disabled ? "disabled" : ""}" onclick="${!disabled ? `playRound(${i})` : ""}">
      <div class="stock-header">
        <div class="stock-symbol" style="color:${s.color}">${s.sym}</div>
        <div class="stock-badge" style="background:${s.color}22;color:${s.color};">${s.industry}</div>
      </div>
      <div class="stock-name">${s.name}</div>
      ${renderSparkline(s)}
      <div class="stock-stats">
        <div class="stat">
          <div class="stat-label">${avg3Label}</div>
          <div class="stat-val" style="color:${avg3Color}">${avg3Display}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Tried</div>
          <div class="stat-val" style="color:${s.color}">${s.tries}×</div>
        </div>
      </div>
      ${!disabled ? '<div class="pick-overlay">👆 Invest</div>' : ""}
    </div>`;
  }).join("");
}

function renderSparkline(stock) {
  const pts = stock.sparkPoints;
  if (pts.length === 0) {
    return `<svg class="sparkline" viewBox="0 0 100 36">
      <line x1="0" y1="18" x2="100" y2="18" stroke="rgba(90,90,122,0.3)" stroke-width="1" stroke-dasharray="4"/>
    </svg>`;
  }
  let cum = [0];
  pts.forEach((p) => cum.push(cum[cum.length - 1] + p));
  const min = Math.min(...cum),
    max = Math.max(...cum);
  const range = max - min || 1;
  const w = 100,
    h = 36;
  const step = pts.length > 1 ? w / (cum.length - 1) : w;
  const points = cum
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  const color = cum[cum.length - 1] >= 0 ? "#22c55e" : "#ef4444";
  return `<svg class="sparkline" viewBox="0 0 100 36" preserveAspectRatio="none">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function renderLog() {
  const feed = document.getElementById("log-feed");
  if (state.log.length === 0) return;
  feed.innerHTML = state.log
    .map(
      (entry) => `
    <div class="log-entry">
      <span class="log-round">#${entry.round}</span>
      <span class="log-sym" style="color:${entry.color}">${entry.sym}</span>
      <span style="color:var(--muted);font-size:10px">${entry.win ? "GAIN" : "LOSS"}</span>
      <span class="log-result ${entry.win ? "win" : "loss"}">${entry.gain >= 0 ? "+₹" : "-₹"}${Math.abs(entry.gain)}</span>
    </div>
  `,
    )
    .join("");
}

function renderChart() {
  const canvas = document.getElementById("portfolioChart");
  const ctx = canvas.getContext("2d");
  canvas.width = (canvas.offsetWidth || 600) * (window.devicePixelRatio || 1);
  canvas.height = 180 * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const W = canvas.offsetWidth || 600,
    H = 180;
  ctx.clearRect(0, 0, W, H);

  const pts = state.portfolioHistory;
  if (pts.length < 2) return;

  const min = Math.min(...pts) - 200;
  const max = Math.max(...pts) + 200;
  const range = max - min || 1;
  const pad = { l: 70, r: 16, t: 10, b: 28 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;

  ctx.strokeStyle = "rgba(42,42,58,0.8)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();
    const val = max - (range / 4) * i;
    ctx.fillStyle = "rgba(90,90,122,0.9)";
    ctx.font = "9px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText(
      "₹" + Math.round(val).toLocaleString("en-IN"),
      pad.l - 4,
      y + 4,
    );
  }

  const baseY = pad.t + chartH - ((STARTING_CASH - min) / range) * chartH;
  ctx.strokeStyle = "rgba(90,90,122,0.4)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.l, baseY);
  ctx.lineTo(W - pad.r, baseY);
  ctx.stroke();
  ctx.setLineDash([]);

  const coords = pts.map((v, i) => ({
    x: pad.l + (i / (pts.length - 1)) * chartW,
    y: pad.t + chartH - ((v - min) / range) * chartH,
  }));

  const lineColor =
    pts[pts.length - 1] >= STARTING_CASH ? "#22c55e" : "#ef4444";

  ctx.beginPath();
  ctx.moveTo(coords[0].x, pad.t + chartH);
  coords.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(coords[coords.length - 1].x, pad.t + chartH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
  grad.addColorStop(0, lineColor + "33");
  grad.addColorStop(1, lineColor + "00");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  coords.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.stroke();

  coords.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  });

  document.getElementById("chart-badge").textContent =
    state.round + " rounds played";
}

// ── TICKER ──
const MARKET_STOCKS = [
  { sym: "RELIANCE", price: 2850 },
  { sym: "TCS", price: 3920 },
  { sym: "INFY", price: 1740 },
  { sym: "HDFCBANK", price: 1620 },
  { sym: "ICICIBANK", price: 1280 },
  { sym: "WIPRO", price: 560 },
  { sym: "BAJFINANCE", price: 7100 },
  { sym: "HINDUNILVR", price: 2340 },
  { sym: "TATAMOTORS", price: 920 },
  { sym: "SUNPHARMA", price: 1780 },
  { sym: "ONGC", price: 280 },
  { sym: "NTPC", price: 375 },
  { sym: "SBIN", price: 810 },
  { sym: "MARUTI", price: 12400 },
  { sym: "TITAN", price: 3650 },
  { sym: "ADANIENT", price: 2980 },
  { sym: "LTIM", price: 5600 },
  { sym: "DRREDDY", price: 6800 },
  { sym: "POWERGRID", price: 340 },
  { sym: "COALINDIA", price: 460 },
  { sym: "HCLTECH", price: 1890 },
  { sym: "TECHM", price: 1420 },
  { sym: "NESTLEIND", price: 2270 },
  { sym: "ASIANPAINT", price: 2640 },
  { sym: "ULTRACEMCO", price: 10800 },
  { sym: "JSWSTEEL", price: 980 },
];

MARKET_STOCKS.forEach((s) => {
  s.change = (Math.random() * 14 - 5).toFixed(2);
  s.currentPrice = (s.price * (1 + parseFloat(s.change) / 100)).toFixed(2);
  s.up = parseFloat(s.change) >= 0;
});

function shuffleTickerPrices() {
  MARKET_STOCKS.forEach((s) => {
    const delta = Math.random() * 0.6 - 0.2;
    s.currentPrice = Math.max(1, parseFloat(s.currentPrice) + delta).toFixed(2);
    s.change = (
      ((parseFloat(s.currentPrice) - s.price) / s.price) *
      100
    ).toFixed(2);
    s.up = parseFloat(s.change) >= 0;
  });
  renderTickerBar();
}

function renderTickerBar() {
  const items = MARKET_STOCKS.map(
    (s) =>
      `<span class="ticker-item">
      <span class="sym">${s.sym}</span>
      <span style="color:var(--text);margin-right:4px">₹${s.currentPrice}</span>
      <span class="${s.up ? "up" : "down"}">${s.up ? "▲" : "▼"} ${Math.abs(s.change)}%</span>
    </span>`,
  ).join("");
  document.getElementById("ticker-scroll").innerHTML = items + items;
}

function showToast(stock, win, gain) {
  const toast = document.getElementById("toast");
  document.getElementById("toast-icon").textContent = win ? "🚀" : "📉";
  document.getElementById("toast-main").textContent =
    `${stock.sym}: ${win ? "GAIN" : "LOSS"}`;
  document.getElementById("toast-sub").textContent =
    `${gain >= 0 ? "+₹" : "-₹"}${Math.abs(gain)} · Portfolio: ₹${state.cash.toLocaleString("en-IN")}`;
  toast.className = "toast show " + (win ? "win-toast" : "loss-toast");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => (toast.className = "toast"), 1800);
}

function showGameOver() {
  const sorted = [...STOCKS].sort((a, b) => b.trueMean - a.trueMean);
  const best = sorted[0];

  document.getElementById("go-title").textContent =
    state.cash >= STARTING_CASH ? "🎉 Profitable!" : "📉 Net Loss";
  document.getElementById("go-subtitle").textContent =
    state.cash >= STARTING_CASH
      ? `You ended with ₹${state.cash.toLocaleString("en-IN")} — nice work!`
      : `You ended with ₹${state.cash.toLocaleString("en-IN")}. ${best.name} was the best pick!`;

  document.getElementById("go-final").textContent =
    "₹" + state.cash.toLocaleString("en-IN");
  document.getElementById("go-final").style.color =
    state.cash >= STARTING_CASH ? "var(--green)" : "var(--red)";

  const bestPossible = STARTING_CASH + best.trueMean * state.round;
  const missed = Math.round(bestPossible - state.cash);
  document.getElementById("go-winrate").textContent =
    (missed <= 0 ? "+₹" : "-₹") + Math.abs(missed).toLocaleString("en-IN");
  document.getElementById("go-winrate").style.color =
    missed <= 0 ? "var(--green)" : "var(--red)";
  document.getElementById("go-best").textContent = best.sym;

  document.getElementById("reveal-list").innerHTML = sorted
    .map(
      (s, i) => `
    <div class="reveal-stock">
      <span class="rsym" style="color:${s.color}">${s.sym}</span>
      <span style="color:var(--muted);font-size:11px">${s.name}</span>
      <span style="color:var(--muted);font-size:11px">${s.industry}</span>
      <span class="rprob">avg ${s.trueMean >= 0 ? "+" : ""}₹${s.trueMean}/round</span>
      ${i === 0 ? '<span class="rbest">BEST</span>' : ""}
    </div>
  `,
    )
    .join("");

  document.getElementById("go-modal").classList.add("show");
}

function resetGame() {
  return;
  document.getElementById("go-modal").classList.remove("show");
  initState();
  updateUI();
  renderTickerBar();
}

initState();
renderTickerBar();
updateUI();
setInterval(shuffleTickerPrices, 3000);
window.addEventListener("resize", () => {
  if (state.portfolioHistory.length > 1) renderChart();
});

// New lines are added here

let PASSWORD = "AXE";

async function loadPassword() {
  //const res = await fetch("password.txt?t=" + Date.now());
  const res = await fetch("./password.txt");
  console.log("Password fetch response:", res); // Debugging line
  PASSWORD = (await res.text()).trim();
  console.log(PASSWORD); // Debugging line
}

window.onload = loadPassword;

const SERVER = "http://10.192.240.170:5000";

async function login() {
  const entered = document.getElementById("password").value;
  console.log("Entered password:", entered); // Debugging line
  if (entered === PASSWORD) {
    try {
      const res = await fetch(SERVER + "/login", {
        method: "POST",
      });
      const data = await res.json();

      if (data.error) {
        if (data.error === "session expired") {
          alert("Session expired");
          localStorage.clear();
          location.reload();
        }
        alert(data.error);
        return;
      }
      const uid = data.user_id;
      const session_id = data.session_id;
      localStorage.setItem("user_id", uid);
      localStorage.setItem("session_id", data.session_id);
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("app").style.display = "block";
      document.getElementById("user").innerText =
        uid < 10 ? "MAB0003280" + uid.toString() : "MAB000328" + uid.toString();
      console.log("User ID:", uid, "Session ID:", session_id); // Debugging line
    } catch (err) {
      console.error(err);
      alert("Cannot reach server");
    }
  } else {
    document.getElementById("error").innerText = "Wrong password";
  }
}

async function sendState(state) {
  const uid = localStorage.getItem("user_id");
  const session_id = localStorage.getItem("session_id");
  console.log("Sending state for User ID:", uid, "Session ID:", session_id); // Debugging line
  try {
    await fetch(SERVER + "/update_state", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: uid,
        state: state,
        session_id: session_id,
      }),
      // Debugging line
    });
  } catch (err) {
    console.error("Error sending state:", err);
  }
}

window.addEventListener("beforeunload", function () {
  const uid = localStorage.getItem("user_id");
  const session = localStorage.getItem("session_id");

  if (!uid) return;

  fetch(SERVER + "/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: Number(uid),
      session_id: Number(session),
    }),
    keepalive: true,
  });
});

async function resetServer() {
  await fetch(SERVER + "/reset", {
    method: "POST",
    // body: JSON.stringify({
    //   key: "ACHILLES",
    // }),
  });
}
