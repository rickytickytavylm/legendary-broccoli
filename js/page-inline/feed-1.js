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

  let activePostId = null;

  function updateCommentCount(postId, delta) {
    const post = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!post) return;
    const countEl = post.querySelector('[data-comment-count]');
    let count = parseInt(post.dataset.commentCount || '0', 10) + delta;
    if (count < 0) count = 0;
    post.dataset.commentCount = String(count);
    if (countEl) {
      countEl.textContent = String(count);
      countEl.classList.toggle('visible', count > 0);
    }
  }

  function appendCommentToUI(comment, isRealtime = false) {
    if (!comment || !comment.post_id) return;
    const sheetList = document.getElementById('comment-sheet-list');
    if (activePostId === comment.post_id && sheetList) {
      const existing = sheetList.querySelector(`[data-comment-id="${comment.id}"]`);
      if (existing) return;
      const div = document.createElement('div');
      div.className = 'comment-item';
      div.dataset.commentId = comment.id;
      div.innerHTML = `
        <strong>${escapeHtml(comment.author_name)}</strong>
        <span>${escapeHtml(comment.content)}</span>
        <span class="comment-time">${formatTime(comment.created_at)}</span>
      `;
      sheetList.appendChild(div);
      sheetList.scrollTop = sheetList.scrollHeight;
    }
    const post = document.querySelector(`.post-card[data-post-id="${comment.post_id}"]`);
    if (post && post.dataset.commentCount !== undefined) {
      updateCommentCount(comment.post_id, 1);
    }
  }

  function openCommentSheet(postId) {
    activePostId = postId;
    const overlay = document.getElementById('comment-sheet-overlay');
    const sheet = document.getElementById('comment-sheet');
    const list = document.getElementById('comment-sheet-list');
    const input = document.getElementById('comment-sheet-input');

    if (!overlay || !sheet) return;

    overlay.classList.remove('hidden');
    sheet.classList.remove('hidden');

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      sheet.classList.add('visible');
    });

    if (list) {
      list.innerHTML = '';
      list.scrollTop = 0;
    }

    if (window.API && list) {
      window.API.request('GET', `/content/feed/comments?post_id=${postId}`)
        .then((comments) => {
          if (!Array.isArray(comments)) return;
          list.innerHTML = '';
          comments.forEach((c) => appendCommentToUI(c));
          const post = document.querySelector(`.post-card[data-post-id="${postId}"]`);
          if (post) {
            post.dataset.commentCount = String(comments.length);
            updateCommentCount(postId, 0);
          }
        })
        .catch((err) => {
          console.error('[feed] Error loading comments:', err);
        });
    }

    if (input) setTimeout(() => input.focus(), 100);
  }

  function closeCommentSheet() {
    const overlay = document.getElementById('comment-sheet-overlay');
    const sheet = document.getElementById('comment-sheet');
    overlay?.classList.remove('visible');
    sheet?.classList.remove('visible');
    setTimeout(() => {
      overlay?.classList.add('hidden');
      sheet?.classList.add('hidden');
      activePostId = null;
    }, 300);
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

    // Comments button opens bottom sheet
    const commentButton = post.querySelector('[data-comment-button]');
    commentButton?.addEventListener('click', () => openCommentSheet(postId));
  });

  // Sheet close handlers
  document.getElementById('comment-sheet-overlay')?.addEventListener('click', closeCommentSheet);
  document.getElementById('comment-sheet-close')?.addEventListener('click', closeCommentSheet);

  // Sheet form submit
  document.getElementById('comment-sheet-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.API || !activePostId) return;
    const input = document.getElementById('comment-sheet-input');
    const content = input?.value.trim();
    if (!content) return;
    const submitBtn = document.getElementById('comment-sheet-submit');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const comment = await window.API.request('POST', '/content/feed/comments', {
        post_id: activePostId,
        content: content,
      });
      input.value = '';
      appendCommentToUI(comment);
    } catch (err) {
      console.error('[feed] Error submitting comment:', err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
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
