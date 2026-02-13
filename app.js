/* MiniGolf Tour — Scoreboard (offline, localStorage)
   Players: Walter vs Erik
*/

const STORAGE_KEY = "minigolf-tour:v2";
const PLAYERS = ["Walter", "Erik"]; // note: Erik with K

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
    version: 2,
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
        photos: [],
      },
      {
        id: uid(),
        date: "",
        location: "London, UK",
        venue: "Swingers",
        notes: "",
        winner: "Erik",
        scores: { Walter: null, Erik: null },
        photos: [],
      },
      {
        id: uid(),
        date: "",
        location: "Tenerife, Spain",
        venue: "Las Americas (mosaic course)",
        notes: "",
        winner: "Erik",
        scores: { Walter: null, Erik: null },
        photos: [],
      },
      {
        id: uid(),
        date: "",
        location: "Dubai, UAE",
        venue: "Swingers",
        notes: "",
        winner: "Walter",
        scores: { Walter: null, Erik: null },
        photos: [],
      },
    ],
  };
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p === "object" && typeof p.dataUrl === "string")
    .map((p) => ({
      id: p.id || uid(),
      name: p.name || "photo",
      type: p.type || "image/*",
      dataUrl: p.dataUrl,
    }));
}

function migrate(old) {
  // Handle older exports with "Eric" spelling and missing fields
  const migrated = {
    version: 2,
    createdAt: old?.createdAt || new Date().toISOString(),
    players: PLAYERS,
    matches: Array.isArray(old?.matches)
      ? old.matches.map((m) => ({
          id: m.id || uid(),
          date: m.date || "",
          location: m.location || "",
          venue: m.venue || "",
          notes: m.notes || "",
          winner: m.winner === "Eric" ? "Erik" : PLAYERS.includes(m.winner) ? m.winner : "Walter",
          scores: {
            Walter: m.scores?.Walter ?? null,
            Erik: m.scores?.Erik ?? m.scores?.Eric ?? null,
          },
          photos: normalizePhotos(m.photos),
        }))
      : seedData().matches,
  };
  return migrated;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.matches)) return seedData();
    return migrate(parsed);
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
    const aKey = a.date ? a.date : "0000-00-00";
    const bKey = b.date ? b.date : "0000-00-00";
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

  // streaks based on chronological order (oldest -> newest), empty dates last
  const chronological = [...matches].sort((a, b) => {
    const ad = a.date || "9999-99-99";
    const bd = b.date || "9999-99-99";
    if (ad === bd) return 0;
    return ad < bd ? -1 : 1;
  });

  let currentStreak = { player: null, count: 0 };
  let bestStreak = { player: null, count: 0 };

  for (const m of chronological) {
    if (!m.winner) continue;
    if (currentStreak.player === m.winner) currentStreak.count += 1;
    else currentStreak = { player: m.winner, count: 1 };

    if (currentStreak.count > bestStreak.count) bestStreak = { ...currentStreak };
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

function formatScore(m) {
  const w = m.scores?.Walter;
  const e = m.scores?.Erik;
  if (w == null && e == null) return "—";
  const a = w == null ? "-" : String(w);
  const b = e == null ? "-" : String(e);
  return `Walter ${a} · Erik ${b}`;
}

function buildSpark(matchesSortedNewestFirst) {
  // Take last 10 matches, but show oldest -> newest left->right
  const last = matchesSortedNewestFirst.slice(0, 10).reverse();
  if (!last.length) return "";

  const heights = last.map((m, i) => {
    const base = 26;
    const wobble = 10 + (i % 4) * 3;
    return base + wobble;
  });

  return last
    .map((m, i) => {
      const cls = m.winner === "Walter" ? "bar bar--walter" : "bar bar--erik";
      const title = `${m.date || "(n/a)"} — ${m.location} — ${m.winner}`;
      return `<div class="${cls}" style="height:${heights[i]}px" title="${esc(title)}"></div>`;
    })
    .join("");
}

function scorelineHtml(st) {
  return `
    <div class="scoreline__side">
      <div class="avatar" aria-hidden="true">W</div>
      <div>
        <div class="scoreline__name">Walter</div>
        <div class="scoreline__tag">Winrate ${st.winrate.Walter}%</div>
      </div>
    </div>

    <div class="scoreline__mid" aria-label="Punteggio">
      <div class="score">${st.wins.Walter}</div>
      <div class="dash">—</div>
      <div class="score">${st.wins.Erik}</div>
    </div>

    <div class="scoreline__side" style="justify-content:flex-end">
      <div>
        <div class="scoreline__name" style="text-align:right">Erik</div>
        <div class="scoreline__tag" style="text-align:right">Winrate ${st.winrate.Erik}%</div>
      </div>
      <div class="avatar" aria-hidden="true">E</div>
    </div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read_failed"));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    const url = URL.createObjectURL(file);
    img.src = url;
    img.__ocUrl = url;
  });
}

function cleanupImage(img) {
  try {
    if (img && img.__ocUrl) URL.revokeObjectURL(img.__ocUrl);
  } catch {}
}

async function downscaleToDataUrl(file, opts = {}) {
  // Reasonable defaults for iPhone pics
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.82;

  // If browser can't decode this format, throw.
  const img = await loadImageFromFile(file);
  try {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("bad_image");

    const scale = Math.min(1, maxDim / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas");

    // Draw
    ctx.drawImage(img, 0, 0, tw, th);

    // Prefer JPEG to drastically cut size; keep PNG only if original was PNG and small
    const preferJpeg = file.type !== "image/png";
    const mime = preferJpeg ? "image/jpeg" : "image/png";

    let dataUrl = canvas.toDataURL(mime, quality);

    // If still huge, try lower quality (JPEG)
    if (mime === "image/jpeg" && dataUrl.length > 2_200_000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    }

    return { dataUrl, outType: mime };
  } finally {
    cleanupImage(img);
  }
}

function prettyBytes(n) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let x = Number(n) || 0;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function dataUrlApproxBytes(dataUrl) {
  // rough estimate: base64 length * 3/4
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

// DOM
const $stats = document.getElementById("stats");
const $matchesMeta = document.getElementById("matchesMeta");
const $list = document.getElementById("matchesList");

const $scoreline = document.getElementById("scoreline");
const $heroMeta = document.getElementById("heroMeta");
const $spark = document.getElementById("spark");

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

const $photos = document.getElementById("photos");
const $photoPreview = document.getElementById("photoPreview");

const $viewer = document.getElementById("viewer");
const $viewerImg = document.getElementById("viewerImg");
const $viewerTitle = document.getElementById("viewerTitle");
const $viewerSub = document.getElementById("viewerSub");
const $btnCloseViewer = document.getElementById("btnCloseViewer");

const $exporter = document.getElementById("exporter");
const $exportText = document.getElementById("exportText");
const $btnCloseExport = document.getElementById("btnCloseExport");
const $btnCopy = document.getElementById("btnCopy");

let state = load();
let editingPhotos = []; // array of {id,name,type,dataUrl}

function statRow(k, v) {
  return `<div class="stat"><div class="stat__k">${esc(k)}</div><div class="stat__v">${esc(v)}</div></div>`;
}

function renderPhotoPreview() {
  if (!$photoPreview) return;
  $photoPreview.innerHTML = editingPhotos
    .map(
      (p) => `
      <div class="photo" data-photo-id="${esc(p.id)}">
        <img src="${esc(p.dataUrl)}" alt="${esc(p.name)}" />
        <button type="button" class="photo__x" title="Rimuovi">×</button>
      </div>
    `
    )
    .join("");
}

function matchPhotoThumbsHtml(m) {
  const photos = normalizePhotos(m.photos);
  if (!photos.length) return "";
  const top = photos.slice(0, 4);
  const more = photos.length - top.length;

  return `
    <div class="kv"><div class="k">Foto</div><div class="v">${photos.length}</div></div>
    <div class="photos">
      ${top
        .map(
          (p) => `
          <div class="photo" data-photo-open="1" data-photo-id="${esc(p.id)}" title="Apri foto">
            <img src="${esc(p.dataUrl)}" alt="${esc(p.name)}" />
          </div>
        `
        )
        .join("")}
      ${more > 0 ? `<div class="photo" style="display:grid;place-items:center;color:rgba(233,240,255,.8)">+${more}</div>` : ""}
    </div>
  `;
}

function openViewer(matchId, photoId) {
  const m = state.matches.find((x) => x.id === matchId);
  if (!m) return;
  const photos = normalizePhotos(m.photos);
  const p = photos.find((x) => x.id === photoId);
  if (!p) return;

  $viewerTitle.textContent = "Foto";
  $viewerSub.textContent = `${m.location} — ${m.venue}`;
  $viewerImg.src = p.dataUrl;
  $viewer.showModal();
}

function render() {
  const matchesNewest = sortMatches(state.matches);
  const st = computeStats(state.matches);

  // Hero
  if ($scoreline) $scoreline.innerHTML = scorelineHtml(st);
  if ($heroMeta) {
    const streakNow = st.currentStreak.player ? `${st.currentStreak.player} × ${st.currentStreak.count}` : "—";
    const streakBest = st.bestStreak.player ? `${st.bestStreak.player} × ${st.bestStreak.count}` : "—";
    $heroMeta.innerHTML = [
      `<span class="pill">🗓️ Partite <b>${st.total}</b></span>`,
      `<span class="pill">🔥 Streak attuale <b>${esc(streakNow)}</b></span>`,
      `<span class="pill">🏅 Streak max <b>${esc(streakBest)}</b></span>`,
    ].join("");
  }
  if ($spark) $spark.innerHTML = buildSpark(matchesNewest);

  // Side stats
  $stats.innerHTML = [
    statRow("Partite", st.total),
    statRow("Vittorie Walter", `${st.wins.Walter} (${st.winrate.Walter}%)`),
    statRow("Vittorie Erik", `${st.wins.Erik} (${st.winrate.Erik}%)`),
    statRow(
      "Streak attuale",
      st.currentStreak.player ? `${st.currentStreak.player} × ${st.currentStreak.count}` : "—"
    ),
    statRow(
      "Streak massima",
      st.bestStreak.player ? `${st.bestStreak.player} × ${st.bestStreak.count}` : "—"
    ),
  ].join("");

  $matchesMeta.textContent = `${matchesNewest.length} partite`;

  $list.innerHTML = matchesNewest
    .map((m) => {
      const badgeClass = m.winner === "Walter" ? "badge--walter" : "badge--erik";
      const date = m.date ? esc(m.date) : "(n/a)";
      const score = formatScore(m);
      const notes = m.notes ? `<div class="match__notes">${esc(m.notes)}</div>` : "";
      const photosBlock = matchPhotoThumbsHtml(m);

      return `
        <article class="match" data-id="${esc(m.id)}">
          <div class="match__top">
            <div>
              <div class="match__where">${esc(m.location)}</div>
              <div class="match__venue">${esc(m.venue)}</div>
            </div>
            <div style="text-align:right">
              <div class="match__date">${date}</div>
              <div class="match__badge ${badgeClass}">🏆 ${esc(m.winner)}</div>
            </div>
          </div>

          <div class="match__mid">
            <div class="kv"><div class="k">Strokes</div><div class="v">${esc(score)}</div></div>
            ${photosBlock}
            ${notes}
          </div>

          <div class="match__actions">
            <button class="btn" data-action="edit">Modifica</button>
          </div>
        </article>
      `;
    })
    .join("");
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
    photos: [],
  };

  editingPhotos = normalizePhotos(m.photos);
  renderPhotoPreview();
  if ($photos) $photos.value = "";

  $editorTitle.textContent = isNew ? "Nuova partita" : "Modifica partita";
  $matchId.value = m.id;
  $date.value = m.date || "";
  $location.value = m.location || "";
  $venue.value = m.venue || "";
  $notes.value = m.notes || "";

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
  state = migrate(parsed);
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

if ($btnCloseViewer) {
  $btnCloseViewer.addEventListener("click", () => {
    if ($viewer.open) $viewer.close();
  });
}

$btnDelete.addEventListener("click", () => {
  const id = $matchId.value;
  const ok = confirm("Eliminare questa partita?");
  if (!ok) return;
  deleteMatch(id);
  closeEditor();
});

$list.addEventListener("click", (e) => {
  const card = e.target.closest(".match");
  const matchId = card?.getAttribute("data-id");

  const open = e.target.closest("[data-photo-open]");
  if (open && matchId) {
    const photoId = open.getAttribute("data-photo-id");
    if (photoId) openViewer(matchId, photoId);
    return;
  }

  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (!matchId) return;
  const m = state.matches.find((x) => x.id === matchId);
  if (m) openEditor(m);
});

if ($photoPreview) {
  $photoPreview.addEventListener("click", (e) => {
    const x = e.target.closest(".photo__x");
    if (!x) return;
    const wrap = e.target.closest(".photo");
    const id = wrap?.getAttribute("data-photo-id");
    if (!id) return;
    editingPhotos = editingPhotos.filter((p) => p.id !== id);
    renderPhotoPreview();
  });
}

if ($photos) {
  $photos.addEventListener("change", async () => {
    const files = Array.from($photos.files || []);
    if (!files.length) return;

    // basic safety: avoid huge memory usage
    const MAX_FILES = 6;
    const take = files.slice(0, MAX_FILES);

    for (const file of take) {
      if (!file.type.startsWith("image/")) continue;

      try {
        // Always downscale/compress iPhone pics.
        const { dataUrl, outType } = await downscaleToDataUrl(file, { maxDim: 1600, quality: 0.82 });
        const approx = dataUrlApproxBytes(dataUrl);

        // Hard cap after compression (still too big)
        if (approx > 2_700_000) {
          alert(`Foto ancora troppo grande anche dopo compressione: ${file.name} (~${prettyBytes(approx)}). Prova uno screenshot o una foto più piccola.`);
          continue;
        }

        editingPhotos.push({ id: uid(), name: file.name, type: outType, dataUrl });
      } catch {
        alert("Non riesco a importare questa foto (formato non supportato o errore). Prova uno screenshot e riprova.");
      }
    }

    $photos.value = "";
    renderPhotoPreview();
  });
}

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
    photos: normalizePhotos(editingPhotos),
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

// First render
save(state);
render();
