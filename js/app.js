import * as db from "./db.js";

const FOOD_OPTIONS = [
  "Banana", "Avocado", "Sweet Potato", "Oatmeal", "Rice Cereal",
  "Peas", "Carrots", "Apple Sauce", "Pear", "Squash",
  "Green Beans", "Yogurt", "Pumpkin",
];

let familyCode = localStorage.getItem("babyTrackerFamilyCode") || null;
let sleepSessions = [];
let feeds = [];
let solids = [];
let unsubscribers = [];

const el = (id) => document.getElementById(id);

function showScreen(screen) {
  el("setup-screen").classList.toggle("hidden", screen !== "setup");
  el("main-screen").classList.toggle("hidden", screen !== "main");
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(date) {
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function toDate(ts) {
  return ts && typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
}

function toDatetimeLocalValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------- Setup screen ----------
el("create-family-btn").addEventListener("click", async () => {
  const name = el("family-name-input").value.trim();
  if (!name) { el("setup-error").textContent = "Enter a family name."; return; }
  try {
    const code = await db.createFamily(name);
    await enterFamily(code);
  } catch (e) {
    el("setup-error").textContent = e.message;
  }
});

el("join-family-btn").addEventListener("click", async () => {
  const code = el("family-code-input").value.trim().toUpperCase();
  if (!code) { el("setup-error").textContent = "Enter a family code."; return; }
  try {
    await db.joinFamily(code);
    await enterFamily(code);
  } catch (e) {
    el("setup-error").textContent = e.message;
  }
});

el("leave-family-btn").addEventListener("click", () => {
  if (!confirm("Leave this family on this device? You can rejoin anytime with the code.")) return;
  localStorage.removeItem("babyTrackerFamilyCode");
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  familyCode = null;
  showScreen("setup");
});

async function enterFamily(code) {
  const fam = await db.getFamily(code);
  if (!fam) throw new Error("Family not found.");
  familyCode = code;
  localStorage.setItem("babyTrackerFamilyCode", code);
  el("family-name-display").textContent = fam.name;
  el("family-code-display").textContent = code;
  showScreen("main");
  subscribeAll();
}

function subscribeAll() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [
    db.subscribeSleep(familyCode, (data) => { sleepSessions = data; renderSleep(); }),
    db.subscribeFeeds(familyCode, (data) => { feeds = data; renderFeeds(); }),
    db.subscribeSolids(familyCode, (data) => { solids = data; renderSolids(); }),
  ];
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    el(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Sleep ----------
let editingSleepId = null;

function renderSleep() {
  const ongoing = sleepSessions.find((s) => !s.endTime);
  const toggleBtn = el("sleep-toggle-btn");
  if (ongoing) {
    el("sleep-status-label").textContent = "Sleeping for";
    toggleBtn.textContent = "Wake Up";
    toggleBtn.dataset.sessionId = ongoing.id;
    toggleBtn.classList.add("active-state");
  } else {
    el("sleep-status-label").textContent = "Awake for";
    toggleBtn.textContent = "Start Nap";
    delete toggleBtn.dataset.sessionId;
    toggleBtn.classList.remove("active-state");
  }

  const list = el("sleep-list");
  list.innerHTML = "";
  sleepSessions.slice(0, 15).forEach((s) => {
    const start = toDate(s.startTime);
    const end = s.endTime ? toDate(s.endTime) : null;
    const li = document.createElement("li");

    if (s.id === editingSleepId) {
      li.classList.add("edit-row");
      li.innerHTML = `
        <label>Start
          <input type="datetime-local" class="edit-start" value="${toDatetimeLocalValue(start)}" />
        </label>
        ${end ? `
        <label>End
          <input type="datetime-local" class="edit-end" value="${toDatetimeLocalValue(end)}" />
        </label>` : ""}
        <div class="edit-actions">
          <button class="save-btn primary-btn">Save</button>
          <button class="cancel-btn">Cancel</button>
        </div>
      `;
      li.querySelector(".save-btn").addEventListener("click", async () => {
        const newStart = new Date(li.querySelector(".edit-start").value);
        const endInput = li.querySelector(".edit-end");
        const newEnd = endInput ? new Date(endInput.value) : undefined;
        await db.updateSleepTimes(familyCode, s.id, { startTime: newStart, endTime: newEnd });
        editingSleepId = null;
        renderSleep();
      });
      li.querySelector(".cancel-btn").addEventListener("click", () => {
        editingSleepId = null;
        renderSleep();
      });
    } else {
      li.innerHTML = `
        <div>
          <strong>${formatTime(start)}</strong>${end ? ` &rarr; ${formatTime(end)}` : " (ongoing)"}
          <div class="muted">${end ? formatDuration(end - start) : ""}</div>
        </div>
        <div class="entry-actions">
          <button class="edit-btn" aria-label="Edit">✎</button>
          <button class="delete-btn" aria-label="Delete">✕</button>
        </div>
      `;
      li.querySelector(".edit-btn").addEventListener("click", () => {
        editingSleepId = s.id;
        renderSleep();
      });
      li.querySelector(".delete-btn").addEventListener("click", () => db.deleteSleep(familyCode, s.id));
    }

    list.appendChild(li);
  });
}

el("sleep-toggle-btn").addEventListener("click", async (e) => {
  const sessionId = e.currentTarget.dataset.sessionId;
  if (sessionId) {
    await db.endSleep(familyCode, sessionId);
  } else {
    await db.startSleep(familyCode);
  }
});

// ---------- Feeds ----------
function setDefaultDatetime(input) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  input.value = now.toISOString().slice(0, 16);
}
setDefaultDatetime(el("feed-time"));
setDefaultDatetime(el("solids-time"));

el("feed-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const time = new Date(el("feed-time").value);
  const amount = parseFloat(el("feed-amount").value);
  await db.addFeed(familyCode, time, amount);
  e.target.reset();
  setDefaultDatetime(el("feed-time"));
});

let editingFeedId = null;

function renderFeeds() {
  const list = el("feeds-list");
  list.innerHTML = "";
  feeds.slice(0, 15).forEach((f) => {
    const time = toDate(f.time);
    const li = document.createElement("li");

    if (f.id === editingFeedId) {
      li.classList.add("edit-row");
      li.innerHTML = `
        <label>Time
          <input type="datetime-local" class="edit-time" value="${toDatetimeLocalValue(time)}" />
        </label>
        <label>Amount (oz)
          <input type="number" class="edit-amount" value="${f.amountOz}" step="0.5" min="0" />
        </label>
        <div class="edit-actions">
          <button class="save-btn primary-btn">Save</button>
          <button class="cancel-btn">Cancel</button>
        </div>
      `;
      li.querySelector(".save-btn").addEventListener("click", async () => {
        const newTime = new Date(li.querySelector(".edit-time").value);
        const newAmount = parseFloat(li.querySelector(".edit-amount").value);
        await db.updateFeed(familyCode, f.id, { time: newTime, amountOz: newAmount });
        editingFeedId = null;
        renderFeeds();
      });
      li.querySelector(".cancel-btn").addEventListener("click", () => {
        editingFeedId = null;
        renderFeeds();
      });
    } else {
      li.innerHTML = `
        <div>
          <strong>${f.amountOz} oz</strong>
          <div class="muted">${formatTime(time)}</div>
        </div>
        <div class="entry-actions">
          <button class="edit-btn" aria-label="Edit">✎</button>
          <button class="delete-btn" aria-label="Delete">✕</button>
        </div>
      `;
      li.querySelector(".edit-btn").addEventListener("click", () => {
        editingFeedId = f.id;
        renderFeeds();
      });
      li.querySelector(".delete-btn").addEventListener("click", () => db.deleteFeed(familyCode, f.id));
    }

    list.appendChild(li);
  });
}

// ---------- Solids ----------
const foodSelect = el("solids-food");
FOOD_OPTIONS.forEach((food) => {
  const opt = document.createElement("option");
  opt.value = food;
  opt.textContent = food;
  foodSelect.insertBefore(opt, foodSelect.lastElementChild);
});
foodSelect.addEventListener("change", () => {
  el("solids-food-other").classList.toggle("hidden", foodSelect.value !== "__other__");
});

el("solids-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const time = new Date(el("solids-time").value);
  let food = foodSelect.value;
  if (food === "__other__") food = el("solids-food-other").value.trim();
  if (!food) return;
  await db.addSolid(familyCode, time, food);
  e.target.reset();
  setDefaultDatetime(el("solids-time"));
  el("solids-food-other").classList.add("hidden");
});

