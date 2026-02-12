/* MiniGolf Tour — Scoreboard (offline, localStorage) */

const STORAGE_KEY = "minigolf-tour:v1";
const PLAYERS = ["Walter", "Erik"];

function uid() {
  return "m_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function todayIso() {
  const d = new Date();
  const tzOff = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOff * 60_000);
  return local.toISOString().slice(0, 10);
}

function seedData() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    players: PLAYERS,
    matches: [
      {
        id: uid(),
        date: "",
        location: "Tirana, Albania",
        venue: "(unknown mountain course)",
        notes: "",
        winner: "Walter",
        scores: { Walter: null, Erik: null },
      },
      {
        id: uid(),
        date: "",
        location: "London, UK",
        venue: "Swingers",
        notes: "",
        winner: "Erik",
        scores: { Walter: null, Erik: null },
      },
      {
        id: uid(),
        date: "",
        location: "Tenerife, Spain",
        venue: "Las Americas (mosaic course)",
        notes: "",
        winner: "Erik",
        scores: { Walter: null, Erik: null },
      },
      {
        id: uid(),
        date: "",
        location: "Dubai, UAE",
        venue: "Swingers",
        notes: "",
        winner: "Walter",
        scores: { Walter: null, Erik: null },
      },
    ],
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.matches)) return seedData();
    // normalize
    parsed.matches = parsed.matches.map((m) => ({
      id: m.id || uid(),
      date: m.date || "",
      location: m.location || "",
      venue: m.venue || "",
      notes: m.notes || "",
      winner: PLAYERS.includes(m.winner) ? m.winner : "Walter",
      scores: {
        Walter: m.scores?.Walter ?? null,
        Erik: m.scores?.Erik ?? m.scores?.Eric ?? null,
      },
    }));
    return parsed;
  } catch {
    return seedData();
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
}

function sortMatches(matches) {
  // newest first; empty dates go last
  return [...matches].sort((a, b) => {
    const ad = a.date || "0000-00-00";
    const bd = b.date || "0000-00-00";
    // treat empty as oldest
    const aKey = a.date ? ad : "0000-00-00";
    const bKey = b.date ? bd : "0000-00-00";
    if (aKey === bKey) return 0;
    return aKey > bKey ? -1 : 1;
  });
}

