if (window.ProgramCatalog) {
  window.ProgramCatalog.renderGrid('#program-grid');
  window.ProgramCatalog.setupSearch({
    input: '#program-search',
    grid: '#program-grid',
    empty: '#program-search-empty',
    title: '#program-section-title',
    desc: '#program-section-desc',
  });
}

(() => {
  const shell = document.querySelector('.programs-search-shell');
  if (!shell) return;
  let lastY = window.scrollY;
  let settleTimer = null;
  let ticking = false;

  function showSearch() {
    document.body.classList.remove('programs-search-hidden');
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const movingDown = currentY > lastY + 2;
      const nearTop = currentY < 18;
      document.body.classList.toggle('programs-search-hidden', movingDown && !nearTop);
      lastY = currentY;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(showSearch, 520);
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  document.getElementById('program-search')?.addEventListener('focus', showSearch);
})();
