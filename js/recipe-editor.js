/*
 * Формата за въвеждане и редакция на рецепта, запазването и изтриването ѝ.
 * Текстът от полетата се превръща в продукти и стъпки чрез parse.js.
 */

var DIFFICULTIES = ["Лесно", "Средно", "Трудно"];

// Показва формата. r = рецептата (или null за нова), dish = ястието, от което е отворена
function renderEditor(r, dish) {
  r = r || {};
  var title = r.title || (dish ? dish.name : "");
  var diff = r.difficulty || "Средно";
  var diffOptions = DIFFICULTIES.map(function (x) {
    return `<option${x === diff ? " selected" : ""}>${x}</option>`;
  }).join("");
  var forDish = dish
    ? `<p class="r-sum">За менюто: ${DAYS[dish.day].toLowerCase()}, ${MEAL_LABEL[dish.meal].toLowerCase()}</p>`
    : "";
  var deleteBtn = r.id
    ? '<button type="button" class="btn danger" id="deleteRecipe">Изтрий рецептата</button>'
    : "";

  $("sheetContent").innerHTML = `
    <form id="recipeForm" onsubmit="return false">
      <h1 class="r-title" id="rTitle">${r.id ? "Редакция на рецепта" : "Нова рецепта"}</h1>
      ${forDish}

      <div class="field">
        <label for="rfTitle">Име на рецептата</label>
        <input id="rfTitle" type="text" value="${esc(title)}" placeholder="напр. Мусака с кайма">
      </div>

      <div class="field">
        <label for="rfSum">Кратко описание</label>
        <input id="rfSum" type="text" value="${esc(r.summary || "")}" placeholder="по желание">
      </div>

      <div class="row3">
        <div class="field">
          <label for="rfServ">Порции</label>
          <input id="rfServ" type="number" inputmode="numeric" min="1" max="50" value="${esc(r.servings || 4)}">
        </div>
        <div class="field">
          <label for="rfPrep">Подготовка, мин</label>
          <input id="rfPrep" type="number" inputmode="numeric" min="0" value="${esc(r.prepMinutes || "")}">
        </div>
        <div class="field">
          <label for="rfCook">Готвене, мин</label>
          <input id="rfCook" type="number" inputmode="numeric" min="0" value="${esc(r.cookMinutes || "")}">
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label for="rfDiff">Трудност</label>
          <select id="rfDiff">${diffOptions}</select>
        </div>
        <div class="field">
          <label for="rfKcal">Калории на порция</label>
          <input id="rfKcal" type="number" inputmode="numeric" min="0" value="${esc(r.kcal || "")}" placeholder="по желание">
        </div>
      </div>

      <div class="field">
        <label for="rfIng">Продукти</label>
        <textarea id="rfIng" placeholder="500 г кайма&#10;2 бр. патладжани&#10;200 мл прясно мляко | марка: Верея">${esc(ingToText(r.ingredients))}</textarea>
        <p class="hint">По един продукт на ред, с количеството отпред. След черта: бележка или марка, например 200 мл мляко | топло | марка: Верея.</p>
      </div>

      <div class="field">
        <label for="rfSteps">Начин на приготвяне</label>
        <textarea id="rfSteps" style="min-height:200px" placeholder="Запържване: Задушете лука в олио до омекване (5 мин)&#10;Добавете каймата и разбъркайте">${esc(stepsToText(r.steps))}</textarea>
        <p class="hint">Всяка стъпка на нов ред. По желание: „Заглавие: описание“ и време накрая като (10 мин).</p>
      </div>

      <div class="field">
        <label for="rfTips">Съвети</label>
        <textarea id="rfTips" style="min-height:80px" placeholder="по един на ред, по желание">${esc((r.tips || []).join("\n"))}</textarea>
      </div>

      <div class="actions">
        <button type="button" class="btn" id="saveRecipe">Запази рецептата</button>
        <button type="button" class="btn ghost" id="cancelEdit">Отказ</button>
        ${deleteBtn}
      </div>
    </form>`;
}

// Взима число от поле (празно или грешно = 0)
function numberFrom(id) {
  return parseInt($(id).value, 10) || 0;
}

// Проверява и записва рецептата от формата
function saveRecipe() {
  var s = ui.sheet;
  if (!s) return;

  var title = $("rfTitle").value.trim();
  if (!title) return complain("Напиши име на рецептата.", "rfTitle");

  var sameName = findRecipeByName(title);
  if (sameName && sameName.id !== s.recipeId) return complain("Вече имаш рецепта с това име.", "rfTitle");

  var ingredients = parseIngredients($("rfIng").value);
  if (!ingredients.length) return complain("Добави поне един продукт.", "rfIng");

  var steps = parseSteps($("rfSteps").value);
  if (!steps.length) return complain("Добави поне една стъпка.", "rfSteps");

  var id = s.recipeId || uid();
  data.recipes[id] = {
    id: id,
    title: title,
    summary: $("rfSum").value.trim(),
    servings: numberFrom("rfServ"),
    prepMinutes: numberFrom("rfPrep"),
    cookMinutes: numberFrom("rfCook"),
    difficulty: $("rfDiff").value,
    kcal: numberFrom("rfKcal"),
    ingredients: ingredients,
    steps: steps,
    tips: lines($("rfTips").value),
    updatedAt: Date.now(),
  };

  // Свързва рецептата с ястието и с всички ястия със същото име, които нямат рецепта
  var dish = s.dishId ? findDish(s.dishId) : null;
  if (dish) dish.recipeId = id;
  data.dishes.forEach(function (d) {
    if (!d.recipeId && norm(d.name) === norm(title)) d.recipeId = id;
  });
  delete data.deleted[id];

  save(true);
  renderAll();
  openSheet({ mode: "view", recipeId: id, dishId: s.dishId });
  toast("Рецептата е запазена.");
}

// Показва съобщение и слага курсора в полето с проблема
function complain(message, fieldId) {
  toast(message);
  $(fieldId).focus();
}

function deleteRecipe() {
  var s = ui.sheet;
  if (!s || !s.recipeId) return;
  var r = data.recipes[s.recipeId];
  var question =
    "Да изтрия ли рецептата „" + (r ? r.title : "") + "“? Ястията в менюто остават, но без рецепта.";
  if (!confirm(question)) return;

  delete data.recipes[s.recipeId];
  data.deleted[s.recipeId] = Date.now(); // за да се изтрие и при другите (виж sync.js)
  data.dishes.forEach(function (d) {
    if (d.recipeId === s.recipeId) d.recipeId = null;
  });

  save(true);
  renderAll();
  closeSheet();
  toast("Рецептата е изтрита.");
}
