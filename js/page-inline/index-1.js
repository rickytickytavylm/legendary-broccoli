(function() {
  try {
    var schemaKey = 'sistema:onboarding-schema';
    var schema = 'device-v1';
    if (localStorage.getItem(schemaKey) !== schema) {
      localStorage.removeItem('sistema:onboarding-complete');
      localStorage.removeItem('sistema:onboarding-profile');
      localStorage.removeItem('sistema:intro-splash-seen');
    }
    var completed = localStorage.getItem('sistema:onboarding-complete') === 'true';
    document.documentElement.classList.remove('home-boot-today', 'home-boot-first-run');
    if (completed) document.documentElement.classList.add('home-boot-today');
    else document.documentElement.classList.add('home-boot-first-run');
  } catch (e) {
    document.documentElement.classList.remove('home-boot-today');
    document.documentElement.classList.add('home-boot-first-run');
  }
})();
