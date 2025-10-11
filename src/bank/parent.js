const HIDDEN_OPERATIONS = [
  'form-gift-custom',
  'form-gift-present',
  'form-icon-custom',
  'form-icon-present',
  'form-badge-custom',
  'form-badge-present',
  'form-bg-custom',
  'form-bg-present',
];


function formatBankOperations(operations) {
  let result = '';

  operations.forEach((op) => {
    const cleanId = op.form_id.replace(/^#/, '');
    const isHidden = HIDDEN_OPERATIONS.includes(cleanId);
    result += (isHidden) ? "[hide=9999999999]" : "";
    result += `[b]— ${op.title}[/b] = ${op.sum}\n`;

    // Добавляем form_id если он есть
    if (op.form_id) {
      result += `[size=9]form_id: ${op.form_id}[/size]\n`;
    }

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

    result += (isHidden) ? "[/hide]\n\n" : "\n\n";
  });

  return result.trim();
}

window.formatBankOperations = formatBankOperations;
