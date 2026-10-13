/*
 * Малки помощни функции, ползвани навсякъде.
 */

// Намира елемент от страницата по id
function $(id) {
  return document.getElementById(id);
}

// Защитава текст, преди да се покаже в страницата (за да не се чупи от символи като < и ")
function esc(text) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text == null ? "" : text).replace(/[&<>"']/g, (c) => map[c]);
}

// Уникален идентификатор за ново ястие или рецепта
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Текст за сравнение: без интервали в краищата и с малки букви
function norm(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

// Кратко съобщение долу на екрана
var toastTimer;
function toast(message) {
  var el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
window.appToast = toast; // ползва се и от Android приложението
