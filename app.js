/* ==========================================================================
   GitHub 3D Dashboard — app.js
   Routing, dropdowns, modals, prompt, favourites, generators, demos
   ========================================================================== */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* ignore */ }
    }
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* --------------------------------------------------------------- toast */
  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* -------------------------------------------------------------- routing */
  var pageSections = $$('.page');

  function pageIdOf(section) {
    return section.getAttribute('data-page-id') || section.getAttribute('data-page') || '';
  }

  var pageOutTimer = null;
  var pageInTimer = null;

  function applyPage(name) {
    var found = false;
    pageSections.forEach(function (section) {
      var match = pageIdOf(section) === name;
      section.classList.toggle('active', match);
      if (match) found = true;
    });

    if (!found) {
      name = 'home';
      pageSections.forEach(function (section) {
        section.classList.toggle('active', pageIdOf(section) === 'home');
      });
    }

    $$('.nav-item[data-page], .top-nav a[data-page], .bottom-nav a[data-page], .profile-tab[data-page]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-page') === name);
    });

    if (window.location.hash !== '#' + name) {
      try { window.history.replaceState(null, '', '#' + name); } catch (err) { /* ignore */ }
    }

    document.body.classList.remove('nav-open', 'profile-open');

    var main = $('.main');
    if (main && !reduceMotion) {
      main.classList.remove('page-out');
      main.classList.add('page-in');
      window.clearTimeout(pageInTimer);
      pageInTimer = window.setTimeout(function () { main.classList.remove('page-in'); }, 360);
    }

    revealScan();
  }

  function showPage(name) {
    var current = null;
    pageSections.forEach(function (section) {
      if (section.classList.contains('active')) current = pageIdOf(section);
    });

    window.scrollTo({ top: 0, behavior: 'auto' });

    var main = $('.main');
    if (!reduceMotion && main && current && current !== name) {
      window.clearTimeout(pageOutTimer);
      main.classList.remove('page-in');
      main.classList.add('page-out');
      pageOutTimer = window.setTimeout(function () { applyPage(name); }, 140);
      return;
    }

    applyPage(name);
  }

  /* ------------------------------------------- scroll reveal (in / out) */
  var revealObserver = null;

  function revealScan() {
    if (reduceMotion || !window.IntersectionObserver) return;

    if (!revealObserver) {
      revealObserver = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    }

    var page = $('.page.active');
    if (!page) return;

    var targets = $$('.hero, .card, .page-tile, .repo-card, .model-card, .action-btn, .feed-item, .suggest, .shortcut, .first-project, .promo, .shortcut-card, .section-head', page);

    targets.forEach(function (el, index) {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(index, 10) * 45 + 'ms';
      revealObserver.observe(el);
    });
  }

  /* ------------------------------------------------------------ dropdowns */
  var dropdowns = $$('.dropdown');

  function closeMenus(except) {
    dropdowns.forEach(function (dropdown) {
      if (dropdown === except) return;
      dropdown.classList.remove('open');
      var toggle = dropdown.querySelector('[data-dropdown-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  dropdowns.forEach(function (dropdown) {
    var toggle = dropdown.querySelector('[data-dropdown-toggle]');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var willOpen = !dropdown.classList.contains('open');
      closeMenus(dropdown);
      dropdown.classList.toggle('open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
  });

  /* ------------------------------------------------------------ favourites */
  var favourites = store.get('gh3d:favourites', []);
  if (!Array.isArray(favourites)) favourites = [];

  function repoNameOf(card) {
    var nameEl = card.querySelector('.repo-name');
    return nameEl ? nameEl.textContent.trim() : '';
  }

  function renderFavourites() {
    $$('.repo-card').forEach(function (card) {
      var name = repoNameOf(card);
      var isFav = favourites.indexOf(name) !== -1;
      card.classList.toggle('is-fav', isFav);
      var star = card.querySelector('.repo-star');
      if (star) {
        star.classList.toggle('is-fav', isFav);
        star.textContent = isFav ? '★' : '☆';
        star.setAttribute('aria-pressed', String(isFav));
        star.setAttribute('aria-label', (isFav ? 'Remove ' : 'Add ') + name + (isFav ? ' from' : ' to') + ' favourites');
      }
    });

    var count = $('#favCount');
    if (count) count.textContent = String(favourites.length);

    var list = $('#favList');
    var empty = $('#favEmpty');
    if (!list || !empty) return;

    if (!favourites.length) {
      list.style.display = 'none';
      empty.style.display = 'grid';
      list.innerHTML = '';
      return;
    }

    empty.style.display = 'none';
    list.style.display = 'flex';
    list.innerHTML = favourites.map(function (name) {
      return '<span class="fav-chip"><svg class="ic ic-sm" aria-hidden="true"><use href="#i-star"/></svg>' + esc(name) + '</span>';
    }).join('');
  }

  function toggleFavourite(name) {
    if (!name) return;
    var index = favourites.indexOf(name);
    if (index === -1) {
      favourites.push(name);
      toast('Added ' + name + ' to Favorites');
    } else {
      favourites.splice(index, 1);
      toast('Removed ' + name + ' from Favorites');
    }
    store.set('gh3d:favourites', favourites);
    renderFavourites();
  }

  /* ------------------------------------------------------- repositories page */
  var REPO_PAGE_DATA = [
    { name: 'Designing-my-instagram-', desc: 'Designing my own Instagram with an app called freemilk.ai.', lang: 'Swift', color: '#F05138' },
    { name: 'Designing-Facebook-Ui-', desc: 'My own design of the Facebook UI in Swift.', lang: 'Swift', color: '#F05138' },
    { name: 'Instagram-app-', desc: 'Designing the Instagram UI.', lang: 'Swift', color: '#F05138' },
    { name: '-X-App-twitter-', desc: 'Designing the X app UI.', lang: 'Swift', color: '#F05138' },
    { name: 'Facebook-web-App', desc: 'Web version of the Facebook interface.', lang: 'HTML', color: '#E34F26' },
    { name: 'Replit', desc: 'Design from Replit.', lang: 'TypeScript', color: '#3178C6' },
    { name: 'ha-freelance', desc: 'Ha Freelance as designer system.', lang: 'HTML', color: '#E34F26' },
    { name: 'ha-freelance-6a41', desc: 'A build of the Ha Freelance site.', lang: 'HTML', color: '#E34F26' },
    { name: 'merry-lab', desc: 'Experiments and UI studies.', lang: 'TypeScript', color: '#3178C6' },
    { name: 'setup-Cursor-AI', desc: 'Setup notes for Cursor AI.', lang: 'Docs', color: '#8B949E' }
  ];

  function buildRepositoryPage() {
    var list = $('#repoPageList');
    if (!list || list.children.length) return;
    list.className = 'repo-grid';
    list.innerHTML = REPO_PAGE_DATA.map(function (repo) {
      return [
        '<article class="repo-card">',
        '  <div class="repo-head">',
        '    <a class="repo-name" href="https://github.com/hardikarya30/', esc(repo.name), '" target="_blank" rel="noopener">',
        '      <svg class="ic ic-sm" aria-hidden="true"><use href="#i-repo"/></svg>', esc(repo.name), '</a>',
        '    <span class="pill">Public</span>',
        '  </div>',
        '  <p class="repo-desc">', esc(repo.desc), '</p>',
        '  <div class="repo-meta">',
        '    <span class="lang"><i style="background:', repo.color, '"></i>', esc(repo.lang), '</span>',
        '    <span>Updated recently</span>',
        '    <button class="repo-star" data-favorite="', esc(repo.name), '" aria-label="Add to favourites">☆</button>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  }

  /* -------------------------------------------------------------- feed */
  $$('[data-feed-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('[data-feed-filter]').forEach(function (other) {
        other.classList.toggle('active', other === btn);
      });
      $$('.feed-list').forEach(function (list) {
        list.classList.add('is-swapping');
        window.setTimeout(function () { list.classList.remove('is-swapping'); }, 260);
      });
      toast('Showing: ' + btn.textContent.trim() + ' feed');
    });
  });

  /* ------------------------------------------------------------ generators */
  function generateGeneric(prompt) {
    var topic = prompt && prompt.trim() ? prompt.trim() : 'a small helper';
    return [
      '// Generated for: ' + topic,
      '// GitHub 3D dashboard · code generator',
      '',
      'export function handle(request) {',
      '  if (!request) throw new Error("request is required");',
      '',
      '  const value = String(request).trim();',
      '  const isValid = /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(value);',
      '',
      '  return {',
      '    ok: isValid,',
      '    value,',
      '    checkedAt: new Date().toISOString()',
      '  };',
      '}'
    ].join('\n');
  }

  function generateSwift(prompt, mode) {
    var topic = prompt && prompt.trim() ? prompt.trim() : 'a liquid-glass card';
    if (mode === 'swiftui') {
      return [
        '// ' + topic,
        'import SwiftUI',
        '',
        'struct GlassCardView: View {',
        '    let title: String',
        '    let subtitle: String',
        '',
        '    var body: some View {',
        '        VStack(alignment: .leading, spacing: 10) {',
        '            Text(title)',
        '                .font(.headline)',
        '            Text(subtitle)',
        '                .font(.subheadline)',
        '                .foregroundStyle(.secondary)',
        '        }',
        '        .padding(16)',
        '        .frame(maxWidth: .infinity, alignment: .leading)',
        '        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 26))',
        '        .overlay(',
        '            RoundedRectangle(cornerRadius: 26)',
        '                .stroke(.white.opacity(0.3), lineWidth: 1)',
        '        )',
        '        .shadow(color: .black.opacity(0.35), radius: 24, x: 0, y: 16)',
        '    }',
        '}',
        '',
        '#Preview {',
        '    GlassCardView(title: "Repositories", subtitle: "6 public · 2 updated")',
        '        .padding()',
        '}'
      ].join('\n');
    }

    return [
      '// ' + topic,
      'import Foundation',
      '',
      'struct Repository: Codable, Identifiable {',
      '    let id: Int',
      '    let name: String',
      '    let language: String?',
      '}',
      '',
      'enum RepoError: Error {',
      '    case badResponse',
      '}',
      '',
      'func loadRepositories() async throws -> [Repository] {',
      '    guard let url = URL(string: "https://api.github.com/users/hardikarya30/repos") else {',
      '        throw RepoError.badResponse',
      '    }',
      '',
      '    let (data, _) = try await URLSession.shared.data(from: url)',
      '    return try JSONDecoder().decode([Repository].self, from: data)',
      '}'
    ].join('\n');
  }

  /* ------------------------------------------------------------------ pong */
  var pongFrame = null;

  function stopPong() {
    if (pongFrame !== null) {
      window.cancelAnimationFrame(pongFrame);
      pongFrame = null;
    }
  }

  function startPong() {
    var canvas = $('#pongCanvas');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var W = 480;
    var H = 320;
    canvas.width = W;
    canvas.height = H;

    var paddleH = 62;
    var paddleW = 10;

    var ball = { x: 240, y: 160, vx: 3.6, vy: 2.8, r: 7 };
    var playerY = 130;
    var aiY = 130;
    var score = { player: 0, ai: 0 };

    function reset(dir) {
      ball.x = 240;
      ball.y = 160;
      ball.vx = 3.6 * dir;
      ball.vy = (Math.random() > 0.5 ? 1 : -1) * 2.8;
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(219,231,245,0.25)';
      ctx.font = '600 12px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(score.player), W / 2 - 26, 24);
      ctx.fillText(String(score.ai), W / 2 + 26, 24);

      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#8F86FF');
      grad.addColorStop(1, '#3100F6');
      ctx.fillStyle = grad;
      ctx.fillRect(18, playerY, paddleW, paddleH);

      ctx.fillStyle = 'rgba(219,231,245,0.9)';
      ctx.fillRect(W - 28, aiY, paddleW, paddleH);

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = '#DBE7F5';
      ctx.shadowColor = '#A9B4FF';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function loop() {
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }
      if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy *= -1; }

      var playerX = 18;
      if (ball.x - ball.r < playerX + paddleW && ball.x > playerX &&
          ball.y > playerY && ball.y < playerY + paddleH && ball.vx < 0) {
        ball.x = playerX + paddleW + ball.r;
        ball.vx *= -1.05;
        ball.vy += ((ball.y - (playerY + paddleH / 2)) / paddleH) * 3;
      }

      var aiX = W - 28;
      if (ball.x + ball.r > aiX && ball.x < aiX + paddleW &&
          ball.y > aiY && ball.y < aiY + paddleH && ball.vx > 0) {
        ball.x = aiX - ball.r;
        ball.vx *= -1.05;
      }

      aiY = clamp(aiY + (ball.y - (aiY + paddleH / 2)) * 0.07, 0, H - paddleH);

      if (ball.x < -20) { score.ai += 1; reset(1); }
      if (ball.x > W + 20) { score.player += 1; reset(-1); }

      draw();
      pongFrame = window.requestAnimationFrame(loop);
    }

    canvas.addEventListener('pointermove', function (event) {
      var rect = canvas.getBoundingClientRect();
      var y = ((event.clientY - rect.top) / rect.height) * H;
      playerY = clamp(y - paddleH / 2, 0, H - paddleH);
    });

    canvas.addEventListener('touchmove', function (event) {
      event.preventDefault();
      var touch = event.touches[0];
      if (!touch) return;
      var rect = canvas.getBoundingClientRect();
      var y = ((touch.clientY - rect.top) / rect.height) * H;
      playerY = clamp(y - paddleH / 2, 0, H - paddleH);
    }, { passive: false });

    stopPong();
    pongFrame = window.requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- modals */
  var modal = $('#modal');
  var modalTitle = $('#modalTitle');
  var modalBody = $('#modalBody');

  var modalCloseTimer = null;

  function finishModalClose() {
    if (!modal) return;
    modal.classList.remove('is-open', 'is-closing');
    modal.setAttribute('aria-hidden', 'true');
    if (modalBody) modalBody.innerHTML = '';
  }

  function closeModal() {
    if (!modal || !modal.classList.contains('is-open')) return;
    if (modal.classList.contains('is-closing')) return;
    stopPong();
    document.body.style.overflow = '';

    if (reduceMotion) { finishModalClose(); return; }

    modal.classList.add('is-closing');
    window.clearTimeout(modalCloseTimer);
    modalCloseTimer = window.setTimeout(finishModalClose, 190);
  }

  function openModal(kind) {
    if (!modal || !modalBody || !modalTitle) return;
    var template = TEMPLATES[kind];
    if (!template) return;
    window.clearTimeout(modalCloseTimer);
    modal.classList.remove('is-closing');
    modalTitle.textContent = template.title;
    modalBody.innerHTML = template.body;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (typeof template.after === 'function') template.after();
  }

  var TEMPLATES = {
    repo: {
      title: 'Create a new repository',
      body: [
        '<form id="repoForm">',
        '  <div class="field"><label for="repoName">Repository name</label>',
        '    <input id="repoName" name="repoName" placeholder="my-new-project" autocomplete="off" required></div>',
        '  <div class="field"><label for="repoDesc">Description <span class="tiny muted">(optional)</span></label>',
        '    <textarea id="repoDesc" name="repoDesc" rows="2" placeholder="What is this repository for?"></textarea></div>',
        '  <div class="field"><label for="repoVis">Visibility</label>',
        '    <select id="repoVis" name="repoVis"><option>Public</option><option>Private</option></select></div>',
        '  <div class="modal-actions">',
        '    <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>',
        '    <button type="submit" class="btn btn-gradient">Create repository</button>',
        '  </div>',
        '</form>'
      ].join(''),
      after: function () {
        var form = $('#repoForm');
        if (!form) return;
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var nameInput = $('#repoName');
          var descInput = $('#repoDesc');
          var visInput = $('#repoVis');
          var name = nameInput ? nameInput.value.trim() : '';
          if (!name) { toast('Give the repository a name'); if (nameInput) nameInput.focus(); return; }
          var description = descInput ? descInput.value.trim() : '';
          var visibility = visInput ? visInput.value : 'Public';

          var grid = $('#repoGrid');
          if (grid) {
            var card = document.createElement('article');
            card.className = 'repo-card';
            card.innerHTML = [
              '<div class="repo-head">',
              '  <span class="repo-name"><svg class="ic ic-sm" aria-hidden="true"><use href="#i-repo"/></svg>', esc(name), '</span>',
              '  <span class="pill">', esc(visibility), '</span>',
              '</div>',
              '<p class="repo-desc">', esc(description || 'No description provided yet.'), '</p>',
              '<div class="repo-meta">',
              '  <span class="lang"><i style="background:#8CF5CB"></i>New</span>',
              '  <span>Just now</span>',
              '  <button class="repo-star" data-favorite="', esc(name), '" aria-label="Add to favourites">☆</button>',
              '</div>'
            ].join('');
            card.classList.add('card-enter');
            grid.prepend(card);
          }

          closeModal();
          toast('Created repository ' + name);
          showPage('repositories');
        });
      }
    },

    issue: {
      title: 'Create an issue',
      body: [
        '<form id="issueForm">',
        '  <div class="field"><label for="issueTitle">Title</label>',
        '    <input id="issueTitle" placeholder="Something is broken" autocomplete="off" required></div>',
        '  <div class="field"><label for="issueBody">Description</label>',
        '    <textarea id="issueBody" rows="3" placeholder="What did you expect, and what happened?"></textarea></div>',
        '  <div class="modal-actions">',
        '    <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>',
        '    <button type="submit" class="btn btn-gradient">Create issue</button>',
        '  </div>',
        '</form>'
      ].join(''),
      after: function () {
        var form = $('#issueForm');
        if (!form) return;
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var titleInput = $('#issueTitle');
          var bodyInput = $('#issueBody');
          var title = titleInput ? titleInput.value.trim() : '';
          if (!title) { toast('Give the issue a title'); if (titleInput) titleInput.focus(); return; }
          var description = bodyInput ? bodyInput.value.trim() : '';

          var list = $('#page-issues .list');
          if (list) {
            var row = document.createElement('div');
            row.className = 'list-row';
            row.innerHTML = [
              '<span class="status-dot open"></span>',
              '<div class="list-main"><strong>', esc(title), '</strong>',
              '<p class="tiny muted">hardikarya30 · just now', description ? ' · ' + esc(description) : '', '</p></div>',
              '<button class="btn btn-ghost btn-sm">Open</button>'
            ].join('');
            row.classList.add('card-enter');
            list.appendChild(row);
          }

          closeModal();
          toast('Issue created');
          showPage('issues');
        });
      }
    },

    status: {
      title: 'Set status',
      body: [
        '<form id="statusForm">',
        '  <div class="field"><label for="statusInput">What is happening?</label>',
        '    <input id="statusInput" placeholder="Working on the liquid-glass dashboard" autocomplete="off"></div>',
        '  <div class="modal-actions">',
        '    <button type="button" class="btn btn-ghost" data-close-modal>Clear status</button>',
        '    <button type="submit" class="btn btn-gradient">Save status</button>',
        '  </div>',
        '</form>'
      ].join(''),
      after: function () {
        var form = $('#statusForm');
        if (!form) return;
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var input = $('#statusInput');
          var value = input ? input.value.trim() : '';
          closeModal();
          toast(value ? 'Status set: ' + value : 'Status cleared');
        });
      }
    },

    download: {
      title: 'The GitHub Copilot app',
      body: [
        '<p class="muted">Enter your email or phone number and we will send you a download link for the GitHub Copilot app.</p>',
        '<form id="downloadForm">',
        '  <div class="field"><label for="downloadEmail">Email or phone</label>',
        '    <input id="downloadEmail" type="email" placeholder="you@example.com" autocomplete="email" required></div>',
        '  <div class="modal-actions">',
        '    <button type="button" class="btn btn-ghost" data-close-modal>Not now</button>',
        '    <button type="submit" class="btn btn-glow">Send me download link</button>',
        '  </div>',
        '</form>'
      ].join(''),
      after: function () {
        var downloadForm = $('#downloadForm');
        if (!downloadForm) return;
        downloadForm.addEventListener('submit', function (event) {
          event.preventDefault();
          var email = $('#downloadEmail');
          var value = email ? email.value.trim() : '';
          if (!value) { toast('Enter an email or phone number'); return; }
          closeModal();
          toast('Download link sent to ' + value);
        });
      }
    },

    calculator: {
      title: 'Simple calculator',
      body: [
        '<div class="calc">',
        '  <div class="calc-screen" id="calcScreen">0</div>',
        '  <div class="calc-keys">',
        '    <button type="button" class="calc-key op" data-calc="clear">C</button>',
        '    <button type="button" class="calc-key op" data-calc="sign">±</button>',
        '    <button type="button" class="calc-key op" data-calc="percent">%</button>',
        '    <button type="button" class="calc-key op" data-calc="divide">÷</button>',
        '    <button type="button" class="calc-key" data-calc="7">7</button>',
        '    <button type="button" class="calc-key" data-calc="8">8</button>',
        '    <button type="button" class="calc-key" data-calc="9">9</button>',
        '    <button type="button" class="calc-key op" data-calc="multiply">×</button>',
        '    <button type="button" class="calc-key" data-calc="4">4</button>',
        '    <button type="button" class="calc-key" data-calc="5">5</button>',
        '    <button type="button" class="calc-key" data-calc="6">6</button>',
        '    <button type="button" class="calc-key op" data-calc="subtract">−</button>',
        '    <button type="button" class="calc-key" data-calc="1">1</button>',
        '    <button type="button" class="calc-key" data-calc="2">2</button>',
        '    <button type="button" class="calc-key" data-calc="3">3</button>',
        '    <button type="button" class="calc-key op" data-calc="add">+</button>',
        '    <button type="button" class="calc-key" data-calc="0">0</button>',
        '    <button type="button" class="calc-key" data-calc="dot">.</button>',
        '    <button type="button" class="calc-key eq" data-calc="equals">=</button>',
        '  </div>',
        '</div>'
      ].join(''),
      after: function () {
        var screen = $('#calcScreen');
        var root = modalBody;
        if (!screen || !root) return;
        var current = '0';
        var stored = null;
        var operator = null;
        var fresh = true;

        function paint() { screen.textContent = current; }

        function compute(a, b, op) {
          if (op === 'add') return a + b;
          if (op === 'subtract') return a - b;
          if (op === 'multiply') return a * b;
          if (op === 'divide') return b === 0 ? NaN : a / b;
          return b;
        }

        root.addEventListener('click', function (event) {
          var btn = event.target.closest('[data-calc]');
          if (!btn) return;
          var key = btn.getAttribute('data-calc');

          if (key === 'clear') { current = '0'; stored = null; operator = null; fresh = true; paint(); return; }
          if (key === 'sign') { current = String(parseFloat(current) * -1); paint(); return; }
          if (key === 'percent') { current = String(parseFloat(current) / 100); paint(); return; }
          if (key === 'dot') { if (current.indexOf('.') === -1) current += '.'; fresh = false; paint(); return; }

          if (key === 'add' || key === 'subtract' || key === 'multiply' || key === 'divide') {
            if (operator && !fresh) {
              var result = compute(parseFloat(stored), parseFloat(current), operator);
              current = String(Number.isFinite(result) ? Number(result.toFixed(10)) : 0);
              paint();
            }
            stored = current;
            operator = key;
            fresh = true;
            return;
          }

          if (key === 'equals') {
            if (operator) {
              var value = compute(parseFloat(stored), parseFloat(current), operator);
              current = String(Number.isFinite(value) ? Number(value.toFixed(10)) : 0);
              stored = null;
              operator = null;
              fresh = true;
              paint();
            }
            return;
          }

          if (/^[0-9]$/.test(key)) {
            if (fresh) { current = key; fresh = false; }
            else { current = current === '0' ? key : current + key; }
            paint();
          }
        });
      }
    },

    pong: {
      title: 'Pong',
      body: [
        '<div class="pong-wrap">',
        '  <canvas id="pongCanvas" aria-label="Pong game"></canvas>',
        '  <p class="tiny muted">Move your finger over the board to steer the left paddle. First to 5 feels good.</p>',
        '</div>'
      ].join(''),
      after: function () { startPong(); }
    },

    mermaid: {
      title: 'Mermaid architecture overview',
      body: [
        '<div class="mermaid">',
        '<svg viewBox="0 0 520 330" role="img" aria-label="Architecture: browser, app, GitHub API, data">',
        '  <defs>',
        '    <linearGradient id="mgrad" x1="0" y1="0" x2="1" y2="1">',
        '      <stop offset="0" stop-color="#3100F6"/><stop offset="1" stop-color="#32288C"/>',
        '    </linearGradient>',
        '    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        '      <path d="M0 0 10 5 0 10z" fill="#DBE7F5"/>',
        '    </marker>',
        '  </defs>',
        '  <g fill="none" stroke="#DBE7F5" stroke-width="1.6" marker-end="url(#arrow)" stroke-opacity=".8">',
        '    <path d="M260 62v42"/>',
        '    <path d="M210 158v42"/>',
        '    <path d="M310 156v46"/>',
        '  </g>',
        '  <g font-family="-apple-system, system-ui, sans-serif" font-size="12" font-weight="700" text-anchor="middle" fill="#fff">',
        '    <rect x="140" y="14" width="240" height="46" rx="12" fill="url(#mgrad)" stroke="#fff" stroke-opacity=".35"/>',
        '    <text x="260" y="42">Browser · liquid-glass UI</text>',
        '',
        '    <rect x="150" y="106" width="220" height="50" rx="12" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-opacity=".3"/>',
        '    <text x="260" y="136">index.html · app.js · styles.css</text>',
        '',
        '    <rect x="44" y="202" width="180" height="48" rx="12" fill="url(#mgrad)" stroke="#fff" stroke-opacity=".35"/>',
        '    <text x="134" y="231">GitHub REST API</text>',
        '',
        '    <rect x="256" y="202" width="220" height="48" rx="12" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-opacity=".3"/>',
        '    <text x="366" y="231">Repositories · issues · models</text>',
        '  </g>',
        '  <text x="260" y="304" text-anchor="middle" fill="#C7C4EE" font-size="11" font-family="-apple-system, system-ui, sans-serif">Rendered from Mermaid flowchart LR</text>',
        '</svg>',
        '</div>',
        '<pre class="code-out">flowchart LR',
        '  A[Browser · liquid-glass UI] --> B[index.html + app.js]',
        '  B --> C[GitHub REST API]',
        '  B --> D[Repositories / issues / models]</pre>',
        '<div class="modal-actions">',
        '  <button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
        '  <button type="button" class="btn btn-gradient" id="copyMermaid">Copy source</button>',
        '</div>'
      ].join(''),
      after: function () {
        var btn = $('#copyMermaid');
        if (!btn) return;
        btn.addEventListener('click', function () { toast('Mermaid source copied'); });
      }
    },

    readme: {
      title: 'Profile README',
      body: [
        '<p class="muted">Paste this into a repository named after your username.</p>',
        '<pre class="code-out"># Hi, I am Hardik Arya 👋',
        '',
        'I design interfaces and ship them as Swift and SwiftUI apps.',
        '',
        '- 🔭 Currently building Instagram, Facebook and X UI clones',
        '- 🌱 Learning liquid-glass design systems',
        '- 💬 Ask me about SwiftUI layouts and GitHub Copilot',
        '- 🌐 https://design-system-studio-rbvn.bolt.host/',
        '',
        '```swift',
        'import SwiftUI',
        '',
        'struct Profile: View {',
        '    var body: some View {',
        '        Text("Good afternoon, Hardik.")',
        '            .font(.largeTitle.bold())',
        '    }',
        '}',
        '```</pre>',
        '<div class="modal-actions">',
        '  <button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
        '  <button type="button" class="btn btn-gradient" id="copyReadme">Copy README</button>',
        '</div>'
      ].join(''),
      after: function () {
        var btn = $('#copyReadme');
        if (!btn) return;
        btn.addEventListener('click', function () { toast('README copied'); });
      }
    }
  };

  function openDemo(kind) {
    openModal(kind);
  }

  /* ------------------------------------------------------------- prompt UI */
  function addMessage(text, role) {
    var messages = $('#messages');
    if (!messages) return;
    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble ' + (role === 'user' ? 'user' : 'bot');
    bubble.textContent = text;
    messages.appendChild(bubble);
    bubble.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    return bubble;
  }

  function replyFor(text) {
    var lower = text.toLowerCase();
    if (lower.indexOf('error') !== -1 || lower.indexOf('exception') !== -1) {
      return 'Start with the first frame in your stack trace, then check the value it expected. Paste the full trace and I will point at the exact line.';
    }
    if (lower.indexOf('swiftui') !== -1 || lower.indexOf('swift') !== -1) {
      return 'A good next step: wrap the view in a VStack, give it .padding(16) and put .ultraThinMaterial behind it with a RoundedRectangle(cornerRadius: 26). Want me to generate it?';
    }
    if (lower.indexOf('git') !== -1) {
      return 'Basic flow: git status, git add -A, git commit -m "message", git push. For branching, branch before you commit so main stays clean.';
    }
    return 'Got it. I would break that into three steps: reproduce it, isolate the smallest failing case, then fix and re-run. Ask me to write the first step and I will generate it.';
  }

  var promptForm = $('#promptForm');
  if (promptForm) {
    promptForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('#promptInput');
      if (!input) return;
      var text = input.value.trim();
      if (!text) { toast('Type a message first'); input.focus(); return; }
      addMessage(text, 'user');
      input.value = '';

      var typing = document.createElement('div');
      typing.className = 'msg-bubble bot';
      typing.textContent = 'Thinking…';
      var messages = $('#messages');
      if (messages) messages.appendChild(typing);

      window.setTimeout(function () {
        if (typing && typing.parentNode) {
          typing.textContent = replyFor(text);
        }
      }, reduceMotion ? 250 : 850);
    });
  }

  function promotePrompt(text) {
    var input = $('#promptInput');
    if (!input) { toast(text); return; }
    input.value = text;
    input.focus();
    input.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    toast('Added to the prompt');
  }

  /* -------------------------------------------------- model / optimised for */
  function setModel(name) {
    var label = $('#modelLabel');
    if (label) label.textContent = name;
    $$('[data-model]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-model') === name);
    });
    toast('Model: ' + name);
  }

  function setOptimise(name) {
    var label = $('#optimiseLabel');
    if (label) label.textContent = name;
    $$('.menu-item[data-optimise], .opt-option[data-optimise]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-optimise') === name);
    });
    toast('Optimised for: ' + name);
  }

  /* ------------------------------------------------------------- generators */
  var genRun = $('#genRun');
  if (genRun) {
    genRun.addEventListener('click', function () {
      var input = $('#genInput');
      var out = $('#genOutput');
      if (!out) return;
      genRun.disabled = true;
      out.textContent = 'Generating…';
      window.setTimeout(function () {
        out.textContent = generateGeneric(input ? input.value : '');
        genRun.disabled = false;
        toast('Code generated');
      }, reduceMotion ? 120 : 650);
    });
  }

  var swiftMode = 'swift';
  $$('.tab[data-lang]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      swiftMode = tab.getAttribute('data-lang');
      $$('.tab[data-lang]').forEach(function (other) { other.classList.toggle('active', other === tab); });
    });
  });

  var swiftRun = $('#swiftRun');
  if (swiftRun) {
    swiftRun.addEventListener('click', function () {
      var input = $('#swiftInput');
      var out = $('#swiftOutput');
      if (!out) return;
      swiftRun.disabled = true;
      out.textContent = 'Generating…';
      window.setTimeout(function () {
        out.textContent = generateSwift(input ? input.value : '', swiftMode);
        swiftRun.disabled = false;
        toast(swiftMode === 'swift' ? 'Swift code generated' : 'SwiftUI code generated');
      }, reduceMotion ? 120 : 650);
    });
  }

  /* --------------------------------------------------------- delegated click */
  document.addEventListener('click', function (event) {
    closeMenus();

    if (document.body.classList.contains('nav-open') || document.body.classList.contains('profile-open')) {
      if (!event.target.closest('.sidebar') && !event.target.closest('#navToggle') && !event.target.closest('.profile-toggle-btn')) {
        document.body.classList.remove('nav-open', 'profile-open');
      }
    }

    var pageLink = event.target.closest('[data-page]');
    if (pageLink && pageLink.tagName !== 'SECTION' && pageLink.getAttribute('data-page')) {
      event.preventDefault();
      showPage(pageLink.getAttribute('data-page'));
      return;
    }

    var modalTrigger = event.target.closest('[data-modal-open]');
    if (modalTrigger) {
      openModal(modalTrigger.getAttribute('data-modal-open'));
      return;
    }

    if (event.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }

    var demo = event.target.closest('[data-demo]');
    if (demo) {
      openDemo(demo.getAttribute('data-demo'));
      return;
    }

    var model = event.target.closest('[data-model]');
    if (model) {
      setModel(model.getAttribute('data-model'));
      return;
    }

    var optimise = event.target.closest('[data-optimise]');
    if (optimise) {
      setOptimise(optimise.getAttribute('data-optimise'));
      return;
    }

    var promote = event.target.closest('[data-promote]');
    if (promote) {
      promotePrompt(promote.getAttribute('data-promote'));
      return;
    }

    var agent = event.target.closest('[data-agent]');
    if (agent) {
      var who = agent.getAttribute('data-agent');
      promotePrompt(who === 'Debbie'
        ? 'Debbie, review my latest commit and suggest improvements'
        : 'Agent, plan and implement the next feature for me');
      return;
    }

    var favourite = event.target.closest('[data-favorite]');
    if (favourite) {
      var card = favourite.closest('.repo-card');
      toggleFavourite(card ? repoNameOf(card) : favourite.getAttribute('data-favorite'));
      return;
    }

    if (event.target.closest('[data-scroll-favourites]')) {
      toast('Tap a star on any repository to add it to Favorites');
      var topRepos = $('#topRepos');
      if (topRepos) topRepos.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }

    var back = event.target.closest('[data-back]');
    if (back) { showPage('home'); return; }

    var toastBtn = event.target.closest('[data-toast]');
    if (toastBtn) { toast(toastBtn.getAttribute('data-toast')); return; }
  });

  $$('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenus();
      closeModal();
      document.body.classList.remove('nav-open', 'profile-open');
    }
    if ((event.key === '/' || (event.key === 'k' && (event.metaKey || event.ctrlKey))) &&
        !/input|textarea|select/i.test(document.activeElement.tagName)) {
      var search = $('#globalSearch');
      if (search) { event.preventDefault(); search.focus(); }
    }
  });

  var search = $('#globalSearch');
  if (search) {
    search.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        var value = search.value.trim();
        toast(value ? 'Searching for “' + value + '”' : 'Type something to search');
        showPage('explore');
      }
    });
  }

  var navToggle = $('#navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      document.body.classList.remove('profile-open');
      document.body.classList.toggle('nav-open');
    });
  }

  var profileToggle = $('#profileToggle');
  if (profileToggle) {
    profileToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      document.body.classList.remove('nav-open');
      document.body.classList.toggle('profile-open');
    });
  }

  var closeRight = $('#closeRight');
  if (closeRight) {
    closeRight.addEventListener('click', function () {
      document.body.classList.remove('profile-open');
    });
  }

  /* -------------------------------------------------------------- 3D tilt */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    $$('.repo-card').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        var px = (event.clientX - rect.left) / rect.width - 0.5;
        var py = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = 'perspective(900px) rotateX(' + (-py * 6).toFixed(2) + 'deg) rotateY(' +
          (px * 8).toFixed(2) + 'deg) translateY(-3px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------- auth forms */
  $$('form[data-auth]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = form.querySelector('input[type="email"]');
      var password = form.querySelector('input[type="password"]');
      var emailValue = email ? email.value.trim() : '';
      var passwordValue = password ? password.value : '';

      if (!emailValue || emailValue.indexOf('@') === -1) {
        toast('Enter a valid email address');
        if (email) email.focus();
        return;
      }
      if (passwordValue.length < 8) {
        toast('Password must be at least 8 characters');
        if (password) password.focus();
        return;
      }

      toast(form.getAttribute('data-auth') === 'signup' ? 'Account created — welcome, Hardik' : 'Signed in — loading your dashboard…');
      window.setTimeout(function () { window.location.href = 'index.html'; }, 1100);
    });
  });

  /* ---------------------------------------------------------- tap ripple */
  document.addEventListener('pointerdown', function (event) {
    if (reduceMotion) return;
    var target = event.target.closest('.btn, .action-btn, .chip, .feed-filter, .profile-tab, .bottom-nav a');
    if (!target) return;

    var rect = target.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
    target.appendChild(ripple);
    window.setTimeout(function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 650);
  });

  /* --------------------------------------------------------- count-up */
  function animateCounts() {
    if (reduceMotion) return;
    $$('.nav-count, .tab-count').forEach(function (el) {
      var target = parseInt(el.textContent.replace(/\D/g, ''), 10);
      if (!target || isNaN(target)) return;
      var start = window.performance.now();
      el.textContent = '0';

      function tick(now) {
        var t = Math.min((now - start) / 850, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(target * eased));
        if (t < 1) window.requestAnimationFrame(tick);
      }
      window.requestAnimationFrame(tick);
    });
  }

  /* ------------------------------------------------------------------ boot */
  var startHash = (window.location.hash || '').replace('#', '');
  if (startHash) showPage(startHash);
  buildRepositoryPage();
  renderFavourites();
  revealScan();
  animateCounts();
})();
