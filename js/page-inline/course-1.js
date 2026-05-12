(function () {
      var params = new URLSearchParams(location.search);
      var slug = (params.get('slug') || '').toLowerCase();
      if (!slug) location.replace('/courses/');
      var map = {
        'marafony': '/marathons/',
        'marathon': '/marathons/',
        'marathons': '/marathons/',
        'yoga': '/yoga/',
        'gipnoz': '/gipnoz/',
        'hypnoz': '/gipnoz/',
        'dermer': '/dermer/',
        'psihosomatika': '/psihosomatika/',
        'psychosomatika': '/psihosomatika/',
        'superviziya': '/superviziya/',
        'supervision': '/superviziya/',
        'telesnaya': '/terapiya/',
        'terapiya': '/terapiya/',
        'geshtalt': '/geshtalt/',
        'master': '/master/',
        'masterofcommication': '/master/',
        'antologiya': '/antologiya/',
        'anthology': '/antologiya/',
        'sozavisimost': '/sozavisimost/',
        'codependency': '/sozavisimost/',
        'mj': '/mj/',
        'manzhen': '/mj/'
      };
      if (map[slug]) { location.replace(map[slug]); }
    })();
