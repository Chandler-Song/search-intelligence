/* ============================================
   《搜商》阅读网站 - 主应用逻辑 (Alpine.js)
   ============================================ */

function readingApp() {
  return {
    // ---------- 状态 ----------
    currentChapterId: "00",
    currentChapter: null,
    chapterContent: "",
    isLoading: true,
    loadError: false,

    // 布局
    sidebarOpen: true,
    tocOpen: true,
    immersiveMode: false,
    mobileSidebarOpen: false,
    settingsOpen: false,

    // 主题与字号
    theme: "light", // light | dark
    fontSize: "medium", // small | medium | large

    // 进度
    readProgress: 0,

    // TOC
    tocItems: [],
    activeTocId: "",

    // 缓存
    cache: {},

    // ---------- 初始化 ----------
    init() {
      this.theme = localStorage.getItem("sq-theme") || "light";
      this.fontSize = localStorage.getItem("sq-fontsize") || "medium";
      const saved = localStorage.getItem("sq-current-chapter");
      const urlParams = new URLSearchParams(window.location.search);
      const urlChapter = urlParams.get("chapter");
      this.currentChapterId = urlChapter || saved || "00";

      this.applyTheme();
      this.loadChapter(this.currentChapterId);
      this.setupKeyboard();
    },

    // ---------- 章节加载 ----------
    async loadChapter(id) {
      const chapter = CHAPTERS.find(c => c.id === id);
      if (!chapter) return;

      this.currentChapterId = id;
      this.currentChapter = chapter;
      this.isLoading = true;
      this.loadError = false;
      this.tocItems = [];
      this.readProgress = 0;

      localStorage.setItem("sq-current-chapter", id);
      this.updateUrl();

      // 缓存命中
      if (this.cache[id]) {
        this.chapterContent = this.cache[id];
        this.isLoading = false;
        this.$nextTick(() => this.afterRender());
        return;
      }

      try {
        const resp = await fetch(chapter.file);
        if (!resp.ok) throw new Error("加载失败");
        const text = await resp.text();
        const html = DOMPurify.sanitize(marked.parse(text));
        this.cache[id] = html;
        this.chapterContent = html;
        this.isLoading = false;
        this.$nextTick(() => this.afterRender());
      } catch (e) {
        this.isLoading = false;
        this.loadError = true;
        this.chapterContent = "<p style='text-align:center;color:#dc2626;padding:2rem;'>章节加载失败，请检查是否通过 HTTP 服务器运行。</p>";
      }
    },

    // ---------- 渲染后处理 ----------
    afterRender() {
      this.buildToc();
      this.scrollToTop();
      this.trackProgress();
      const content = document.getElementById("article-content");
      if (content) {
        content.classList.add("fade-in");
      }
    },

    // ---------- 章节导航 ----------
    goToChapter(id) {
      if (id === this.currentChapterId) {
        this.mobileSidebarOpen = false;
        return;
      }
      this.loadChapter(id);
      this.mobileSidebarOpen = false;
    },

    prevChapter() {
      const idx = CHAPTERS.findIndex(c => c.id === this.currentChapterId);
      if (idx > 0) this.loadChapter(CHAPTERS[idx - 1].id);
    },

    nextChapter() {
      const idx = CHAPTERS.findIndex(c => c.id === this.currentChapterId);
      if (idx < CHAPTERS.length - 1) this.loadChapter(CHAPTERS[idx + 1].id);
    },

    get hasPrev() {
      return this.currentChapterId !== "00";
    },

    get hasNext() {
      return this.currentChapterId !== "41";
    },

    // ---------- 分组 ----------
    get groupedChapters() {
      const groups = {};
      CHAPTERS.forEach(c => {
        if (!groups[c.part]) groups[c.part] = [];
        groups[c.part].push(c);
      });
      return groups;
    },

    // ---------- TOC ----------
    buildToc() {
      const content = document.getElementById("article-content");
      if (!content) return;
      const heads = content.querySelectorAll("h2, h3");
      const items = [];
      heads.forEach((h, i) => {
        const id = `toc-${i}`;
        h.id = id;
        items.push({
          id: id,
          text: h.textContent,
          level: h.tagName.toLowerCase()
        });
      });
      this.tocItems = items;
    },

    scrollToToc(id) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },

    // ---------- 阅读进度 ----------
    trackProgress() {
      const content = document.getElementById("article-content");
      if (!content) return;
      const onScroll = () => {
        const rect = content.getBoundingClientRect();
        const total = content.offsetHeight - window.innerHeight;
        const scrolled = -rect.top;
        this.readProgress = Math.max(0, Math.min(100, (scrolled / total) * 100));

        // 更新 TOC 高亮
        const heads = content.querySelectorAll("h2, h3");
        let active = "";
        heads.forEach(h => {
          const r = h.getBoundingClientRect();
          if (r.top < 120) active = h.id;
        });
        if (active) this.activeTocId = active;
      };
      window.onscroll = onScroll;
      onScroll();
    },

    // ---------- 沉浸式 ----------
    toggleImmersive() {
      this.immersiveMode = !this.immersiveMode;
      if (this.immersiveMode) {
        this.sidebarOpen = false;
        this.tocOpen = false;
        document.body.classList.add("immersive-mode");
      } else {
        document.body.classList.remove("immersive-mode");
      }
    },

    // ---------- 主题 ----------
    toggleTheme() {
      this.theme = this.theme === "light" ? "dark" : "light";
      this.applyTheme();
      localStorage.setItem("sq-theme", this.theme);
    },

    applyTheme() {
      if (this.theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.add("theme-dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.remove("theme-dark");
      }
    },

    // ---------- 字号 ----------
    setFontSize(size) {
      this.fontSize = size;
      localStorage.setItem("sq-fontsize", size);
    },

    get fontSizeClass() {
      return `font-size-${this.fontSize}`;
    },

    // ---------- 键盘快捷键 ----------
    setupKeyboard() {
      document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        switch (e.key) {
          case "ArrowLeft":
            if (this.hasPrev) { e.preventDefault(); this.prevChapter(); }
            break;
          case "ArrowRight":
            if (this.hasNext) { e.preventDefault(); this.nextChapter(); }
            break;
          case "f":
          case "F":
            e.preventDefault();
            this.toggleImmersive();
            break;
          case "t":
          case "T":
            e.preventDefault();
            this.toggleTheme();
            break;
          case "Escape":
            if (this.immersiveMode) {
              e.preventDefault();
              this.toggleImmersive();
            }
            break;
        }
      });
    },

    // ---------- 工具 ----------
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    },

    updateUrl() {
      const url = new URL(window.location);
      url.searchParams.set("chapter", this.currentChapterId);
      window.history.replaceState({}, "", url);
    },

    get chapterLabel() {
      if (!this.currentChapter) return "";
      if (this.currentChapter.type === "preface") return "序言";
      if (this.currentChapter.type === "epilogue") return "终章";
      return `第 ${parseInt(this.currentChapter.id)} 章`;
    },

    get progressLabel() {
      const idx = CHAPTERS.findIndex(c => c.id === this.currentChapterId);
      return `${idx + 1} / ${CHAPTERS.length}`;
    }
  };
}

/* ---------- 首页逻辑 ---------- */
function homeApp() {
  return {
    theme: "light",
    continueChapter: null,

    init() {
      this.theme = localStorage.getItem("sq-theme") || "light";
      this.applyTheme();
      const saved = localStorage.getItem("sq-current-chapter");
      if (saved && saved !== "00") {
        const ch = CHAPTERS.find(c => c.id === saved);
        if (ch) this.continueChapter = ch;
      }
    },

    toggleTheme() {
      this.theme = this.theme === "light" ? "dark" : "light";
      this.applyTheme();
      localStorage.setItem("sq-theme", this.theme);
    },

    applyTheme() {
      if (this.theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.add("theme-dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.remove("theme-dark");
      }
    },

    get groupedChapters() {
      const groups = {};
      CHAPTERS.forEach(c => {
        if (!groups[c.part]) groups[c.part] = [];
        groups[c.part].push(c);
      });
      return groups;
    },

    startReading() {
      window.location.href = "read.html?chapter=00";
    },

    continueReading() {
      if (this.continueChapter) {
        window.location.href = `read.html?chapter=${this.continueChapter.id}`;
      }
    },

    goToChapter(id) {
      window.location.href = `read.html?chapter=${id}`;
    }
  };
}