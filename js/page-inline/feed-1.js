document.querySelectorAll('.post-expand-link').forEach((button) => {
      const caption = button.previousElementSibling;
      if (!caption || !caption.classList.contains('post-caption')) return;
      if (caption.textContent.trim().length < 180) {
        button.remove();
        return;
      }
      caption.classList.add('is-collapsed');
      button.addEventListener('click', () => {
        const expanded = button.dataset.expanded === 'true';
        button.dataset.expanded = expanded ? 'false' : 'true';
        caption.classList.toggle('is-collapsed', expanded);
        button.textContent = expanded ? 'Развернуть весь текст' : 'Свернуть текст';
      });
    });
