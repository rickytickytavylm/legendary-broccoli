(function redirectLegacyChat() {
  var route = 'relationships';
  var yogaClub = 'https://t.me/+P3saVqIBL8gzZTIy';
  var keys = ['calm', 'body', 'relationships', 'selfworth', 'selfstudy', 'communication'];
  try {
    var profile = JSON.parse(localStorage.getItem('sistema:onboarding-profile') || '{}');
    if (keys.indexOf(profile.focus) !== -1) route = profile.focus;
    else if (keys.indexOf(profile.routeKey) !== -1) route = profile.routeKey;
  } catch (e) {}
  if (route === 'calm') location.replace(yogaClub);
  else location.replace('/therapy-group/?route=' + encodeURIComponent(route));
})();
