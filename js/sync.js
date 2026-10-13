/*
 * Синхронизация с GitHub: качва данните във файла data.json в хранилището
 * и тегли промените оттам, когато има интернет.
 *
 * Как се решава коя версия печели:
 *   - рецепта: по-скоро редактираната (updatedAt)
 *   - изтрита рецепта: изтрива се и при другите (data.deleted)
 *   - менюто за седмицата: по-скоро промененото като цяло (menuUpdatedAt)
 *
 * Без ключ за достъп приложението само чете.
 * Ключът се пази отделно (SYNC_KEY) и никога не се качва в GitHub.
 */

var SYNC_KEY = "sedmichno-sync";
var FILE = "data.json";
var sync = { busy: false, timer: null, again: false, lastOk: 0, lastError: "", pending: false };

/* ---- Настройки ---- */

function syncCfg() {
  var c = {};
  try {
    c = JSON.parse(localStorage.getItem(SYNC_KEY)) || {};
  } catch (e) {}

  // На адрес като ivan.github.io/menu попълваме потребителя и хранилището сами
  var m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (m) {
    var firstFolder = location.pathname.split("/").filter(Boolean)[0];
    if (!c.owner) c.owner = m[1];
    if (!c.repo) c.repo = firstFolder && !firstFolder.includes(".") ? firstFolder : m[1] + ".github.io";
  }
  return c;
}

function syncCfgSave(c) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(c));
  } catch (e) {}
}

function fillSyncForm() {
  var c = syncCfg();
  $("gOwner").value = c.owner || "";
  $("gRepo").value = c.repo || "";
  $("gToken").value = c.token || "";
}

/* ---- Връзка с GitHub ---- */

