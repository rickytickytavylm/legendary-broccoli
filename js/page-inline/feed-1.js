(function initFeedInteractions() {
  const likedKey = 'sistema:feed-liked-posts';

  function readLikedPosts() {
    try {
      const value = JSON.parse(localStorage.getItem(likedKey) || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveLikedPosts(set) {
    localStorage.setItem(likedKey, JSON.stringify(Array.from(set)));
  }

  function formatLikes(count) {
    return `Нравится: ${count}`;
  }

  const likedPosts = readLikedPosts();

  document.querySelectorAll('.post-card[data-post-id]').forEach((post) => {
    const postId = post.dataset.postId;
    const likeButton = post.querySelector('[data-like-button]');
    const likes = post.querySelector('[data-likes]');
    const baseLikes = Number(likes?.dataset.baseLikes || 0);

    function renderLike() {
      const isLiked = likedPosts.has(postId);
      likeButton?.classList.toggle('liked', isLiked);
      likeButton?.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
      if (likes) likes.textContent = formatLikes(baseLikes + (isLiked ? 1 : 0));
    }

    renderLike();

    likeButton?.addEventListener('click', () => {
      if (likedPosts.has(postId)) likedPosts.delete(postId);
      else likedPosts.add(postId);
      saveLikedPosts(likedPosts);
      renderLike();
    });
  });

  document.querySelectorAll('[data-share-button]').forEach((button) => {
    button.addEventListener('click', async () => {
      const post = button.closest('.post-card');
      if (!post) return;

      const url = new URL(window.location.href);
      url.hash = post.id || post.dataset.postId || '';
      const shareData = {
        title: post.dataset.shareTitle || 'Система Молодцова',
        text: post.dataset.shareText || 'Пост из ленты Системы Молодцова',
        url: url.toString(),
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareData.url);
        }
        button.classList.add('shared');
        button.setAttribute('aria-label', 'Ссылка готова');
        window.setTimeout(() => {
          button.classList.remove('shared');
          button.setAttribute('aria-label', 'Поделиться');
        }, 1200);
      } catch (e) {}
    });
  });

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
}());
