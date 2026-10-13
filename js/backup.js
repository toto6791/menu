/*
 * Архив на данните: запазване във файл и възстановяване от файл.
 * В Android приложението записът минава през AndroidBridge (MainActivity.java).
 */

function exportData() {
  var now = new Date();
  var date = now.toISOString().slice(0, 10); // например 2026-10-13
  var fileName = "menu-arhiv-" + date + ".json";
  var json = JSON.stringify(
    { app: "sedmichno-menu", version: 1, exportedAt: now.toISOString(), data: data },
    null,
    1,
  );

  // В Android приложението
  if (window.AndroidBridge && window.AndroidBridge.saveBackup) {
    window.AndroidBridge.saveBackup(json, fileName);
    return;
  }

  // В браузъра: изтегля файла
  var link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 1000);
  toast("Архивът е запазен в Изтегляния.");
}

// Възстановява данните от съдържанието на архивен файл
function importText(text) {
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return toast("Файлът не е валиден архив.");
  }

  var incoming = parsed && parsed.data ? parsed.data : parsed;
  if (!valid(incoming)) return toast("Файлът не е архив от това приложение.");

  var recipeCount = Object.keys(incoming.recipes).length;
  var question = `Архивът съдържа ${recipeCount} рецепти и ${incoming.dishes.length} ястия в менюто. Да заменя ли текущите данни с тях?`;
  if (!confirm(question)) return;

  // маркираме всичко като ново, за да се качи и в GitHub
  var now = Date.now();
  Object.values(incoming.recipes).forEach((r) => (r.updatedAt = now));

  data = {
    weekLabel: incoming.weekLabel || "",
    dishes: incoming.dishes,
    recipes: incoming.recipes,
    deleted: {},
    menuUpdatedAt: now,
  };
  save(true);
  renderAll();
  toast("Данните са възстановени.");
}
