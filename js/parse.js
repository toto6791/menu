/*
 * Превръща текста от формата в продукти и стъпки и обратно.
 *   „500 г кайма | смляна“              →  количество: 500 г, продукт: кайма, бележка: смляна
 *   „Запържване: Задушете лука (5 мин)“  →  заглавие, описание, 5 минути
 */

// Количество в началото на реда: число и по желание мерна единица.
// Ако искаш да се разпознават нови мерни единици, добави ги тук, разделени с |
var UNITS = [
  "г",
  "гр",
  "кг",
  "мл",
  "л",
  "ч\\.\\s?л\\.?",
  "с\\.\\s?л\\.?",
  "ч\\.\\s?ч\\.?",
  "к\\.\\s?ч\\.?",
  "бр\\.?",
  "скилидк[аи]",
  "щипк[аи]",
  "пакет[че]*",
  "глав[аи]",
  "връзк[аи]",
  "филийк[аи]",
];
var QTY = new RegExp("^([\\d.,/½¼¾–-]+\\s*(?:" + UNITS.join("|") + ")?\\.?)\\s+(.+)$", "i");

// Разделя текст на редове и маха празните
function lines(text) {
  return text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ---- Продукти ---- */

// Текст от полето → списък с продукти
function parseIngredients(text) {
  return lines(text)
    .map(function (line) {
      var parts = line.split("|");
      var main = parts[0].trim();
      var note = parts.slice(1).join("|").trim();
      var m = main.match(QTY);
      if (m) return { qty: m[1].trim(), item: m[2].trim(), note: note };
      return { qty: "", item: main, note: note };
    })
    .filter((g) => g.item || g.qty);
}

// Списък с продукти → текст за полето (при редакция)
function ingToText(list) {
  return (list || [])
    .map(function (g) {
      var line = (g.qty ? g.qty + " " : "") + (g.item || "");
      if (g.note) line += " | " + g.note;
      return line.trim();
    })
    .join("\n");
}

/* ---- Стъпки ---- */

// Текст от полето → списък със стъпки
function parseSteps(text) {
  return lines(text).map(function (line) {
    // време в скоби накрая, например (10 мин)
    var minutes = 0;
    var time = line.match(/\((\d+)\s*мин\.?\)\s*$/i);
    if (time) {
      minutes = +time[1];
      line = line.slice(0, time.index).trim();
    }
    // заглавие преди двоеточие, например „Запържване: …“
    var titled = line.match(/^([^:]{2,40}):\s+(.+)$/);
    if (titled) return { title: titled[1].trim(), text: titled[2], minutes: minutes };
    return { title: "", text: line, minutes: minutes };
  });
}

// Списък със стъпки → текст за полето (при редакция)
function stepsToText(list) {
  return (list || [])
    .map(function (s) {
      var line = (s.title ? s.title + ": " : "") + (s.text || "");
      if (s.minutes) line += " (" + s.minutes + " мин)";
      return line;
    })
    .join("\n");
}
