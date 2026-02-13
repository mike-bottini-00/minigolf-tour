/* MiniGolf Tour — Scoreboard (offline, localStorage)
   Players: Walter vs Erik

   Photos: uploaded to Cloudinary (shared) using unsigned uploads.
*/

const STORAGE_KEY = "minigolf-tour:v3";
const PLAYERS = ["Walter", "Erik"]; // note: Erik with K

// Cloudinary (shared storage)
const CLOUDINARY_CLOUD_NAME = "ddvvsvn4l";
const CLOUDINARY_UPLOAD_PRESET = "minigolf_unsigned";
const CLOUDINARY_FOLDER = "minigolf";

// Supabase (shared tour state)
const SUPABASE_URL = 'https://qmiauqjqujumizibsyhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaWF1cWpxdWp1bWl6aWJzeWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzYwNDQsImV4cCI6MjA4NjU1MjA0NH0.asXTjRrY9ZawVbTPSFSJbQWE4i3Zkrx1DHqZ-ZuDFw8';
const SUPABASE_WRITE_ENDPOINT = SUPABASE_URL + '/functions/v1/write-state';
const LOCAL_WRITE_TOKEN_KEY = 'minigolf-tour:writeToken';
const POLL_MS = 6000;

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
    version: 3,
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
        photos: [],
      },
      {
        id: uid(),
        date: "",
        location: "London, UK",
        venue: "Swingers",
        notes: "",
        winner: "Erik",
        photos: [],
      },
      {
        id: uid(),
        date: "",
        location: "Tenerife, Spain",
        venue: "Las Americas (mosaic course)",
        notes: "",
        winner: "Erik",
        photos: [],
      },
      {
        id: uid(),
        date: "",
        location: "Dubai, UAE",
        venue: "Swingers",
        notes: "",
        winner: "Walter",
        photos: [],
      },
    ],
  };
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p === "object" && typeof p.url === "string")
    .map((p) => ({
      id: p.id || uid(),
      name: p.name || "photo",
      type: p.type || "image/*",
      url: p.url,
      publicId: p.publicId || null,
      createdAt: p.createdAt || null,
    }));
}

function migrate(old) {
  // Handle older exports with "Eric" spelling and missing fields.
  // If photos are stored as dataUrl (v2), drop them (they were device-local).
  const migrated = {
    version: 3,
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
          // keep scores if present (backward compatibility)
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
  return '—';
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

    ctx.drawImage(img, 0, 0, tw, th);

    // Prefer JPEG to cut size
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    // If still huge, try lower quality
    if (dataUrl.length > 2_200_000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    }

    return { dataUrl, outType: "image/jpeg" };
  } finally {
    cleanupImage(img);
  }
}

function cloudinaryThumb(url) {
  // Insert a transform segment right after /upload/
  try {
    return url.replace(
      "/upload/",
      "/upload/w_220,h_220,c_fill,q_auto,f_auto/"
    );
  } catch {
    return url;
  }
}

async function uploadToCloudinary(dataUrl) {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const fd = new FormData();
  fd.append("file", dataUrl);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("folder", CLOUDINARY_FOLDER);

  const res = await fetch(endpoint, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`cloudinary_upload_failed:${res.status}:${text.slice(0, 120)}`);
  }
  return await res.json();
}

async function supabaseGetState() {
  const url = SUPABASE_URL + '/rest/v1/tour_state?id=eq.main&select=data,updated_at';
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error('supabase_read_failed:' + res.status);
  const rows = await res.json();
  const row = rows?.[0];
  return { data: row?.data ?? null, updatedAt: row?.updated_at ?? null };
}

async function supabaseWriteState(data) {
  const token = (localStorage.getItem(LOCAL_WRITE_TOKEN_KEY) || '').trim();
  if (!token) throw new Error('missing_write_token');

  const res = await fetch(SUPABASE_WRITE_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-write-token': token,
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ data }),
  });

  // If auth fails, clear local token so the next edit will ask again.
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(LOCAL_WRITE_TOKEN_KEY);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('supabase_write_failed:' + res.status + ':' + text.slice(0, 180));
  }

  return await res.json().catch(() => ({ ok: true }));
}

function ensureWriteToken() {
  let token = localStorage.getItem(LOCAL_WRITE_TOKEN_KEY);
  if (token) return true;
  token = prompt('Inserisci codice admin per modificare questo Tour (te l\'ha dato Walter).');
  if (!token) return false;
  localStorage.setItem(LOCAL_WRITE_TOKEN_KEY, token.trim());
  return true;
}

