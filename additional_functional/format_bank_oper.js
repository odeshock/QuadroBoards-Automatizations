function formatOperations(operations) {
  let result = '';

  operations.forEach((op, i) => {
    result += `[b]— ${op.title}[/b] — ${op.sum}\n`;

    // проверяем, есть ли info и comment
    const info = op.info?.[0];
    if (!info) {
      result += '\n\n';
      return;
    }

    const { comment, type } = info;

    if (Array.isArray(comment)) {
      if (!type || type === 'comment') {
        // просто комментарии без типа
        result += '\n\n';
      } else if (type === 'plain') {
        result += comment.join('\n') + '\n\n';
      } else if (type === 'list') {
        result += comment
          .map((c, idx) => `${idx + 1}. ${c}`)
          .join('\n') + '\n\n';
      } else {
        // неизвестный тип — просто выводим как есть
        result += comment.join('\n') + '\n\n';
      }
    } else {
      result += '\n\n';
    }
  });

  return result.trim();
}

window.formatOperations = formatOperations;
