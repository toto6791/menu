/*
 * Списък за пазар.
 *   „Тази седмица“   – продуктите от рецептите на ястията в менюто
 *   „Всички рецепти“ – продуктите от всички рецепти
 *
 * Ако продуктът има марка в рецептата, тя се показва до името.
 * Еднаквите продукти се събират: „500 г кайма“ + „300 г кайма“ = „800 г кайма“.
 * Ако мерните единици са различни, се показват една до друга: „1 бр. + 200 г лук“.
 *
 * Отметките за купено се пазят в data.bought.week и data.bought.all
 * и се синхронизират с GitHub заедно с всичко останало.
 */

/* ---- Мерни единици ---- */

// Свежда различните изписвания до едно: „гр“ → „г“, „ч. л“ → „ч.л.“ и т.н.
var UNIT_ALIASES = {
  г: "г",
  гр: "г",
  кг: "кг",
  мл: "мл",
  л: "л",
  чл: "ч.л.",
  сл: "с.л.",
  чч: "ч.ч.",
  кч: "к.ч.",
  бр: "бр.",
};

// Единици, които се превръщат в по-малката, за да се събират: 1 кг + 500 г = 1,5 кг
var CONVERT = {
  кг: { to: "г", times: 1000 },
  л: { to: "мл", times: 1000 },
};

function normUnit(text) {
  var key = norm(text).replace(/[\s.]/g, "");
  if (key === "") return "";
  return UNIT_ALIASES[key] || text.trim();
}

// „1,5 кг“ → { amount: 1500, unit: "г" }. Връща null, ако количеството не е просто число.
function parseQty(qty) {
  var m = String(qty || "")
    .trim()
    .match(/^(\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾])\s*(.*)$/);
  if (!m) return null;

  var raw = m[1];
  var amount;
  if (raw === "½") amount = 0.5;
  else if (raw === "¼") amount = 0.25;
  else if (raw === "¾") amount = 0.75;
  else if (raw.includes("/")) amount = +raw.split("/")[0] / +raw.split("/")[1];
  else amount = parseFloat(raw.replace(",", "."));

  var unit = normUnit(m[2]);
  if (CONVERT[unit]) {
    amount *= CONVERT[unit].times;
    unit = CONVERT[unit].to;
  }
  return { amount: amount, unit: unit };
}

// Число в български вид: 1.5 → „1,5“
function formatNumber(n) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

// { amount: 1500, unit: "г" } → „1,5 кг“
function formatQty(amount, unit) {
  if (unit === "г" && amount >= 1000) return formatNumber(amount / 1000) + " кг";
  if (unit === "мл" && amount >= 1000) return formatNumber(amount / 1000) + " л";
  return (formatNumber(amount) + " " + unit).trim();
}

/* ---- Събиране на продуктите ---- */

