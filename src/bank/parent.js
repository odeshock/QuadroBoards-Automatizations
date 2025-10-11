const HIDDEN_OPERATIONS = [
  "Подарок из коллекции",
  "Индивидуальная иконка",
  "Иконка из коллекции",
  "Индивидуальная плашка",
  "Плашка из коллекции",
  "Индивидуальный фон",
  "Фон из коллекции",
  "Отказ от персонажа",
];


function formatBankOperations(operations) {
  let result = '';

  operations.forEach((op, i) => {
    const hidden = HIDDEN_OPERATIONS.some(prefix => op.title.startsWith(prefix));
    result += (hidden) ? "[hide=9999999999]" : "";
    result += `[b]— ${op.title}[/b] = ${op.sum}\n`;

    // проверяем, есть ли info и comment
    const info = op.info?.[0];
    if (!info) {
      result += '\n\n';
      return;
    }

    const { comment, type } = info;

    if (Array.isArray(comment)) {
      if (type === 'plain') {
        result += comment.join('\n');
      } else if (type === 'list') {
        result += comment
          .map((c, idx) => `${idx + 1}. ${c}`)
          .join('\n');
      } else if (type === 'list separated') {
        result += comment
          .map((c, idx) => `${idx + 1}. ${c}`)
          .join('\n\n');
      } else if (type) {
        // неизвестный тип — просто выводим как есть
        result += comment.join('\n');
      }
    }

    result += (hidden) ? "[/hide]\n\n" : "\n\n";
  });

  return result.trim();
}

window.formatBankOperations = formatBankOperations;