function apiUrl(c) {
  return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${FILE}`;
}

function apiHeaders(c) {
  var h = { Accept: "application/vnd.github+json" };
  if (c.token) h.Authorization = "Bearer " + c.token;
  return h;
}

// GitHub пази съдържанието в base64. Тези две функции работят и с кирилица.
function b64encode(text) {
  var bytes = new TextEncoder().encode(text);
  var bin = "";
  for (var i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}
function b64decode(b64) {
  var bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

// Грешка с текст, който показваме на човека
function SyncError(message) {
  this.message = message;
}

// Чете data.json от GitHub. Връща { remote, sha } (remote = null, ако файлът още не съществува).
async function readRemote(c) {
  var res = await fetch(apiUrl(c) + "?t=" + Date.now(), { headers: apiHeaders(c), cache: "no-store" });
  if (res.status === 404) return { remote: null, sha: null };
  if (res.status === 401) throw new SyncError("Ключът за достъп е невалиден или е изтекъл.");
  if (res.status === 403)
    throw new SyncError("GitHub отказа достъп. Провери правата на ключа или опитай по-късно.");
  if (!res.ok) throw new SyncError("GitHub върна грешка " + res.status + ".");

  var file = await res.json();
  try {
    return { remote: JSON.parse(b64decode(file.content || "")), sha: file.sha };
  } catch (e) {
    throw new SyncError("Файлът data.json в GitHub е повреден.");
  }
}

// Записва data.json в GitHub. Връща false, ако някой друг е записал междувременно.
async function writeRemote(c, sha) {
  var body = {
    message: "Обновяване на менюто и рецептите",
    content: b64encode(JSON.stringify(shareable(data), null, 1)),
  };
  if (sha) body.sha = sha;

  var res = await fetch(apiUrl(c), {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json" }, apiHeaders(c)),
    body: JSON.stringify(body),
  });
  if (res.ok) return true;
  if (res.status === 409 || res.status === 422) return false;
  if (res.status === 401) throw new SyncError("Ключът за достъп е невалиден или е изтекъл.");
  if (res.status === 403 || res.status === 404)
    throw new SyncError("Ключът няма право да записва в това хранилище.");
  throw new SyncError("Записът в GitHub не успя (грешка " + res.status + ").");
}

/* ---- Сливане на данните ---- */

// Само това, което се качва в GitHub (без настройки и ключове)
function shareable(d) {
  return {
    app: "sedmichno-menu",
    version: 1,
    weekLabel: d.weekLabel || "",
    menuUpdatedAt: d.menuUpdatedAt || 0,
    dishes: d.dishes,
    recipes: d.recipes,
    deleted: d.deleted || {},
  };
}

function sameData(a, b) {
  return JSON.stringify(shareable(a)) === JSON.stringify(shareable(b));
}

// Слива данните от телефона (local) и от GitHub (remote)
function merge(local, remote) {
  var out = { recipes: {}, deleted: {} };

  // изтритите рецепти от двете места
  [local.deleted || {}, remote.deleted || {}].forEach(function (deleted) {
    for (var id in deleted) out.deleted[id] = Math.max(out.deleted[id] || 0, deleted[id]);
  });

  // за всяка рецепта взимаме по-новата версия
  [local.recipes, remote.recipes].forEach(function (recipes) {
    for (var id in recipes) {
      var r = recipes[id];
      var current = out.recipes[id];
      if (!current || (r.updatedAt || 0) > (current.updatedAt || 0)) out.recipes[id] = r;
    }
  });

  // махаме рецептите, изтрити след последната им редакция
  for (var id in out.deleted) {
    if (out.recipes[id] && (out.recipes[id].updatedAt || 0) <= out.deleted[id]) delete out.recipes[id];
  }

  // менюто за седмицата взимаме цялото от по-новото място
  var menu = (remote.menuUpdatedAt || 0) > (local.menuUpdatedAt || 0) ? remote : local;
  out.dishes = menu.dishes || [];
  out.weekLabel = menu.weekLabel || "";
  out.menuUpdatedAt = menu.menuUpdatedAt || 0;
  return out;
}

// Прилага слетите данни в приложението, ако има промяна
function applyMerged(merged) {
  if (sameData(merged, data)) return;
  Object.assign(data, {
    recipes: merged.recipes,
    deleted: merged.deleted,
    dishes: merged.dishes,
    weekLabel: merged.weekLabel,
    menuUpdatedAt: merged.menuUpdatedAt,
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
  renderAll();
  if (ui.sheet && ui.sheet.mode === "view") renderSheet();
}

/* ---- Самата синхронизация ---- */

// manual = true, когато е натиснат бутонът „Синхронизирай сега“ (тогава показваме съобщения)
async function runSync(manual) {
  var c = syncCfg();
  if (!c.owner || !c.repo) {
    if (manual) toast("Попълни потребител и хранилище.");
    return setSyncStatus();
  }
  if (!navigator.onLine) {
    if (manual) toast("Няма интернет връзка.");
    return setSyncStatus();
  }
  if (sync.busy) {
    sync.again = true; // ще се пусне пак, като свърши текущата
    return;
  }

  sync.busy = true;
  sync.lastError = "";
  setSyncStatus();

  try {
    // до 3 опита, ако някой друг запише междувременно
    for (var attempt = 1; attempt <= 3; attempt++) {
      var { remote, sha } = await readRemote(c);
      if (remote && valid(remote)) applyMerged(merge(data, remote));

      var needsUpload = !remote || !valid(remote) || !sameData(remote, data);
      if (!needsUpload || !c.token) {
        sync.pending = needsUpload && !!c.token;
        break;
      }
      if (await writeRemote(c, sha)) {
        sync.pending = false;
        break;
      }
    }
    sync.lastOk = Date.now();
    if (manual) toast(c.token ? "Синхронизирано с GitHub." : "Обновено от GitHub.");
  } catch (e) {
    sync.pending = !!c.token;
    if (e instanceof SyncError) sync.lastError = e.message;
    else
      sync.lastError = navigator.onLine
        ? "Не успях да се свържа с GitHub."
        : "Няма интернет. Промените ще се изпратят по-късно.";
    if (manual) toast(sync.lastError);
  }

  sync.busy = false;
  setSyncStatus();
  if (sync.again) {
    sync.again = false;
    runSync(false);
  }
}

// Вика се след всеки запис (от storage.js): изпраща след 3 секунди
window.syncSoon = function () {
  var c = syncCfg();
  if (!c.owner || !c.repo || !c.token) return;
  sync.pending = true;
  setSyncStatus();
  clearTimeout(sync.timer);
  sync.timer = setTimeout(() => runSync(false), 3000);
};

// Синхронизира, когато се появи интернет или приложението се отвори отново
window.addEventListener("online", () => runSync(false));
window.addEventListener("offline", () => setSyncStatus());
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && Date.now() - sync.lastOk > 60000) runSync(false);
});

/* ---- Текстът за състоянието ---- */

function setSyncStatus() {
  var c = syncCfg();
  var message;
  var badge = "";

  if (!c.owner || !c.repo) {
    message = "Синхронизацията не е настроена.";
  } else if (sync.busy) {
    message = "Синхронизирам…";
    badge = "· синхронизирам";
  } else if (sync.lastError) {
    message = sync.lastError;
    badge = "· несинхронизирано";
  } else if (!navigator.onLine) {
    message = "Няма интернет. Промените ще се изпратят, когато се свържеш.";
    badge = sync.pending ? "· чака интернет" : "";
  } else if (sync.lastOk) {
    var t = new Date(sync.lastOk);
    var time = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
    message = (c.token ? "Синхронизирано" : "Обновено от GitHub (само четене)") + " в " + time + ".";
  } else {
    message = c.token ? "Готово за синхронизация." : "Без ключ: само четене от GitHub.";
  }

  $("syncStatus").textContent = message;
  $("syncBadge").textContent = badge;
}