// Ключ за сравнение на продукти, така че да се събират различни изписвания:
//   „яйца“ и „яйце“, „картофи“ и „картоф“, „сол“ и „сол на вкус“
function itemKey(name) {
  return norm(name)
    .replace(/[,(].*$/, "") // без пояснения след запетая или в скоби
    .replace(/\s+(на|по)\s+вкус$/, "") // „на вкус“ не е част от продукта
    .split(/\s+/)
    .map((w) => (w.length >= 4 ? w.replace(/(ове|еве|та|то|а|я|е|и|о)$/, "") : w)) // без окончанията за число и член
    .join(" ")
    .trim();
}

// По-краткото име за показване: „сол“ вместо „сол на вкус“
function displayName(name) {
  return name.replace(/\s+(на|по)\s+вкус$/i, "").trim();
}

// Кои рецепти влизат в списъка. За седмицата: рецепта, сготвена два пъти, се брои два пъти.
function shoppingRecipes(mode) {
  if (mode === "all") return sortedRecipes();
  return data.dishes.map(recipeOf).filter(Boolean);
}

// Връща списък: [{ key, name, qty, from: ["Мусака", …] }], подреден по азбучен ред
function buildShoppingList(mode) {
  var items = {};

  shoppingRecipes(mode).forEach(function (recipe) {
    (recipe.ingredients || []).forEach(function (g) {
      var name = displayName((g.item || "").trim());
      if (!name) return;
      var key = itemKey(name) || norm(name);
      var item = items[key];
      if (!item) item = items[key] = { key: key, name: name, sums: {}, texts: [], from: [], brands: [] };

      var q = parseQty(g.qty);
      if (q) item.sums[q.unit] = (item.sums[q.unit] || 0) + q.amount;
      else if (g.qty) item.texts.push(g.qty.trim());

      if (!item.from.includes(recipe.title)) item.from.push(recipe.title);

      // марките от всички рецепти, без повторения
      var brand = (g.brand || "").trim();
      if (brand && !item.brands.some((b) => norm(b) === norm(brand))) item.brands.push(brand);
    });
  });

  return Object.values(items)
    .map(function (item) {
      var parts = Object.keys(item.sums).map((unit) => formatQty(item.sums[unit], unit));
      return {
        key: item.key,
        name: item.name,
        qty: parts.concat(item.texts).join(" + "),
        from: item.from,
        brands: item.brands,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));
}

/* ---- Отметки „купено“ ---- */

function boughtFor(mode) {
  data.bought = data.bought || { week: {}, all: {} };
  data.bought[mode] = data.bought[mode] || {};
  return data.bought[mode];
}

function toggleBought(key) {
  var bought = boughtFor(ui.shopMode);
  if (bought[key]) delete bought[key];
  else bought[key] = true;
  data.boughtUpdatedAt = Date.now();
  save();
  renderShopping();
}

function clearBought() {
  data.bought[ui.shopMode] = {};
  data.boughtUpdatedAt = Date.now();
  save();
  renderShopping();
}

/* ---- Показване ---- */

function renderShopping() {
  var mode = ui.shopMode;
  $("shopWeek").setAttribute("aria-pressed", mode === "week");
  $("shopAll").setAttribute("aria-pressed", mode === "all");

  var list = buildShoppingList(mode);
  var bought = boughtFor(mode);
  var box = $("shopList");

  if (!list.length) {
    box.innerHTML =
      mode === "week"
        ? '<div class="empty">Няма продукти. Добави ястия с рецепти в менюто от „Планиране“.</div>'
        : '<div class="empty">Още нямаш рецепти с продукти.</div>';
    $("shopSummary").textContent = "";
    $("shopActions").hidden = true;
    return;
  }

  // купените отиват най-долу
  var toBuy = list.filter((x) => !bought[x.key]);
  var done = list.filter((x) => bought[x.key]);

  $("shopSummary").textContent = `Купени ${done.length} от ${list.length}`;
  $("shopActions").hidden = false;

  box.innerHTML = `<ul class="shop">${toBuy.concat(done).map(shopRow).join("")}</ul>`;

  function shopRow(item) {
    var isBought = !!bought[item.key];
    return `
      <li class="${isBought ? "bought" : ""}">
        <label>
          <input type="checkbox" data-buy="${esc(item.key)}"${isBought ? " checked" : ""}>
          <span class="txt">
            <span class="name">${esc(item.name)}</span>
            ${item.brands.length ? `<span class="brand">${esc(item.brands.join(", "))}</span>` : ""}
            ${item.qty ? `<span class="q">${esc(item.qty)}</span>` : ""}
            <small>${esc(item.from.join(", "))}</small>
          </span>
        </label>
      </li>`;
  }
}

function setShopMode(mode) {
  ui.shopMode = mode;
  renderShopping();
}

/* ---- Копиране на списъка като текст ---- */

function shoppingText() {
  var bought = boughtFor(ui.shopMode);
  var title = ui.shopMode === "week" ? "Пазар за седмицата" : "Пазар (всички рецепти)";
  var rows = buildShoppingList(ui.shopMode)
    .filter((x) => !bought[x.key])
    .map(
      (x) =>
        "☐ " +
        x.name +
        (x.brands.length ? " (" + x.brands.join(", ") + ")" : "") +
        (x.qty ? " – " + x.qty : ""),
    );
  return title + "\n" + rows.join("\n");
}

function copyShopping() {
  var text = shoppingText();
  var done = () => toast("Списъкът е копиран. Можеш да го поставиш в съобщение.");

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, () => copyFallback(text) && done());
  } else if (copyFallback(text)) done();
  else toast("Не успях да копирам списъка.");
}

// Копиране за по-стари браузъри и за Android приложението
function copyFallback(text) {
  var area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  var ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {}
  area.remove();
  return ok;
}
