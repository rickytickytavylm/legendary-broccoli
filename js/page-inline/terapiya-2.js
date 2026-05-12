(async () => {
      const videoContainer = document.getElementById('video-container');
      const VIDEO_SLUG = 'Телесные практики/ Телесная практика по преодолению депрессии..mp4';

      function showLoader() {
        const vid = document.getElementById('course-video');
        if (vid) vid.setAttribute('controls', '');
        let loader = document.getElementById('video-loader');
        if (!loader) {
          loader = document.createElement('div');
          loader.id = 'video-loader';
          loader.className = 'video-loader';
          loader.innerHTML = '<div class="apple-spinner">' + '<span></span>'.repeat(8) + '</div>';
          videoContainer.appendChild(loader);
        }
        loader.classList.remove('hidden');
      }

      function hideLoader() {
        const loader = document.getElementById('video-loader');
        if (loader) loader.classList.add('hidden');
        const vid = document.getElementById('course-video');
        if (vid) vid.setAttribute('controls', '');
      }

      function captureFirstFrame(video) {
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = 0.1;
        }, { once: true });
        video.addEventListener('seeked', () => {
          try {
            const c = document.createElement('canvas');
            c.width = video.videoWidth || 1280;
            c.height = video.videoHeight || 720;
            c.getContext('2d').drawImage(video, 0, 0);
            const poster = c.toDataURL('image/jpeg', 0.8);
            if (poster && poster.length > 100) video.poster = poster;
          } catch(e) {}
        }, { once: true });
      }

      async function loadVideo() {
        try {
          showLoader();
          const video = document.getElementById('course-video');
          await window.attachVideoSource(video, VIDEO_SLUG);
          video.addEventListener('loadedmetadata', hideLoader, { once: true });
          video.addEventListener('canplay', hideLoader, { once: true });
          hideLoader();
        } catch(e) {
          hideLoader();
          const vid = document.getElementById('course-video');
          if (vid) vid.setAttribute('controls', '');
        }
      }

      if (window.setupVideoPreview) {
        window.setupVideoPreview(videoContainer, {
          poster: '/assets/webp/theraphy.webp',
          onStart: loadVideo,
        });
      } else {
        loadVideo();
      }
    })();