let remoteUpdatedAt = null;
let pollHandle = null;
let syncTimer = null;
let syncAlerted = false;

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const attempts = 2;
    for (let i = 0; i < attempts; i++) {
      try {
        await supabaseWriteState(state);
        syncAlerted = false;
        return;
      } catch (e) {
        console.error(e);

        // tiny retry (often fixes flaky mobile networks)
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 900));
          continue;
        }

        if (!syncAlerted) {
          syncAlerted = true;
          const msg = String(e?.message || e);
          // Show compact reason to speed up debugging
          alert('Sync online fallito (salvato solo sul tuo device).\nDettaglio: ' + msg.slice(0, 120));
        }
      }
    }
  }, 650);
}

function startPolling() {
  clearInterval(pollHandle);
  pollHandle = setInterval(async () => {
    try {
      const r = await supabaseGetState();
      if (!r.updatedAt) return;
      if (!remoteUpdatedAt || r.updatedAt > remoteUpdatedAt) {
        remoteUpdatedAt = r.updatedAt;
        if (r.data && typeof r.data === 'object') {
          state = migrate(r.data);
          save(state);
          render();
        }
      }
    } catch {
      // silent
    }
  }, POLL_MS);
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
let editingPhotos = []; // array of {id,name,type,url,publicId,createdAt}
let uploadsInFlight = 0;
let $btnSave = null;

function setUploading(on){
  if(on) uploadsInFlight += 1;
  else uploadsInFlight = Math.max(0, uploadsInFlight - 1);
  if($btnSave) $btnSave.disabled = uploadsInFlight > 0;
}


function statRow(k, v) {
  return `<div class="stat"><div class="stat__k">${esc(k)}</div><div class="stat__v">${esc(v)}</div></div>`;
}

function renderPhotoPreview() {
  if (!$photoPreview) return;
  $photoPreview.innerHTML = editingPhotos
    .map(
      (p) => `
      <div class="photo" data-photo-id="${esc(p.id)}">
        <img src="${esc(cloudinaryThumb(p.url))}" alt="${esc(p.name)}" />
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
            <img src="${esc(cloudinaryThumb(p.url))}" alt="${esc(p.name)}" />
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
  $viewerImg.src = p.url;
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
    photos: [],
  };

  editingPhotos = normalizePhotos(m.photos);
  renderPhotoPreview();
  if ($photos) $photos.value = "";

  $btnSave = $form.querySelector('button[type="submit"]');
  if($btnSave) $btnSave.disabled = uploadsInFlight > 0;

  $editorTitle.textContent = isNew ? "Nuova partita" : "Modifica partita";
  $matchId.value = m.id;
  $date.value = m.date || "";
  $location.value = m.location || "";
  $venue.value = m.venue || "";
  $notes.value = m.notes || "";

  const radios = $form.querySelectorAll('input[name="winner"]');
  radios.forEach((r) => (r.checked = r.value === m.winner));


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
$btnAdd.addEventListener("click", () => { if(!ensureWriteToken()) return; openEditor(null); });
$btnExport.addEventListener("click", exportJson);
$btnReset.addEventListener("click", () => {
  const ok = confirm("Resetta i dati locali? (perdi le modifiche non esportate)");
  if (!ok) return;
  if(!ensureWriteToken()) return;
  state = seedData();
  save(state);
  render();
  scheduleSync();
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
  scheduleSync();
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
  if(!ensureWriteToken()) return;
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

    const MAX_FILES = 6;
    const take = files.slice(0, MAX_FILES);

    // Upload sequentially (keeps things simple)
    for (const file of take) {
      if (!file.type.startsWith("image/")) continue;

      try {
        setUploading(true);
        const { dataUrl, outType } = await downscaleToDataUrl(file, { maxDim: 1600, quality: 0.82 });

        // Upload to Cloudinary (shared)
        const up = await uploadToCloudinary(dataUrl);
        const url = up.secure_url || up.url;
        if (!url) throw new Error("no_url");

        editingPhotos.push({
          id: uid(),
          name: file.name,
          type: outType,
          url,
          publicId: up.public_id || null,
          createdAt: new Date().toISOString(),
        });

        renderPhotoPreview();
        setUploading(false);
      } catch (err) {
        console.error(err);
        alert("Upload foto fallito. Riprova tra poco (o con una foto diversa). ");
        setUploading(false);
      }
    }

    $photos.value = "";
  });
}

$form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (uploadsInFlight > 0) {
    e.preventDefault();
    alert("Sto ancora caricando le foto… aspetta 2 secondi e riprova a salvare.");
    return;
  }
  const id = $matchId.value || uid();
  const date = $date.value || "";
  const location = $location.value.trim();
  const venue = $venue.value.trim();
  const notes = $notes.value.trim();
  const winner = $form.querySelector('input[name="winner"]:checked')?.value;


  if (!location || !venue || !winner) return;

  const m = {
    id,
    date,
    location,
    venue,
    notes,
    winner,
    photos: normalizePhotos(editingPhotos),
  };

  upsertMatch(m);
  scheduleSync();
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