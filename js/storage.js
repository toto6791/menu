/*
 * Данните на приложението и записът им в паметта на телефона (localStorage).
 *   data – всички рецепти и менюто за седмицата
 *   ui   – какво е отворено в момента (раздел, ден, рецепта)
 * Тук са и функциите за търсене в данните (ястия за ден, рецепта по име и т.н.).
 *
 * Как изглеждат данните:
 *   data.weekLabel  – заглавие на седмицата
 *   data.dishes     – ястията в менюто: { id, day (0 = понеделник), meal, name, recipeId }
 *   data.recipes    – рецептите по id: { id, title, ingredients, steps, tips, … }
 *   data.deleted    – изтрити рецепти (нужно е за синхронизацията)
 *   data.bought     – отметнатите продукти в списъка за пазар (виж shopping.js)
 */

// Празни данни за първото отваряне
function blank() {
  return {
    weekLabel: "",
    dishes: [],
    recipes: {},
    deleted: {},
    menuUpdatedAt: 0,
    bought: { week: {}, all: {} },
    boughtUpdatedAt: 0,
  };
}

// Проверка, че данните имат правилния вид
function valid(v) {
  return v && Array.isArray(v.dishes) && v.recipes && typeof v.recipes === "object";
}

// Зарежда данните от паметта на телефона
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY));
    if (valid(v)) {
      v.deleted = v.deleted || {};
      v.menuUpdatedAt = v.menuUpdatedAt || 0;
      v.bought = v.bought || { week: {}, all: {} };
      v.boughtUpdatedAt = v.boughtUpdatedAt || 0;
      return v;
    }
  } catch (e) {}
  return blank();
}

// Записва данните. menuChanged = true, ако е променено менюто (не само рецепта).
function save(menuChanged) {
  if (menuChanged) data.menuUpdatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    toast("Не успях да запиша. Паметта на телефона може да е пълна.");
  }
  if (window.syncSoon) window.syncSoon(); // изпраща промените в GitHub (виж sync.js)
}

// Молим браузъра да не трие данните при липса на място
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(function () {});
}

var data = load();
var ui = {
  tab: "menu",
  day: (new Date().getDay() + 6) % 7, // днешният ден, с понеделник = 0
  sheet: null, // отворената рецепта: { mode: "view" | "edit", recipeId, dishId }
  search: "",
  shopMode: "week", // списък за пазар: "week" = тази седмица, "all" = всички рецепти
};

/* ---- Търсене в данните ---- */

// Ястията за даден ден
function dishesFor(day) {
  return data.dishes.filter(function (x) {
    return x.day === day;
  });
}

// Рецептата на дадено ястие (или null)
function recipeOf(dish) {
  return dish && dish.recipeId ? data.recipes[dish.recipeId] : null;
}

function findDish(id) {
  return (
    data.dishes.find(function (d) {
      return d.id === id;
    }) || null
  );
}

// Рецепта по име, без значение от малки и главни букви
function findRecipeByName(name) {
  var n = norm(name);
  if (!n) return null;
  for (var id in data.recipes) {
    if (norm(data.recipes[id].title) === n) return data.recipes[id];
  }
  return null;
}

// Всички рецепти по азбучен ред
function sortedRecipes() {
  return Object.values(data.recipes).sort(function (a, b) {
    return a.title.localeCompare(b.title, "bg");
  });
}

// Поредният номер на храненето (за подреждане: закуска, обяд, вечеря…)
function mealIndex(meal) {
  var i = MEALS.findIndex(function (m) {
    return m[0] === meal;
  });
  return i < 0 ? 99 : i;
}
