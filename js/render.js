/*
 * Изрисуване на екраните: лентата с дните, менюто за деня,
 * списъкът с рецепти и разделът „Планиране“, както и превключването между разделите.
 */

// Заглавието на седмицата най-горе
function renderHeader() {
  $("weekLabel").textContent = data.weekLabel || "Седмично меню";
}

// Лентата с дните Пн … Нд
function renderDays() {
  $("days").innerHTML = DAYS.map(function (name, i) {
    var hasDishes = dishesFor(i).length ? " has" : "";
    return `
      <button class="day${hasDishes}" aria-pressed="${i === ui.day}" data-day="${i}" aria-label="${name}">
        <b>${SHORT[i]}</b><i></i>
      </button>`;
  }).join("");
}

// Ястията за избрания ден, групирани по хранене
function renderDay() {
  $("dayName").textContent = DAYS[ui.day];
  var list = dishesFor(ui.day);

  if (!list.length) {
    $("dayContent").innerHTML = '<div class="empty">Няма ястия за този ден. Добави ги от „Планиране“.</div>';
    return;
  }

  var html = "";
  MEALS.forEach(function (meal) {
    var dishes = list.filter(function (x) {
      return x.meal === meal[0];
    });
    if (!dishes.length) return;

    html += `<div class="meal"><h3>${meal[1]}</h3>`;
    dishes.forEach(function (dish) {
      var r = recipeOf(dish);
      var total = r ? (r.prepMinutes || 0) + (r.cookMinutes || 0) : 0;
      var time = total ? `<small>${total} мин общо</small>` : "";
      var state = r
        ? '<span class="state ready">Рецепта ›</span>'
        : '<span class="state">Въведи рецепта ›</span>';
      html += `
        <button class="dish" data-dish="${esc(dish.id)}">
          <span class="name">${esc(dish.name)}${time}</span>
          ${state}
        </button>`;
    });
    html += "</div>";
  });
  $("dayContent").innerHTML = html;
}

// Раздел „Рецепти“: списък с търсене
function renderRecipes() {
  var box = $("recipeList");
  if (!Object.keys(data.recipes).length) {
    box.innerHTML = '<div class="empty">Още нямаш рецепти. Натисни „Нова“, за да въведеш първата.</div>';
    return;
  }

  var q = norm(ui.search);
  var list = sortedRecipes().filter(function (r) {
    return !q || norm(r.title).indexOf(q) > -1;
  });
  if (!list.length) {
    box.innerHTML = `<div class="empty">Няма рецепта, която съдържа „${esc(ui.search)}“.</div>`;
    return;
  }

  // кои рецепти са в менюто тази седмица
  var used = {};
  data.dishes.forEach(function (d) {
    if (d.recipeId) used[d.recipeId] = true;
  });

  box.innerHTML = list
    .map(function (r) {
      var meta = [];
      if (r.prepMinutes || r.cookMinutes) meta.push((r.prepMinutes || 0) + (r.cookMinutes || 0) + " мин");
      if (r.servings) meta.push(r.servings + " порции");
      if (used[r.id]) meta.push("в менюто тази седмица");
      var small = meta.length ? `<small>${esc(meta.join(", "))}</small>` : "";
      return `
      <button class="dish" data-recipe="${esc(r.id)}">
        <span class="name">${esc(r.title)}${small}</span>
        <span class="state">›</span>
      </button>`;
    })
    .join("");
}

// Раздел „Планиране“: списъкът с ястия за седмицата
function renderPlan() {
  if (document.activeElement !== $("wLabel")) $("wLabel").value = data.weekLabel || "";

  // предложения при писане на име на ястие
  $("recipeNames").innerHTML = sortedRecipes()
    .map(function (r) {
      return `<option value="${esc(r.title)}"></option>`;
    })
    .join("");

  var sorted = data.dishes.slice().sort(function (a, b) {
    return a.day - b.day || mealIndex(a.meal) - mealIndex(b.meal);
  });

  if (!sorted.length) {
    $("planList").innerHTML =
      '<li><div class="meta" style="color:var(--muted)">Менюто е празно. Добави първото ястие отгоре.</div></li>';
    return;
  }

  $("planList").innerHTML = sorted
    .map(function (dish) {
      var r = recipeOf(dish);
      var when = DAYS[dish.day] + ", " + MEAL_LABEL[dish.meal].toLowerCase() + (r ? "" : ", без рецепта");
      return `
      <li>
        <div class="meta">${esc(dish.name)}<small>${when}</small></div>
        <span class="btns">
          <button class="icon" data-plan-edit="${esc(dish.id)}">${r ? "Рецепта" : "Въведи"}</button>
          <button class="icon del" data-del="${esc(dish.id)}" aria-label="Премахни ${esc(dish.name)}">Премахни</button>
        </span>
      </li>`;
    })
    .join("");
}

// Обновява всички екрани наведнъж
function renderAll() {
  renderHeader();
  renderDays();
  renderDay();
  renderRecipes();
  renderPlan();
}

// Превключване между „Меню“, „Рецепти“ и „Планиране“
var TAB_TITLES = {
  menu: "Какво готвим тази седмица",
  recipes: "Моите рецепти",
  plan: "Планиране",
};

function setTab(tab) {
  ui.tab = tab;
  $("viewMenu").hidden = tab !== "menu";
  $("viewRecipes").hidden = tab !== "recipes";
  $("viewPlan").hidden = tab !== "plan";
  $("tMenu").setAttribute("aria-selected", tab === "menu");
  $("tRecipes").setAttribute("aria-selected", tab === "recipes");
  $("tPlan").setAttribute("aria-selected", tab === "plan");
  $("appTitle").textContent = TAB_TITLES[tab];
  window.scrollTo(0, 0);
}