function computeStats(matches) {
  const total = matches.length;
  const wins = { Walter: 0, Erik: 0 };
  for (const m of matches) wins[m.winner] = (wins[m.winner] || 0) + 1;

  const winrate = {
    Walter: total ? Math.round((wins.Walter / total) * 100) : 0,
    Erik: total ? Math.round((wins.Erik / total) * 100) : 0,
  };

  // streaks based on chronological order (oldest -> newest)
  const chronological = [...matches].sort((a, b) => {
    const ad = a.date || "9999-99-99";
    const bd = b.date || "9999-99-99";
    // empty dates last in chronological
    if (ad === bd) return 0;
    return ad < bd ? -1 : 1;
  });

  let currentStreak = { player: null, count: 0 };
  let bestStreak = { player: null, count: 0 };

  for (const m of chronological) {
    if (!m.winner) continue;
    if (currentStreak.player === m.winner) {
      currentStreak.count += 1;
    } else {
      currentStreak.player = m.winner;
      currentStreak.count = 1;
    }
    if (currentStreak.count > bestStreak.count) {
      bestStreak = { ...currentStreak };
    }
  }

  return { total, wins, winrate, currentStreak, bestStreak };
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// DOM
const $tbody = document.getElementById("matchesTbody");
const $stats = document.getElementById("stats");

const $btnAdd = document.getElementById("btnAdd");
const $btnExport = document.getElementById("btnExport");
const $btnReset = document.getElementById("btnReset");
const $importFile = document.getElementById("importFile");

const $editor = document.getElementById("editor");
const $form = document.getElementById("matchForm");
const $editorTitle = document.getElementById("editorTitle");
const $btnClose = document.getElementById("btnClose");
const $btnCancel = document.getElementById("btnCancel");
const $btnDelete = document.getElementById("btnDelete");

const $matchId = document.getElementById("matchId");
const $date = document.getElementById("date");
const $location = document.getElementById("location");
const $venue = document.getElementById("venue");
const $notes = document.getElementById("notes");
const $scoreWalter = document.getElementById("scoreWalter");
const $scoreErik = document.getElementById("scoreErik");

const $exporter = document.getElementById("exporter");
const $exportText = document.getElementById("exportText");
const $btnCloseExport = document.getElementById("btnCloseExport");
const $btnCopy = document.getElementById("btnCopy");

let state = load();

function render() {
  const matches = sortMatches(state.matches);

  // stats
  const st = computeStats(state.matches);
  $stats.innerHTML = [
    row("Partite", st.total),
    row("Vittorie Walter", `${st.wins.Walter} (${st.winrate.Walter}%)`),
    row("Vittorie Erik", `${st.wins.Erik} (${st.winrate.Erik}%)`),
    row(
      "Streak attuale",
      st.currentStreak.player
        ? `${st.currentStreak.player} × ${st.currentStreak.count}`
        : "—"
    ),
    row(
      "Streak massima",
      st.bestStreak.player ? `${st.bestStreak.player} × ${st.bestStreak.count}` : "—"
    ),
  ].join("\n");

  // table
  $tbody.innerHTML = matches
    .map((m) => {
      const winnerClass = m.winner === "Walter" ? "walter" : "eric";
      const badge = `<span class="badge ${winnerClass}">${esc(m.winner)}</span>`;
      const date = m.date ? esc(m.date) : `<span class="muted">(n/a)</span>`;
      const score = formatScore(m);
      return `
        <tr>
          <td>${date}</td>
          <td>${esc(m.location)}</td>
          <td>
            <div><strong>${esc(m.venue)}</strong></div>
            ${m.notes ? `<div class="muted">${esc(m.notes)}</div>` : ""}
          </td>
          <td>${badge}</td>
          <td>${score}</td>
          <td>
            <div class="actions">
              <button class="btn btn-secondary small" data-action="edit" data-id="${esc(m.id)}">Modifica</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function row(k, v) {
  return `<div class="stat-row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function formatScore(m) {
  const w = m.scores?.Walter;
  const e = m.scores?.Erik;
  if (w == null && e == null) return `<span class="muted">—</span>`;
  const parts = [];
  parts.push(`Walter: ${w == null ? "-" : esc(w)}`);
  parts.push(`Erik: ${e == null ? "-" : esc(e)}`);
  return parts.join("<br>");
}

function openEditor(match) {
  const isNew = !match;
  const m = match || {
    id: uid(),
    date: todayIso(),
    location: "",
    venue: "",
    notes: "",
    winner: "Walter",
    scores: { Walter: null, Erik: null },
  };

  $editorTitle.textContent = isNew ? "Nuova partita" : "Modifica partita";
  $matchId.value = m.id;
  $date.value = m.date || "";
  $location.value = m.location || "";
  $venue.value = m.venue || "";
  $notes.value = m.notes || "";

  // radio
  const radios = $form.querySelectorAll('input[name="winner"]');
  radios.forEach((r) => (r.checked = r.value === m.winner));

  $scoreWalter.value = m.scores?.Walter ?? "";
  $scoreErik.value = m.scores?.Erik ?? "";

  $btnDelete.style.display = isNew ? "none" : "inline-flex";

  $editor.showModal();
}

function closeEditor() {
  if ($editor.open) $editor.close();
}

function upsertMatch(m) {
  const idx = state.matches.findIndex((x) => x.id === m.id);
  if (idx >= 0) state.matches[idx] = m;
  else state.matches.push(m);
  save(state);
  render();
}

function deleteMatch(id) {
  state.matches = state.matches.filter((m) => m.id !== id);
  save(state);
  render();
}

function exportJson() {
  $exportText.value = JSON.stringify(state, null, 2);
  $exporter.showModal();
  $exportText.focus();
  $exportText.select();
}

function importJsonText(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.matches)) throw new Error("JSON non valido");
  // minimal normalize
  state = {
    version: 1,
    createdAt: parsed.createdAt || new Date().toISOString(),
    players: PLAYERS,
    matches: parsed.matches.map((m) => ({
      id: m.id || uid(),
      date: m.date || "",
      location: m.location || "",
      venue: m.venue || "",
      notes: m.notes || "",
      winner: PLAYERS.includes(m.winner) ? m.winner : "Walter",
      scores: {
        Walter: m.scores?.Walter ?? null,
        Erik: m.scores?.Erik ?? m.scores?.Eric ?? null,
      },
    })),
  };
  save(state);
  render();
}

// Events
$btnAdd.addEventListener("click", () => openEditor(null));
$btnExport.addEventListener("click", exportJson);
$btnReset.addEventListener("click", () => {
  const ok = confirm("Resetta i dati locali? (perdi le modifiche non esportate)");
  if (!ok) return;
  state = seedData();
  save(state);
  render();
});

$btnClose.addEventListener("click", closeEditor);
$btnCancel.addEventListener("click", closeEditor);

$btnDelete.addEventListener("click", () => {
  const id = $matchId.value;
  const ok = confirm("Eliminare questa partita?");
  if (!ok) return;
  deleteMatch(id);
  closeEditor();
});

$tbody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (action === "edit") {
    const m = state.matches.find((x) => x.id === id);
    if (m) openEditor(m);
  }
});

$form.addEventListener("submit", () => {
  const id = $matchId.value || uid();
  const date = $date.value || "";
  const location = $location.value.trim();
  const venue = $venue.value.trim();
  const notes = $notes.value.trim();
  const winner = $form.querySelector('input[name="winner"]:checked')?.value;

  const sw = $scoreWalter.value === "" ? null : Number($scoreWalter.value);
  const se = $scoreErik.value === "" ? null : Number($scoreErik.value);

  if (!location || !venue || !winner) return;

  const m = {
    id,
    date,
    location,
    venue,
    notes,
    winner,
    scores: { Walter: Number.isFinite(sw) ? sw : null, Erik: Number.isFinite(se) ? se : null },
  };

  upsertMatch(m);
  closeEditor();
});

$btnCloseExport.addEventListener("click", () => {
  if ($exporter.open) $exporter.close();
});

$btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($exportText.value);
    $btnCopy.textContent = "Copiato";
    setTimeout(() => ($btnCopy.textContent = "Copia"), 900);
  } catch {
    alert("Non riesco a copiare automaticamente. Seleziona e copia a mano.");
  }
});

$importFile.addEventListener("change", async () => {
  const file = $importFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    importJsonText(text);
    alert("Import completato!");
  } catch (err) {
    alert("Import fallito: " + (err?.message || String(err)));
  } finally {
    $importFile.value = "";
  }
});

// Small CSS helper class via JS (avoid extra css)
document.documentElement.style.setProperty("--muted", getComputedStyle(document.documentElement).getPropertyValue("--muted"));

// First render
save(state);
render();

// Add muted class styling
const style = document.createElement("style");
style.textContent = `.muted{color:var(--muted); font-size:12px}`;
document.head.appendChild(style);