let editingSolidId = null;

function renderSolids() {
  const list = el("solids-list");
  list.innerHTML = "";
  solids.slice(0, 15).forEach((s) => {
    const time = toDate(s.time);
    const li = document.createElement("li");

    if (s.id === editingSolidId) {
      li.classList.add("edit-row");
      const isKnownFood = FOOD_OPTIONS.includes(s.food);
      const foodOptions = FOOD_OPTIONS.map(
        (food) => `<option value="${food}" ${food === s.food ? "selected" : ""}>${food}</option>`
      ).join("");
      li.innerHTML = `
        <label>Time
          <input type="datetime-local" class="edit-time" value="${toDatetimeLocalValue(time)}" />
        </label>
        <label>Food
          <select class="edit-food">
            ${foodOptions}
            <option value="__other__" ${isKnownFood ? "" : "selected"}>Other...</option>
          </select>
        </label>
        <input type="text" class="edit-food-other ${isKnownFood ? "hidden" : ""}" value="${isKnownFood ? "" : s.food}" placeholder="Enter food" />
        <div class="edit-actions">
          <button class="save-btn primary-btn">Save</button>
          <button class="cancel-btn">Cancel</button>
        </div>
      `;
      const editFoodSelect = li.querySelector(".edit-food");
      const editFoodOther = li.querySelector(".edit-food-other");
      editFoodSelect.addEventListener("change", () => {
        editFoodOther.classList.toggle("hidden", editFoodSelect.value !== "__other__");
      });
      li.querySelector(".save-btn").addEventListener("click", async () => {
        const newTime = new Date(li.querySelector(".edit-time").value);
        let newFood = editFoodSelect.value;
        if (newFood === "__other__") newFood = editFoodOther.value.trim();
        if (!newFood) return;
        await db.updateSolid(familyCode, s.id, { time: newTime, food: newFood });
        editingSolidId = null;
        renderSolids();
      });
      li.querySelector(".cancel-btn").addEventListener("click", () => {
        editingSolidId = null;
        renderSolids();
      });
    } else {
      li.innerHTML = `
        <div>
          <strong>${s.food}</strong>
          <div class="muted">${formatTime(time)}</div>
        </div>
        <div class="entry-actions">
          <button class="edit-btn" aria-label="Edit">✎</button>
          <button class="delete-btn" aria-label="Delete">✕</button>
        </div>
      `;
      li.querySelector(".edit-btn").addEventListener("click", () => {
        editingSolidId = s.id;
        renderSolids();
      });
      li.querySelector(".delete-btn").addEventListener("click", () => db.deleteSolid(familyCode, s.id));
    }

    list.appendChild(li);
  });
}

// ---------- Live timers ----------
function tick() {
  const now = new Date();

  const ongoingSleep = sleepSessions.find((s) => !s.endTime);
  if (ongoingSleep) {
    el("sleep-timer").textContent = formatDuration(now - toDate(ongoingSleep.startTime));
  } else {
    const lastEnded = sleepSessions.find((s) => s.endTime);
    el("sleep-timer").textContent = lastEnded ? formatDuration(now - toDate(lastEnded.endTime)) : "--";
  }

  el("feed-timer").textContent = feeds.length ? formatDuration(now - toDate(feeds[0].time)) : "--";
  el("solids-timer").textContent = solids.length ? formatDuration(now - toDate(solids[0].time)) : "--";
}
setInterval(tick, 15000);

// ---------- Init ----------
async function init() {
  await db.ready();
  tick();
  if (familyCode) {
    try {
      await enterFamily(familyCode);
    } catch (e) {
      localStorage.removeItem("babyTrackerFamilyCode");
      showScreen("setup");
    }
  } else {
    showScreen("setup");
  }
}
init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
