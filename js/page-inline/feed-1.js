(function initFeedInteractions() {
  const likedKey = 'sistema:feed-liked-posts';
  const root = document.getElementById('feed-posts-root');
  const fallbackTemplate = document.getElementById('feed-static-fallback');
  const defaultAvatar = '/assets/webp/ruslan_promo.webp';
  let feedPostsInitialized = false;
  let isFeedAdmin = false;
  let currentFeedPosts = [];

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

  function formatPostTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (date.toDateString() === now.toDateString()) return 'Сегодня';
    if (diffMs > 0 && diffMs < dayMs * 2) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  function postSlug(post) {
    return String(post.id || '').trim() || `post-${Date.now()}`;
  }

  function renderCaptionHtml(post) {
    const author = escapeHtml(post.author_name || 'Руслан Молодцов');
    const lines = String(post.body || '')
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return `<p><strong>${author}</strong></p>`;
    return lines.map((line, index) => {
      const safeLine = escapeHtml(line).replace(/\n/g, '<br>');
      return `<p>${index === 0 ? `<strong>${author}</strong>` : ''}${safeLine}</p>`;
    }).join('');
  }

  function renderPostMedia(post) {
    const mediaType = post.media_type || (post.video_url ? 'video' : 'image');
    if (mediaType === 'video' || mediaType === 'circle_video') {
      const poster = post.cover_url || post.image_url || '';
      return `
        <div class="post-video-wrap${mediaType === 'circle_video' ? ' is-circle' : ''}">
          <video class="post-video" src="${escapeHtml(post.video_url)}"${poster ? ` poster="${escapeHtml(poster)}"` : ''} controls playsinline webkit-playsinline preload="metadata"></video>
        </div>
      `;
    }
    if (!post.image_url) return '';
    return `<img class="post-image" src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title || 'Пост')}" loading="lazy" decoding="async" />`;
  }

  function renderPost(post) {
    const id = postSlug(post);
    const title = post.title || 'Пост Руслана Молодцова';
    const shareText = String(post.body || '').replace(/\s+/g, ' ').trim().slice(0, 140) || title;
    const likes = Number(post.likes_count) || 0;
    return `
      <article class="post-card" id="post-${escapeHtml(id)}" data-post-id="${escapeHtml(id)}" data-share-title="${escapeHtml(title)}" data-share-text="${escapeHtml(shareText)}">
        ${isFeedAdmin ? `
          <div class="feed-admin-post-actions">
            <button type="button" data-feed-edit-post="${escapeHtml(id)}">Редактировать</button>
            <button type="button" data-feed-delete-post="${escapeHtml(id)}">Удалить</button>
          </div>
        ` : ''}
        <div class="post-author">
          <img class="post-avatar" src="${escapeHtml(post.author_avatar_url || defaultAvatar)}" alt="${escapeHtml(post.author_name || 'Руслан Молодцов')}" loading="lazy" decoding="async" />
          <div class="post-author-info">
            <span class="post-author-name">${escapeHtml(post.author_name || 'Руслан Молодцов')}</span>
            <span class="post-time">${escapeHtml(formatPostTime(post.published_at || post.created_at))}</span>
          </div>
        </div>
        ${renderPostMedia(post)}
        <div class="post-actions">
          <button class="post-action-btn" aria-label="Нравится" aria-pressed="false" data-like-button>
            <svg viewBox="0 0 24 24" stroke-width="1.75"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="post-action-btn" aria-label="Комментарии" data-comment-button>
            <svg viewBox="0 0 24 24" stroke-width="1.75"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span class="post-comment-count" data-comment-count></span>
          </button>
          <button class="post-action-btn" aria-label="Поделиться" data-share-button>
            <svg viewBox="0 0 24 24" stroke-width="1.75"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div class="post-likes" data-base-likes="${likes}" data-likes>${formatLikes(likes)}</div>
        <div class="post-caption">${renderCaptionHtml(post)}</div>
        <button class="post-expand-link" type="button">Развернуть весь текст</button>
        <div class="post-comments-preview-section hidden" data-comments-preview-container>
          <div class="post-comments-preview-list" data-comments-preview-list></div>
          <button class="post-comments-view-all-btn hidden" type="button" data-view-comments-btn>Посмотреть все комментарии</button>
        </div>
      </article>
    `;
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

  function setCommentReply(comment, options = {}) {
    activeReplyComment = comment || null;
    updateCommentReplyBanner();
    if (comment && options.focus !== false) {
      try {
        document.getElementById('comment-sheet-input')?.focus({ preventScroll: true });
      } catch (e) {
        document.getElementById('comment-sheet-input')?.focus();
      }
    }
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
  let closeSheetTimer = null;

  function lockFeedScroll() {
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    savedBodyStyles = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      bodyTouchAction: document.body.style.touchAction,
    };
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'pan-y';
  }

  function unlockFeedScroll() {
    const restoreY = savedScrollY;
    if (savedBodyStyles) {
      document.documentElement.style.overflow = savedBodyStyles.htmlOverflow;
      document.documentElement.style.overscrollBehavior = savedBodyStyles.htmlOverscrollBehavior;
      document.body.style.overflow = savedBodyStyles.bodyOverflow;
      document.body.style.overscrollBehavior = savedBodyStyles.bodyOverscrollBehavior;
      document.body.style.touchAction = savedBodyStyles.bodyTouchAction;
      savedBodyStyles = null;
      restoreFeedScroll(restoreY);
    }
  }

  function restoreFeedScroll(y) {
    const targetY = Math.max(0, Number(y) || 0);
    requestAnimationFrame(() => window.scrollTo({ top: targetY, left: 0, behavior: 'instant' }));
  }

  function blurCommentSheetFocus() {
    const sheet = document.getElementById('comment-sheet');
    const active = document.activeElement;
    if (sheet && active && sheet.contains(active) && typeof active.blur === 'function') {
      active.blur();
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
    if (closeSheetTimer) {
      clearTimeout(closeSheetTimer);
      closeSheetTimer = null;
    }
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
    blurCommentSheetFocus();
    setCommentReply(null, { focus: false });
    overlay?.classList.remove('visible');
    sheet?.classList.remove('visible');
    if (closeSheetTimer) clearTimeout(closeSheetTimer);
    closeSheetTimer = setTimeout(() => {
      overlay?.classList.add('hidden');
      sheet?.classList.add('hidden');
      activePostId = null;
      closeSheetTimer = null;
      unlockFeedScroll();
    }, 300);
  }

  function setupPostCards() {
  document.querySelectorAll('.post-card[data-post-id]').forEach((post) => {
    if (post.dataset.feedReady === 'true') return;
    post.dataset.feedReady = 'true';
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
  }

  // Sheet close handlers
  document.getElementById('comment-sheet-overlay')?.addEventListener('click', closeCommentSheet);
  document.getElementById('comment-sheet-close')?.addEventListener('click', closeCommentSheet);
  document.getElementById('comment-reply-cancel')?.addEventListener('click', () => setCommentReply(null, { focus: false }));

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
      setCommentReply(null, { focus: false });
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

  function setupShareButtons() {
  document.querySelectorAll('[data-share-button]').forEach((button) => {
    if (button.dataset.shareReady === 'true') return;
    button.dataset.shareReady = 'true';
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
  }

  function setupExpandButtons() {
  document.querySelectorAll('.post-expand-link').forEach((button) => {
    if (button.dataset.expandReady === 'true') return;
    button.dataset.expandReady = 'true';
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
  }

  function setupRenderedPosts() {
    setupPostCards();
    setupShareButtons();
    setupExpandButtons();
  }

  async function loadFeedPosts() {
    if (!root || !window.API) {
      setupRenderedPosts();
      return;
    }
    try {
      const data = await window.API.request('GET', '/content/feed/posts', null, { fresh: true });
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      currentFeedPosts = posts;
      if (!posts.length) {
        root.innerHTML = '<div class="feed-empty">Пока нет постов.</div>';
      } else {
        root.innerHTML = posts.map(renderPost).join('');
      }
      root.setAttribute('aria-busy', 'false');
      setupRenderedPosts();
    } catch (err) {
      console.error('[feed] Error loading posts:', err);
      if (fallbackTemplate?.content?.children?.length) {
        root.innerHTML = '';
        root.appendChild(fallbackTemplate.content.cloneNode(true));
      }
      root?.setAttribute('aria-busy', 'false');
      setupRenderedPosts();
    }
  }

  function setupAdminComposer() {
    const modal = document.getElementById('feed-post-modal');
    const openBtn = document.getElementById('feed-admin-open');
    const form = document.getElementById('feed-post-form');
    const fileInput = document.getElementById('feed-post-file');
    const fileTrigger = document.getElementById('feed-post-file-trigger');
    const fileTitle = document.getElementById('feed-post-file-title');
    const fileName = document.getElementById('feed-post-file-name');
    const bodyInput = document.getElementById('feed-post-body');
    const preview = document.getElementById('feed-post-preview');
    const statusEl = document.getElementById('feed-post-status');
    const progress = document.getElementById('feed-post-upload-progress');
    const progressFill = document.getElementById('feed-post-upload-fill');
    const progressLabel = document.getElementById('feed-post-upload-label');
    const typeButtons = Array.from(document.querySelectorAll('[data-feed-media-type]'));
    let mediaType = 'image';
    let previewUrl = '';
    let editingPost = null;

    if (!modal || !openBtn || !form || !fileInput || !bodyInput || !window.API) return;

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || '';
    }

    function setUploadProgress(value, label) {
      const safe = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      if (progress) {
        progress.classList.toggle('visible', safe > 0 || Boolean(label));
        progress.setAttribute('aria-hidden', safe > 0 || label ? 'false' : 'true');
      }
      if (progressFill) progressFill.style.width = `${safe}%`;
      if (progressLabel) progressLabel.textContent = label || (safe ? `Загрузка ${safe}%` : 'Готово к загрузке');
    }

    function setModalVisible(visible) {
      modal.classList.toggle('hidden', !visible);
      modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible) {
        setStatus('');
      } else {
        editingPost = null;
        mediaType = 'image';
        document.getElementById('feed-post-title').textContent = 'Новый пост';
        document.querySelector('.feed-post-dialog-subtitle').textContent = 'Как в Telegram: выберите медиа, добавьте текст и сразу публикуйте в ленту.';
        form.querySelector('.feed-post-submit').textContent = 'Опубликовать';
        fileInput.required = true;
        form.reset();
        setUploadProgress(0, '');
        clearPreview();
        updateFileAccept();
      }
    }

    function clearPreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      if (preview) {
        preview.innerHTML = '';
        preview.style.display = 'none';
      }
    }

    function updateFileAccept() {
      fileInput.accept = mediaType === 'image' ? 'image/*' : 'video/*';
      typeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.feedMediaType === mediaType);
      });
      if (fileTitle) {
        fileTitle.textContent = mediaType === 'image'
          ? 'Выбрать фото'
          : mediaType === 'circle_video'
            ? 'Выбрать кружочек'
            : 'Выбрать видео';
      }
      if (fileName) fileName.textContent = 'Из галереи телефона';
      setUploadProgress(0, '');
      clearPreview();
      fileInput.value = '';
    }

    function renderPreview(file) {
      clearPreview();
      if (!file || !preview) return;
      if (fileName) fileName.textContent = file.name || 'Файл выбран';
      previewUrl = URL.createObjectURL(file);
      if (mediaType === 'image') {
        preview.innerHTML = `<img src="${previewUrl}" alt="">`;
      } else {
        preview.innerHTML = `<video src="${previewUrl}" controls playsinline webkit-playsinline muted preload="metadata"></video>`;
      }
      preview.style.display = 'block';
      setUploadProgress(0, 'Файл выбран, можно публиковать');
    }

    function renderExistingPreview(post) {
      clearPreview();
      if (!preview || !post) return;
      const type = post.media_type || (post.video_url ? 'video' : 'image');
      if (type === 'image' && post.image_url) {
        preview.innerHTML = `<img src="${escapeHtml(post.image_url)}" alt="">`;
      } else if (post.video_url) {
        preview.innerHTML = `<video src="${escapeHtml(post.video_url)}" controls playsinline webkit-playsinline muted preload="metadata"></video>`;
      } else {
        return;
      }
      preview.style.display = 'block';
      if (fileName) fileName.textContent = 'Текущее медиа сохранится, если не выбрать новое';
      setUploadProgress(0, 'Можно заменить медиа или сохранить текущее');
    }

    function openEditPost(post) {
      editingPost = post;
      mediaType = post.media_type || (post.video_url ? 'video' : 'image');
      updateFileAccept();
      editingPost = post;
      bodyInput.value = post.body || '';
      fileInput.required = false;
      document.getElementById('feed-post-title').textContent = 'Редактировать пост';
      document.querySelector('.feed-post-dialog-subtitle').textContent = 'Измените текст или замените медиа. Если файл не выбрать, останется текущее медиа.';
      form.querySelector('.feed-post-submit').textContent = 'Сохранить';
      renderExistingPreview(post);
      setModalVisible(true);
    }

    root?.addEventListener('click', async (event) => {
      const editBtn = event.target.closest('[data-feed-edit-post]');
      const deleteBtn = event.target.closest('[data-feed-delete-post]');
      if (!editBtn && !deleteBtn) return;
      event.preventDefault();
      event.stopPropagation();

      if (editBtn) {
        const post = currentFeedPosts.find((item) => String(item.id) === String(editBtn.dataset.feedEditPost));
        if (post) openEditPost(post);
        return;
      }

      const postId = deleteBtn.dataset.feedDeletePost;
      const post = currentFeedPosts.find((item) => String(item.id) === String(postId));
      const title = post?.title || String(post?.body || '').slice(0, 60) || `#${postId}`;
      if (!confirm(`Удалить пост "${title}"?`)) return;
      deleteBtn.disabled = true;
      try {
        await window.API.request('DELETE', `/content/feed/posts/${encodeURIComponent(postId)}`, null, { requireAuth: true });
        await loadFeedPosts();
      } catch (err) {
        console.error('[feed] Error deleting post:', err);
        alert(err.message || 'Не удалось удалить пост');
      } finally {
        deleteBtn.disabled = false;
      }
    });

    async function uploadFeedFile(file, onProgress) {
      const user = await window.API.me({ fresh: true }).then((data) => data.user);
      if (!user || user.role !== 'admin') {
        throw new Error('Доступ только для администратора');
      }
      const base = String(window.API.base || '').replace(/\/+$/u, '');
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${base}/content/feed/posts/upload?type=${encodeURIComponent(mediaType)}`, true);
        xhr.withCredentials = true;
        xhr.timeout = 180000;
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        if (window.API.accessToken) xhr.setRequestHeader('Authorization', `Bearer ${window.API.accessToken}`);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            onProgress?.(8, 'Загружаем медиа...');
            return;
          }
          onProgress?.((event.loaded / event.total) * 100, `Загрузка ${Math.round((event.loaded / event.total) * 100)}%`);
        };
        xhr.onload = () => {
          let data = {};
          try {
            data = JSON.parse(xhr.responseText || '{}');
          } catch (e) {
            data = {};
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Не удалось загрузить медиа'));
          }
        };
        xhr.onerror = () => reject(new Error('Сеть прервала загрузку'));
        xhr.ontimeout = () => reject(new Error('Загрузка заняла слишком много времени'));
        xhr.send(file);
      });
    }

    openBtn.addEventListener('click', () => {
      editingPost = null;
      mediaType = 'image';
      form.reset();
      updateFileAccept();
      setModalVisible(true);
    });
    fileTrigger?.addEventListener('click', () => fileInput.click());
    modal.querySelectorAll('[data-feed-post-close]').forEach((button) => {
      button.addEventListener('click', () => setModalVisible(false));
    });
    typeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mediaType = button.dataset.feedMediaType || 'image';
        updateFileAccept();
      });
    });
    fileInput.addEventListener('change', () => renderPreview(fileInput.files && fileInput.files[0]));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = fileInput.files && fileInput.files[0];
      const body = bodyInput.value.trim();
      if (!body || (!editingPost && !file)) return;
      const submit = form.querySelector('.feed-post-submit');
      if (submit) submit.disabled = true;
      try {
        let uploaded = null;
        if (file) {
          setStatus('Загружаем медиа...');
          setUploadProgress(1, 'Подготовка загрузки...');
          uploaded = await uploadFeedFile(file, setUploadProgress);
          setUploadProgress(100, 'Медиа загружено');
        }
        setStatus(editingPost ? 'Сохраняем пост...' : 'Публикуем пост...');
        const payload = {
          body,
          title: body.split(/\n/u).find(Boolean)?.slice(0, 160) || 'Новый пост',
          media_type: uploaded?.media_type || mediaType,
          image_url: uploaded?.image_url || null,
          video_url: uploaded?.video_url || null,
          cover_url: uploaded?.cover_url || null,
          status: 'published',
          keep_existing_media: Boolean(editingPost && !uploaded),
        };
        const endpoint = editingPost ? `/content/feed/posts/${encodeURIComponent(editingPost.id)}` : '/content/feed/posts';
        await window.API.request(editingPost ? 'PATCH' : 'POST', endpoint, payload, { requireAuth: true, timeoutMs: 30000 });
        setStatus(editingPost ? 'Пост сохранён' : 'Пост опубликован');
        setModalVisible(false);
        await loadFeedPosts();
      } catch (err) {
        console.error('[feed] Error saving post:', err);
        setStatus(err.message || 'Не удалось сохранить пост');
      } finally {
        if (submit) submit.disabled = false;
      }
    });

    updateFileAccept();
    window.API.me({ fresh: true })
      .then((data) => {
        if (data?.user?.role === 'admin') {
          isFeedAdmin = true;
          document.body.classList.add('feed-admin-ready');
          loadFeedPosts().catch((err) => console.error('[feed] Error reloading admin posts:', err));
        }
      })
      .catch(() => {});
  }

  setupAdminComposer();
  loadFeedPosts();
}());
