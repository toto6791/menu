/*
 * Свързва всичко: реакции на бутоните, добавяне на ястия, бутонът „Назад“ на Android
 * и стартирането на приложението. Този файл се зарежда последен.
 */

/* ---- Бутони с id: какво прави всеки ---- */

var ACTIONS = {
  // долното меню
  tMenu: () => setTab("menu"),
  tShop: () => setTab("shop"),
  tRecipes: () => setTab("recipes"),
  tPlan: () => setTab("plan"),

  // прозорецът с рецептата
  closeSheet: closeSheet,
  editBtn: function () {
    ui.sheet.mode = "edit";
    renderSheet();
    $("sheet").scrollTop = 0;
  },
  saveRecipe: saveRecipe,
  deleteRecipe: deleteRecipe,
  cancelEdit: function () {
    if (ui.sheet.recipeId) {
      ui.sheet.mode = "view";
      renderSheet();
    } else closeSheet();
  },
  newRecipe: () => openSheet({ mode: "edit", recipeId: null, dishId: null }),

  // планиране
  addBtn: addDish,
  clearWeek: clearWeek,

  // списък за пазар (shopping.js)
  shopWeek: () => setShopMode("week"),
  shopAll: () => setShopMode("all"),
  shopCopy: copyShopping,
  shopClear: function () {
    if (confirm("Да махна ли всички отметки в този списък?")) clearBought();
  },

  // архив
  exportBtn: exportData,
  importBtn: function () {
    $("importFile").value = "";
    $("importFile").click();
  },

  // GitHub
  gSave: function () {
    syncCfgSave({
      owner: $("gOwner").value.trim(),
      repo: $("gRepo").value.trim(),
      token: $("gToken").value.trim(),
    });
    sync.lastError = "";
    toast("Настройките са запазени.");
    runSync(true);
  },
  gSync: () => runSync(true),
};

/* ---- Едно място, което хваща всички натискания ---- */

document.addEventListener("click", function (ev) {
  var btn = ev.target.closest("button");
  if (!btn) return;
  var ds = btn.dataset;

  // ден от лентата
  if (ds.day != null) {
    ui.day = +ds.day;
    renderDays();
    renderDay();
    return;
  }

  // ястие в менюто: показва рецептата или формата, ако още няма рецепта
  if (ds.dish) return openDish(ds.dish);
  if (ds.planEdit) return openDish(ds.planEdit);

  // рецепта от списъка
  if (ds.recipe) return openSheet({ mode: "view", recipeId: ds.recipe, dishId: null });

  // премахване на ястие от менюто
  if (ds.del) return removeDish(ds.del);

  if (ACTIONS[btn.id]) ACTIONS[btn.id]();
});

/* ---- Действия с менюто ---- */

function openDish(dishId) {
  var dish = findDish(dishId);
  var r = recipeOf(dish);
  if (r) openSheet({ mode: "view", recipeId: r.id, dishId: dish.id });
  else openSheet({ mode: "edit", recipeId: null, dishId: dish.id });
}

function addDish() {
  var name = $("aName").value.trim();
  if (!name) {
    $("aName").focus();
    toast("Напиши името на ястието.");
    return;
  }
  var r = findRecipeByName(name); // ако има рецепта с това име, свързваме я
  data.dishes.push({
    id: uid(),
    day: +$("aDay").value,
    meal: $("aMeal").value,
    name: r ? r.title : name,
    recipeId: r ? r.id : null,
  });
  save(true);
  $("aName").value = "";
  renderAll();
  toast(r ? "Добавено, с рецепта." : "Добавено. Рецептата можеш да въведеш по-късно.");
}

function removeDish(dishId) {
  var dish = findDish(dishId);
  if (!confirm("Да махна ли „" + (dish ? dish.name : "") + "“ от менюто? Рецептата остава.")) return;
  data.dishes = data.dishes.filter((x) => x.id !== dishId);
  save(true);
  renderAll();
}

function clearWeek() {
  if (!data.dishes.length) return;
  if (!confirm("Да изчистя ли менюто за седмицата? Рецептите остават.")) return;
  data.dishes = [];
  data.weekLabel = "";
  data.bought.week = {}; // новата седмица започва с чист списък за пазар
  data.boughtUpdatedAt = Date.now();
  save(true);
  renderAll();
  toast("Менюто е изчистено.");
}

/* ---- Полета ---- */

// Отметка „купено“ в списъка за пазар
document.addEventListener("change", function (e) {
  if (e.target.dataset && e.target.dataset.buy != null) toggleBought(e.target.dataset.buy);
});

// Enter в полето за ястие = „Добави“
$("aName").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    addDish();
  }
});

// Заглавието на седмицата се записва половин секунда след като спреш да пишеш
var labelTimer;
$("wLabel").addEventListener("input", function () {
  data.weekLabel = $("wLabel").value;
  renderHeader();
  clearTimeout(labelTimer);
  labelTimer = setTimeout(() => save(true), 500);
});

$("rSearch").addEventListener("input", function () {
  ui.search = this.value;
  renderRecipes();
});

// Избран файл за възстановяване от архив
$("importFile").addEventListener("change", function () {
  var file = this.files && this.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = () => importText(String(reader.result));
  reader.onerror = () => toast("Не успях да прочета файла.");
  reader.readAsText(file);
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && ui.sheet) closeSheet();
});

// Бутонът „Назад“ на Android (вика се от MainActivity.java).
// Връща true, ако е затворил нещо, и false, ако приложението трябва да се затвори.
window.appBack = function () {
  if (ui.sheet) {
    if (ui.sheet.mode === "edit" && ui.sheet.recipeId) {
      ui.sheet.mode = "view";
      renderSheet();
    } else closeSheet();
    return true;
  }
  if (ui.tab !== "menu") {
    setTab("menu");
    return true;
  }
  return false;
};

/* ---- Старт ---- */

$("aDay").innerHTML = DAYS.map((name, i) => `<option value="${i}">${name}</option>`).join("");
$("aDay").value = String(ui.day);
$("aMeal").innerHTML = MEALS.map((m) => `<option value="${m[0]}">${m[1]}</option>`).join("");
$("aMeal").value = "lunch";

renderAll();
fillSyncForm();
setSyncStatus();
runSync(false);

// Офлайн режим за уеб версията (в Android приложението не е нужен)
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
