/*
 * Прозорецът с рецептата: отваряне, затваряне и показване на рецептата
 * (продукти с отметки, стъпки, съвети).
 */

// Отваря прозореца. s = { mode: "view" или "edit", recipeId, dishId }
function openSheet(s) {
  ui.sheet = s;
  $("sheet").hidden = false;
  document.body.style.overflow = "hidden";
  renderSheet();
  $("sheet").scrollTop = 0;
}

function closeSheet() {
  ui.sheet = null;
  $("sheet").hidden = true;
  document.body.style.overflow = "";
}

// Показва или рецептата, или формата за редакция
function renderSheet() {
  var s = ui.sheet;
  if (!s) return;
  var r = s.recipeId ? data.recipes[s.recipeId] : null;
  if (s.mode === "view" && !r) return closeSheet();

  $("editBtn").hidden = s.mode !== "view";
  if (s.mode === "view") renderRecipeView(r);
  else renderEditor(r, s.dishId ? findDish(s.dishId) : null); // виж recipe-editor.js
}

function renderRecipeView(r) {
  // кратките „балончета“ под заглавието
  var facts = [];
  if (r.servings) facts.push(r.servings + " порции");
  if (r.prepMinutes) facts.push("Подготовка " + r.prepMinutes + " мин");
  if (r.cookMinutes) facts.push("Готвене " + r.cookMinutes + " мин");
  if (r.difficulty) facts.push(r.difficulty);
  if (r.kcal) facts.push("≈ " + r.kcal + " kcal на порция");

  var html = `<h1 class="r-title" id="rTitle">${esc(r.title)}</h1>`;
  if (r.summary) html += `<p class="r-sum">${esc(r.summary)}</p>`;
  if (facts.length) {
    html += `<div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>`;
  }

  if (r.ingredients && r.ingredients.length) {
    html += '<h2 class="r-h">Продукти</h2><ul class="ing">';
    r.ingredients.forEach(function (g) {
      var note = g.note ? ` <small style="color:var(--muted)">(${esc(g.note)})</small>` : "";
      var brand = g.brand ? ` <span class="brand">${esc(g.brand)}</span>` : "";
      html += `
        <li><label>
          <input type="checkbox">
          <span class="q">${esc(g.qty || "")}</span>
          <span>${esc(g.item || "")}${brand}${note}</span>
        </label></li>`;
    });
    html += "</ul>";
  }

  if (r.steps && r.steps.length) {
    html += '<h2 class="r-h">Приготвяне</h2><ol class="steps">';
    r.steps.forEach(function (s) {
      var time = s.minutes ? `<small>≈ ${esc(s.minutes)} мин</small>` : "";
      html += `
        <li>
          <h4>${esc(s.title || "")}</h4>
          <p>${esc(s.text || "")}</p>
          ${time}
        </li>`;
    });
    html += "</ol>";
  }

  if (r.tips && r.tips.length) {
    html += '<h2 class="r-h">Съвети</h2><ul class="tips">';
    html += r.tips.map((t) => `<li>${esc(t)}</li>`).join("");
    html += "</ul>";
  }

  $("sheetContent").innerHTML = html;
}
