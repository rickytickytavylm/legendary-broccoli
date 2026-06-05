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
  const seenCommentIds = new Map();
  let activeReplyComment = null;

  function seenForPost(postId) {
    if (!seenCommentIds.has(postId)) seenCommentIds.set(postId, new Set());
    return seenCommentIds.get(postId);
  }

  function markCommentSeen(comment) {
    if (!comment || !comment.post_id || !comment.id) return true;
    const seen = seenForPost(comment.post_id);
    const key = String(comment.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }

  function renderCommentAvatar(comment) {
    if (comment?.avatar_url) {
      return `<img src="${escapeHtml(comment.avatar_url)}" alt="" loading="lazy" decoding="async" />`;
    }
    return escapeHtml((comment?.author_name || 'У').trim().slice(0, 1).toUpperCase() || 'У');
  }

  function renderCommentItem(comment) {
    const replyHtml = comment.reply_to ? `
      <button type="button" class="comment-reply-preview" data-scroll-comment="${escapeHtml(comment.reply_to.id)}">
        <strong>${escapeHtml(comment.reply_to.author_name || 'Гость')}</strong>
        <span>${escapeHtml(comment.reply_to.content || '').slice(0, 110)}</span>
      </button>
    ` : '';
    const reactions = Array.isArray(comment.reactions) ? comment.reactions : [];
    const reactionsHtml = reactions.length ? `
      <div class="comment-reactions">
        ${reactions.map((reaction) => `
          <button type="button" class="comment-reaction-chip${reaction.reacted_by_me ? ' active' : ''}" data-comment-reaction="${escapeHtml(reaction.emoji)}">
            <span>${escapeHtml(reaction.emoji)}</span><strong>${Number(reaction.count) || 0}</strong>
          </button>
        `).join('')}
      </div>
    ` : '';
    return `
      <div class="comment-avatar" aria-hidden="true">${renderCommentAvatar(comment)}</div>
      <div class="comment-body">
        ${replyHtml}
        <div class="comment-line">
          <strong>${escapeHtml(comment.author_name)}</strong>
          <span>${escapeHtml(comment.content)}</span>
        </div>
        <div class="comment-actions">
          <span class="comment-time">${formatTime(comment.created_at)}</span>
          <button type="button" data-comment-reply>Ответить</button>
          ${['❤️', '👍', '🔥'].map((emoji) => `<button type="button" data-comment-reaction="${emoji}">${emoji}</button>`).join('')}
        </div>
        ${reactionsHtml}
      </div>
    `;
  }

  function renderCommentNode(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = comment.id;
    div.innerHTML = renderCommentItem(comment);
    return div;
  }

  function updateCommentReplyBanner() {
    const wrap = document.getElementById('comment-reply-banner');
    const name = document.getElementById('comment-reply-name');
    const text = document.getElementById('comment-reply-text');
    if (!wrap) return;
    if (!activeReplyComment) {
      wrap.classList.add('hidden');
      return;
    }
    if (name) name.textContent = activeReplyComment.author_name || 'Гость';
    if (text) text.textContent = String(activeReplyComment.content || '').slice(0, 120);
    wrap.classList.remove('hidden');
  }

  function setCommentReply(comment) {
    activeReplyComment = comment || null;
    updateCommentReplyBanner();
    document.getElementById('comment-sheet-input')?.focus();
  }

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
      socket.on('feed:comment:reactions', (payload) => {
        if (!payload || !payload.comment_id) return;
        document.querySelectorAll(`[data-comment-id="${payload.comment_id}"]`).forEach((node) => {
          const comment = node.__feedComment || {};
          comment.reactions = payload.reactions || [];
          node.__feedComment = comment;
          node.innerHTML = renderCommentItem(comment);
        });
      });
    } catch (e) {
      console.warn('[feed] Real-time connection error:', e);
    }
  }

  let activePostId = null;
  let savedBodyStyles = null;
  let savedScrollY = 0;

  function lockFeedScroll() {
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    savedBodyStyles = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      bodyTouchAction: document.body.style.touchAction,
    };
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'pan-y';
  }

  function unlockFeedScroll() {
    if (savedBodyStyles) {
      document.documentElement.style.overflow = savedBodyStyles.htmlOverflow;
      document.documentElement.style.overscrollBehavior = savedBodyStyles.htmlOverscrollBehavior;
      document.body.style.position = savedBodyStyles.bodyPosition;
      document.body.style.top = savedBodyStyles.bodyTop;
      document.body.style.left = savedBodyStyles.bodyLeft;
      document.body.style.right = savedBodyStyles.bodyRight;
      document.body.style.width = savedBodyStyles.bodyWidth;
      document.body.style.overflow = savedBodyStyles.bodyOverflow;
      document.body.style.overscrollBehavior = savedBodyStyles.bodyOverscrollBehavior;
      document.body.style.touchAction = savedBodyStyles.bodyTouchAction;
      savedBodyStyles = null;
      window.scrollTo(0, savedScrollY);
    }
  }

  function updateCommentCount(postId, delta) {
    const post = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!post) return;
    const countEl = post.querySelector('[data-comment-count]');
    const viewAllBtn = post.querySelector('[data-view-comments-btn]');
    let count = parseInt(post.dataset.commentCount || '0', 10) + delta;
    if (count < 0) count = 0;
    post.dataset.commentCount = String(count);
    
    if (countEl) {
      countEl.textContent = String(count);
      countEl.classList.toggle('visible', count > 0);
    }
    if (viewAllBtn) {
      viewAllBtn.textContent = `Посмотреть все комментарии (${count})`;
      viewAllBtn.classList.toggle('hidden', count <= 2);
    }
  }

  function renderPostCommentsPreview(postId, comments) {
    const post = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    if (!post) return;
    post.dataset.commentCount = String(comments.length);
    seenForPost(postId).clear();
    comments.forEach(markCommentSeen);
    updateCommentCount(postId, 0);
  }

  function appendCommentToUI(comment, isRealtime = false) {
    if (!comment || !comment.post_id) return;
    const isNewComment = markCommentSeen(comment);
    const sheetList = document.getElementById('comment-sheet-list');
    
    // If bottom sheet is open for this post, append to bottom sheet
    if (activePostId === comment.post_id && sheetList) {
      const existing = sheetList.querySelector(`[data-comment-id="${comment.id}"]`);
      if (!existing) {
        const div = renderCommentNode(comment);
        div.__feedComment = comment;
        sheetList.appendChild(div);
        sheetList.scrollTop = sheetList.scrollHeight;
      }
    }

    // Update count badge only. Comments themselves live in the modal.
    if (!isNewComment) return;
    updateCommentCount(comment.post_id, 1);
  }

  function openCommentSheet(postId) {
    activePostId = postId;
    lockFeedScroll();
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
      window.API.request('GET', `/content/feed/comments?post_id=${postId}`, null, { fresh: true })
        .then((comments) => {
          if (!Array.isArray(comments)) return;
          list.innerHTML = '';
          comments.forEach((c) => {
            // Append to sheet list
            const div = renderCommentNode(c);
            div.__feedComment = c;
            list.appendChild(div);
          });
          list.scrollTop = 0;
          
          renderPostCommentsPreview(postId, comments);
        })
        .catch((err) => {
          console.error('[feed] Error loading comments:', err);
        });
    }
  }

  function closeCommentSheet() {
    const overlay = document.getElementById('comment-sheet-overlay');
    const sheet = document.getElementById('comment-sheet');
    setCommentReply(null);
    overlay?.classList.remove('visible');
    sheet?.classList.remove('visible');
    setTimeout(() => {
      overlay?.classList.add('hidden');
      sheet?.classList.add('hidden');
      activePostId = null;
      unlockFeedScroll();
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

    const viewCommentsBtn = post.querySelector('[data-view-comments-btn]');
    viewCommentsBtn?.addEventListener('click', () => openCommentSheet(postId));

    // Initial load of comment count badges
    if (window.API) {
      window.API.request('GET', `/content/feed/comments?post_id=${postId}`, null, { fresh: true })
        .then((comments) => {
          if (Array.isArray(comments)) {
            renderPostCommentsPreview(postId, comments);
          }
        })
        .catch((err) => {
          console.error('[feed] Error loading comments for preview:', err);
        });
    }
  });

  // Sheet close handlers
  document.getElementById('comment-sheet-overlay')?.addEventListener('click', closeCommentSheet);
  document.getElementById('comment-sheet-close')?.addEventListener('click', closeCommentSheet);
  document.getElementById('comment-reply-cancel')?.addEventListener('click', () => setCommentReply(null));

  document.getElementById('comment-sheet-list')?.addEventListener('click', async (e) => {
    const item = e.target.closest('.comment-item');
    if (!item) return;
    const comment = item.__feedComment;

    const replyPreview = e.target.closest('[data-scroll-comment]');
    if (replyPreview) {
      const target = document.querySelector(`#comment-sheet-list [data-comment-id="${CSS.escape(String(replyPreview.dataset.scrollComment))}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('comment-item-highlight');
        setTimeout(() => target.classList.remove('comment-item-highlight'), 1100);
      }
      return;
    }

    if (e.target.closest('[data-comment-reply]')) {
      setCommentReply(comment);
      return;
    }

    const reactionBtn = e.target.closest('[data-comment-reaction]');
    if (reactionBtn && window.API) {
      try {
        const data = await window.API.request('POST', `/content/feed/comments/${item.dataset.commentId}/reactions`, {
          emoji: reactionBtn.dataset.commentReaction,
        });
        comment.reactions = data.reactions || [];
        item.__feedComment = comment;
        item.innerHTML = renderCommentItem(comment);
      } catch (err) {
        console.error('[feed] Error reacting to comment:', err);
      }
    }
  });

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
        reply_to_comment_id: activeReplyComment?.id || null,
      });
      const submittedPostId = activePostId;
      input.value = '';
      setCommentReply(null);
      if (comment && comment.post_id) {
        appendCommentToUI(comment);
      } else {
        updateCommentCount(submittedPostId, 1);
      }
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
