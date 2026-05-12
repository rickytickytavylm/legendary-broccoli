(function() {
  var target = document.documentElement.getAttribute('data-redirect-target') || '/';
  location.replace(target + location.search + location.hash);
})();
