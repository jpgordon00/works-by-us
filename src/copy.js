for (const button of document.querySelectorAll('[data-copy]')) {
  const target = document.getElementById(button.dataset.copy);
  const original = button.textContent;
  button.addEventListener('click', async () => {
    const text = target.value ?? target.textContent;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
      button.nextElementSibling.textContent = 'Copied to clipboard.';
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch {
      target.hidden = false;
      const selection = window.getSelection();
      if (typeof target.select === 'function') {
        target.focus();
        target.select();
      } else {
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      button.nextElementSibling.textContent = 'Text selected. Use your browser’s copy command.';
    }
  });
}
