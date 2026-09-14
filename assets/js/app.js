// app.js - 《搜商》Alpine.js 组件
// fetch 路径前缀: 'bookcreater/'

function bookApp() {
  return {
    view: 'home',
    currentChapter: null,
    currentHtml: '',
    chapterCache: {},
    fontSize: 14,
    theme: 'light',
    sidebarOpen: false,
    sidebarShow: false,
    progress: 0,
    loading: false,
    error: null,
    lastChapter: null,
    immersive: false,
    moreOpen: false,
    parts: (typeof PARTS !== 'undefined') ? PARTS : [],
    chapters: (typeof CHAPTERS !== 'undefined') ? CHAPTERS : [],
    _scrollScheduled: false,
    _revealObserver: null,

    init() {
      this.theme = localStorage.getItem('book-theme') || 'light';
      const savedSize = parseInt(localStorage.getItem('book-fontsize'));
      this.fontSize = (isNaN(savedSize)) ? 14 : Math.min(20, Math.max(10, savedSize));
      this.lastChapter = localStorage.getItem('book-lastchapter') || null;
      this.immersive = localStorage.getItem('book-immersive') === '1';

      if (this.theme === 'dark') {
        document.documentElement.classList.add('dark');
      }

      window.addEventListener('hashchange', () => this.handleHash());
      window.addEventListener('scroll', () => this.onScroll(), { passive: true });
      window.addEventListener('keydown', (e) => this.onKeydown(e));

      this.handleHash();
      this.$nextTick(() => this.initReveal());
    },

    initReveal() {
      const targets = document.querySelectorAll('.reveal, .reveal-group');
      if (!targets.length) return;
      if (!('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('reveal-visible'));
        return;
      }
      this._revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            this._revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08 });
      targets.forEach(el => this._revealObserver.observe(el));
    },

    replayChapterAnim() {
      this.$nextTick(() => {
        const el = document.querySelector('.markdown');
        if (!el) return;
        el.classList.remove('chapter-enter');
        void el.offsetWidth;
        el.classList.add('chapter-enter');
      });
    },

    get currentChapterMeta() {
      return this.chapters.find(c => c.id === this.currentChapter) || null;
    },
    get prevChapterMeta() {
      if (!this.currentChapter) return null;
      const idx = this.chapters.findIndex(c => c.id === this.currentChapter);
      return idx > 0 ? this.chapters[idx - 1] : null;
    },
    get nextChapterMeta() {
      if (!this.currentChapter) return null;
      const idx = this.chapters.findIndex(c => c.id === this.currentChapter);
      return idx >= 0 && idx < this.chapters.length - 1 ? this.chapters[idx + 1] : null;
    },

    chaptersByPart(partId) {
      return this.chapters.filter(c => c.part === partId);
    },

    handleHash() {
      const hash = location.hash;
      const m = hash.match(/^#\/ch\/(\d{2})$/);
      if (m) {
        this.loadChapter(m[1]);
      } else {
        this.view = 'home';
        this.currentChapter = null;
        window.scrollTo(0, 0);
      }
    },

    goHome() {
      location.hash = '';
    },

    openChapter(id) {
      location.hash = '#/ch/' + id;
    },

    async loadChapter(id) {
      const meta = this.chapters.find(c => c.id === id);
      if (!meta) {
        this.error = '未找到章节 ' + id;
        return;
      }

      this.view = 'read';
      this.currentChapter = id;
      this.error = null;
      this.sidebarOpen = false;
      this.sidebarShow = false;
      window.scrollTo(0, 0);
      this.progress = 0;

      localStorage.setItem('book-lastchapter', id);
      this.lastChapter = id;

      if (this.chapterCache[id]) {
        this.currentHtml = this.chapterCache[id];
        this.loading = false;
        this.replayChapterAnim();
        this.$nextTick(() => window.scrollTo(0, 0));
        return;
      }

      this.loading = true;
      try {
        const resp = await fetch('bookcreater/' + meta.file);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        const html = await this.parseMarkdown(text);
        this.chapterCache[id] = html;
        this.currentHtml = html;
        this.loading = false;
        this.replayChapterAnim();
        this.$nextTick(() => window.scrollTo(0, 0));

        const next = this.nextChapterMeta;
        if (next && !this.chapterCache[next.id]) {
          setTimeout(() => this.preloadChapter(next.id), 500);
        }
      } catch (e) {
        this.loading = false;
        this.error = '加载章节 ' + id + ' 失败：' + e.message + '。请确认通过 HTTP 服务器访问（非 file://）。';
      }
    },

    async preloadChapter(id) {
      if (this.chapterCache[id]) return;
      const meta = this.chapters.find(c => c.id === id);
      if (!meta) return;
      try {
        const resp = await fetch('bookcreater/' + meta.file);
        if (!resp.ok) return;
        const text = await resp.text();
        const html = await this.parseMarkdown(text);
        this.chapterCache[id] = html;
      } catch (e) {
        // 预加载失败静默忽略
      }
    },

    async parseMarkdown(text) {
      const start = Date.now();
      while (typeof marked === 'undefined' && Date.now() - start < 5000) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (typeof marked === 'undefined') {
        return '<p style="color:red">marked.js 未加载，无法解析 markdown。请检查网络。</p><pre>' + this.escapeHtml(text) + '</pre>';
      }
      marked.setOptions({ breaks: false, gfm: true });
      return marked.parse(text);
    },

    escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      if (this.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('book-theme', this.theme);
    },

    setFont(delta) {
      const next = this.fontSize + delta;
      if (next < 10 || next > 20) return;
      this.fontSize = next;
      localStorage.setItem('book-fontsize', String(next));
    },

    get lineHeight() { return this.fontSize >= 16 ? 1.8 : 1.85; },

    onScroll() {
      if (this._scrollScheduled) return;
      this._scrollScheduled = true;
      requestAnimationFrame(() => {
        const h = document.documentElement;
        const scrollable = h.scrollHeight - h.clientHeight;
        this.progress = scrollable > 0 ? Math.min(100, (h.scrollTop / scrollable) * 100) : 0;
        this._scrollScheduled = false;
      });
    },

    onKeydown(e) {
      if (this.view !== 'read') return;
      if (e.key === 'Escape') {
        if (this.sidebarOpen) this.sidebarOpen = false;
        else if (this.sidebarShow) this.sidebarShow = false;
        else if (this.moreOpen) this.moreOpen = false;
        else if (this.immersive) this.toggleImmersive();
      } else if (e.key === 'i' || e.key === 'I') {
        this.toggleImmersive();
      } else if (e.key === 'ArrowLeft' && this.prevChapterMeta) {
        this.prevChapter();
      } else if (e.key === 'ArrowRight' && this.nextChapterMeta) {
        this.nextChapter();
      }
    },

    toggleImmersive() {
      this.immersive = !this.immersive;
      localStorage.setItem('book-immersive', this.immersive ? '1' : '0');
      if (!this.immersive) {
        this.sidebarShow = false;
      }
    },

    openToc() {
      if (window.innerWidth >= 1024) {
        this.sidebarShow = !this.sidebarShow;
      } else {
        this.sidebarOpen = true;
      }
    },

    prevChapter() {
      if (this.prevChapterMeta) this.openChapter(this.prevChapterMeta.id);
    },
    nextChapter() {
      if (this.nextChapterMeta) this.openChapter(this.nextChapterMeta.id);
    },

    goAuthor() {
      if (this.view === 'read') {
        this.goHome();
        this.$nextTick(() => {
          requestAnimationFrame(() => this.scrollToAuthor());
        });
      } else {
        this.$nextTick(() => {
          requestAnimationFrame(() => this.scrollToAuthor());
        });
      }
    },

    scrollToAuthor() {
      const el = document.getElementById('author');
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.pageYOffset - 64;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    },
  };
}

window.bookApp = bookApp;
