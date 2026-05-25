(function initFeedInteractions() {
  const likedKey = 'sistema:feed-liked-posts';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(createdAt) {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
  }

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

  // ── Sockets Real-Time Setup ──
  let socket = null;
  if (window.io && window.API) {
    try {
      const socketOrigin = new URL(window.API.base, location.href).origin;
      socket = window.io(socketOrigin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });

      socket.on('feed:comment:created', (comment) => {
        appendCommentToUI(comment, true);
      });
    } catch (e) {
      console.warn('[feed] Real-time connection error:', e);
    }
  }

  function appendCommentToUI(comment, isRealtime = false) {
    if (!comment || !comment.post_id) return;
    const postEl = document.querySelector(`.post-card[data-post-id="${comment.post_id}"]`);
    if (!postEl) return;

    const listEl = postEl.querySelector('[data-comments-list]');
    if (!listEl) return;

    // Check if duplicate
    const existing = listEl.querySelector(`[data-comment-id="${comment.id}"]`);
    if (existing) return;

    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = comment.id;
    div.innerHTML = `
      <strong>${escapeHtml(comment.author_name)}</strong>
      <span>${escapeHtml(comment.content)}</span>
      <span class="comment-time">${formatTime(comment.created_at)}</span>
    `;

    listEl.appendChild(div);

    // Scroll to bottom
    listEl.scrollTop = listEl.scrollHeight;
  }

  // ── Post Card Setup ──
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

    // ── Comments Setup inside each post ──
    const commentForm = post.querySelector('[data-comment-form]');
    const commentInput = post.querySelector('[data-comment-input]');
    const commentsList = post.querySelector('[data-comments-list]');

    // 1. Initial Load of Comments
    if (window.API && commentsList) {
      window.API.request('GET', `/content/feed/comments?post_id=${postId}`)
        .then((comments) => {
          if (Array.isArray(comments)) {
            commentsList.innerHTML = '';
            comments.forEach((c) => appendCommentToUI(c));
          }
        })
        .catch((err) => {
          console.error('[feed] Error loading comments:', err);
        });
    }

    // 2. Submit new comment
    commentForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.API || !commentInput) return;

      const content = commentInput.value.trim();
      if (!content) return;

      // Disable submission while sending
      const submitBtn = commentForm.querySelector('[data-comment-submit]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const comment = await window.API.request('POST', '/content/feed/comments', {
          post_id: postId,
          content: content,
        });

        // Clear input
        commentInput.value = '';

        // Local append (in case of delay/offline socket, though socket will filter duplicates anyway)
        appendCommentToUI(comment);
      } catch (err) {
        console.error('[feed] Error submitting comment:', err);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-share-button]').forEach((button) => {
    button.addEventListener('click', async () => {
      const post = button.closest('.post-card');
      if (!post) return;

      const url = new URL(window.location.href);
      url.hash = post.id || post.dataset.postId || '';
      const shareData = {
        title: post.dataset.shareTitle || 'Система Молодцов',
        text: post.dataset.shareText || 'Пост из ленты Системы Молодцов',
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
