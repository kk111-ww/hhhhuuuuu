(function () {
  'use strict';

  const STORAGE_KEY = 'rizha.diary.v1';
  const APP_VERSION = '1.0.0';
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const WEEKDAYS_MINI = ['日', '一', '二', '三', '四', '五', '六'];
  const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const MOODS = {
    joy: { label: '愉悦', color: 'var(--mood-joy)' },
    calm: { label: '平静', color: 'var(--mood-calm)' },
    excited: { label: '期待', color: 'var(--mood-excited)' },
    tired: { label: '疲惫', color: 'var(--mood-tired)' },
    down: { label: '低落', color: 'var(--mood-down)' },
    angry: { label: '烦躁', color: 'var(--mood-angry)' }
  };

  const WEATHERS = {
    sunny: { label: '晴', icon: 'i-sun' },
    cloudy: { label: '阴', icon: 'i-cloud' },
    rain: { label: '雨', icon: 'i-rain' },
    wind: { label: '风', icon: 'i-wind' },
    snow: { label: '雪', icon: 'i-snow' }
  };

  const PROMPTS = [
    '今天有没有哪个瞬间，让你忽然觉得生活很好？',
    '最近反复想起的一件事，是什么？',
    '如果给今天起一个名字，会是什么？',
    '今天，你为自己做了一件什么事？',
    '有没有一句话，你想留给未来的自己？',
    '此刻窗外是什么样子？试着写下来。',
    '今天最想感谢的人是谁？为什么？',
    '最近有什么小小的期待，正在发生？',
    '有什么话，你一直想说却没有说出口？',
    '今天吃到的最好的一口东西是什么？',
    '如果用一种颜色形容今天，会是什么颜色？',
    '此刻身体和心情，各是什么感觉？'
  ];

  const FACE_PATHS = {
    joy: '<circle cx="9" cy="10" r=".75" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".75" fill="currentColor" stroke="none"/><path d="M8.1 13.2c1 1.8 2.3 2.7 3.9 2.7s2.9-.9 3.9-2.7"/>',
    calm: '<path d="M8.2 10.6h1.5M14.3 10.6h1.5"/><path d="M8.7 13.7c1 .8 2.1 1.2 3.3 1.2s2.3-.4 3.3-1.2"/>',
    excited: '<path d="M8 10.2c.5-.5 1.1-.5 1.6 0M14.4 10.2c.5-.5 1.1-.5 1.6 0"/><path d="M7.8 12.8c1.1 2.4 2.5 3.6 4.2 3.6s3.1-1.2 4.2-3.6"/>',
    tired: '<path d="M8.1 10.7h1.7M14.2 10.7h1.7"/><path d="M8.7 14.4h6.6"/>',
    down: '<circle cx="9" cy="10.6" r=".7" fill="currentColor" stroke="none"/><circle cx="15" cy="10.6" r=".7" fill="currentColor" stroke="none"/><path d="M8.5 15.1c.9-1.5 2.1-2.3 3.5-2.3s2.6.8 3.5 2.3"/>',
    angry: '<path d="m7.9 9.7 2.2.7M16.1 9.7l-2.2.7"/><path d="M8.4 14.5c1.2-.7 2.4-1 3.6-1s2.4.3 3.6 1"/>'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pad2 = (value) => String(value).padStart(2, '0');

  let state;
  let ui;
  let editor = null;
  let searchActiveIndex = -1;
  let searchEntryIds = [];
  let searchReturnFocus = null;
  let settingsReturnFocus = null;
  let confirmReturnFocus = null;
  let confirmCallback = null;

  init();

  function init() {
    loadState();
    applyTheme();
    setShortcutLabels();
    updateSidebar();
    syncBodyLock();

    if (!location.hash) {
      history.replaceState(null, '', '#/home');
    }

    renderRoute();

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('hashchange', () => {
      closeSidebar(false);
      renderRoute();
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (state.settings.theme === 'system') applyTheme();
    };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);

    window.addEventListener('resize', () => {
      if (editor) autoGrowTextarea($('#entryBody'));
    });

    window.addEventListener('beforeunload', (event) => {
      if (!editor || !editor.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  /* =========================================================
     Data
     ========================================================= */

  function createInitialState() {
    return {
      version: 1,
      entries: createSeedEntries(),
      settings: { theme: 'system' },
      flags: { welcomeDismissed: false }
    };
  }

  function createSeedEntries() {
    const data = [
      {
        offset: 0,
        title: '风里有桂花的味道',
        mood: 'calm',
        weather: 'sunny',
        tags: ['生活', '秋天'],
        favorite: true,
        content: `今天下班，绕了一点远路，从老街穿过去。

有人在门口收被子，有人蹲在台阶上剥橘子，橘皮的颜色亮得像一小片灯。风一吹，桂花的香气从围墙里漫出来，忽然就觉得，秋天真的到了。

回家泡了杯热茶，把窗开了一条小缝。所谓好日子，大概就是这样一些很轻的瞬间。`
      },
      {
        offset: 1,
        title: '把房间收拾成喜欢的样子',
        mood: 'joy',
        weather: 'cloudy',
        tags: ['生活', '整理'],
        favorite: false,
        content: `花了整个下午，把书架重新理了一遍，旧杂志捆好，桌面只留下正在读的两本书和一只陶杯。

收拾到一半，翻出了去年旅行时带回来的车票，边角已经有点卷了。舍不得扔，夹进了笔记本里。

房间没有变大一寸，但坐下来的那一刻，觉得呼吸都松快了一些。原来整理房间，也是在整理心里那些乱糟糟的小事。`
      },
      {
        offset: 3,
        title: '读到一句很喜欢的话',
        mood: 'calm',
        weather: 'rain',
        tags: ['阅读'],
        favorite: false,
        content: `下午下了很大的雨，索性不出门，把剩下半本《山茶文具店》读完了。

书里有一句话，大意是：那些说不出口的话，就替他们好好写下来吧。读到的时候停了一会儿，想起很多没有回音的信，和那些最后没能说出口的话。

也许写日记也是这样。不是为了给谁看，只是把心里那些绕来绕去的句子，安安静静地放下来。`
      },
      {
        offset: 6,
        title: '晚饭后，去江边走了走',
        mood: 'excited',
        weather: 'wind',
        tags: ['散步', '城市'],
        favorite: false,
        content: `吃完饭天还亮着，临时决定去江边。风很大，把头发吹得乱七八糟，也把一整天的疲惫吹散了不少。

江面上有货轮慢慢经过，岸边有人遛狗、跑步、放很旧的老歌。走累了就在台阶上坐一会儿，看对岸的灯一盏一盏亮起来。

很久没有这样什么都不想地散步了。回去的路上买了一支冰淇淋，算是给今天的小奖励。`
      },
      {
        offset: 11,
        title: '项目收尾，长长地松了一口气',
        mood: 'tired',
        weather: 'cloudy',
        tags: ['工作'],
        favorite: false,
        content: `项目终于交了。最后一轮修改结束的时候，办公室里只剩我和窗外还没灭的几盏灯。

这一个月几乎每天都在赶，焦虑的时候会把待办清单看很多遍。现在回头想，真正难的可能不是事情本身，而是那种“总觉得自己还不够好”的声音。

不管怎样，先好好睡一觉。明天再想下一步。`
      },
      {
        offset: 18,
        title: '一个人也要好好吃饭',
        mood: 'joy',
        weather: 'sunny',
        tags: ['生活', '下厨'],
        favorite: true,
        content: `给自己做了番茄牛腩和一碗米饭，炖的时候满屋子都是香气。

以前总觉得一个人吃饭是凑合，现在慢慢开始享受这个过程：洗菜、切菜、听锅里咕嘟咕嘟的声音，时间变得很具体。

吃完把碗洗干净，给阳台的薄荷浇了水。今天也没有发生什么大事，但把自己照顾好了，就很值得记一笔。`
      },
      {
        offset: 34,
        title: '九月的最后一场雨',
        mood: 'calm',
        weather: 'rain',
        tags: ['季节', '生活'],
        favorite: false,
        content: `雨从凌晨开始下，到傍晚才停。没有出门，把夏天的衣服收进箱子，翻出两件薄毛衣。

季节交替的时候，人总会变得有点怀旧。想起很多年前也是这样的雨天，坐在教室最后一排，用课本挡着偷偷写日记。

晚上煮了一锅粥，配一小碟咸菜。窗外的雨声渐渐小了，忽然舍不得这一天结束。`
      },
      {
        offset: 62,
        title: '在旧书店待了一下午',
        mood: 'calm',
        weather: 'sunny',
        tags: ['阅读', '城市'],
        favorite: true,
        content: `在巷子里找到一家很小的旧书店，老板趴在柜台后面听收音机，几乎没抬头。

翻到一本八十年代的诗集，扉页上有陌生人的钢笔字：“愿你永远有重新出发的勇气。”字迹很轻，却让我看了很久。

最后只买了一本。走出书店的时候，夕阳正好落在青石板上。我决定以后也常来，把这里当成自己的秘密基地。`
      }
    ];

    return data.map((item, index) => {
      const date = addDays(new Date(), -item.offset);
      const dateISO = toISO(date);
      const created = new Date(date);
      created.setHours(20, 10 + index * 3, 0, 0);
      if (created > new Date()) created.setTime(Date.now() - (index + 1) * 27 * 60 * 1000);
      const iso = created.toISOString();
      return normalizeEntry({
        id: `seed-${index + 1}`,
        title: item.title,
        content: item.content,
        date: dateISO,
        mood: item.mood,
        weather: item.weather,
        tags: item.tags,
        favorite: item.favorite,
        createdAt: iso,
        updatedAt: iso
      });
    });
  }

  function loadState() {
    let saved = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (error) {
      saved = null;
    }

    if (!saved || !Array.isArray(saved.entries)) {
      state = createInitialState();
      saveState(true);
    } else {
      state = {
        version: 1,
        entries: saved.entries.map(normalizeEntry).filter(Boolean),
        settings: {
          theme: ['light', 'dark', 'system'].includes(saved.settings && saved.settings.theme)
            ? saved.settings.theme
            : 'system'
        },
        flags: {
          welcomeDismissed: Boolean(saved.flags && saved.flags.welcomeDismissed)
        }
      };
    }

    ui = {
      routeName: 'home',
      routeTag: null,
      promptOffset: 0,
      archiveQuery: '',
      archiveMood: 'all',
      archiveYear: 'all',
      calYear: null,
      calMonth: null,
      calSelected: null
    };
  }

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const now = new Date().toISOString();
    const date = isValidISODate(raw.date) ? raw.date : todayISO();
    let createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : now;
    let updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
    if (Number.isNaN(new Date(createdAt).getTime())) createdAt = now;
    if (Number.isNaN(new Date(updatedAt).getTime())) updatedAt = createdAt;
    const tags = Array.isArray(raw.tags) ? raw.tags : [];
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 100) : uid(),
      title: String(raw.title || '').slice(0, 140),
      content: String(raw.content || '').slice(0, 80000),
      date,
      mood: MOODS[raw.mood] ? raw.mood : 'calm',
      weather: WEATHERS[raw.weather] ? raw.weather : 'sunny',
      tags: uniqueTags(tags).slice(0, 8),
      favorite: Boolean(raw.favorite),
      createdAt,
      updatedAt
    };
  }

  function saveState(silent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      if (!silent) toast('保存失败，浏览器存储空间可能已满。请先导出备份。', 'warning');
      return false;
    }
  }

  function uid() {
    return `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function sortedEntries() {
    return state.entries.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function entriesForDate(dateISO) {
    return state.entries
      .filter((entry) => entry.date === dateISO)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function entriesByDate() {
    const map = new Map();
    state.entries.forEach((entry) => {
      const item = map.get(entry.date) || { count: 0, words: 0, entries: [] };
      item.count += 1;
      item.words += countChars(entry.content);
      item.entries.push(entry);
      map.set(entry.date, item);
    });
    return map;
  }

  function getAllTags() {
    const map = new Map();
    state.entries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));
  }

  function uniqueTags(tags) {
    const seen = new Set();
    const result = [];
    tags.forEach((tag) => {
      const clean = String(tag || '').trim().replace(/^#+/, '').slice(0, 18);
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      result.push(clean);
    });
    return result;
  }

  function totalWords() {
    return state.entries.reduce((sum, entry) => sum + countChars(entry.content), 0);
  }

  function countChars(text) {
    return String(text || '').replace(/\s/g, '').length;
  }

  function recordedDays() {
    return new Set(state.entries.map((entry) => entry.date)).size;
  }

  function computeStreak() {
    if (!state.entries.length) return 0;
    const dates = new Set(state.entries.map((entry) => entry.date));
    let cursor = parseISO(todayISO());
    if (!dates.has(toISO(cursor))) {
      cursor = addDays(cursor, -1);
      if (!dates.has(toISO(cursor))) return 0;
    }
    let streak = 0;
    while (dates.has(toISO(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
      if (streak > 3660) break;
    }
    return streak;
  }

  function favoriteCount() {
    return state.entries.filter((entry) => entry.favorite).length;
  }

  /* =========================================================
     Dates & formatting
     ========================================================= */

  function pad2Local(value) {
    return String(value).padStart(2, '0');
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad2Local(date.getMonth() + 1)}-${pad2Local(date.getDate())}`;
  }

  function todayISO() {
    return toISO(new Date());
  }

  function parseISO(value) {
    if (!isValidISODate(value)) return new Date();
    const parts = value.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isValidISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
  }

  function addDays(date, amount) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.floor((startOfDay(date) - start) / 86400000) + 1;
  }

  function daysInYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  }

  function weekdayShort(dateISO) {
    return WEEKDAYS_SHORT[parseISO(dateISO).getDay()];
  }

  function relativeDate(dateISO) {
    const today = todayISO();
    if (dateISO === today) return '今天';
    if (dateISO === toISO(addDays(parseISO(today), -1))) return '昨天';
    if (dateISO === toISO(addDays(parseISO(today), 1))) return '明天';
    const date = parseISO(dateISO);
    if (date.getFullYear() === new Date().getFullYear()) {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatLongDate(dateISO, withWeekday = true) {
    const date = parseISO(dateISO);
    const text = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    return withWeekday ? `${text} ${WEEKDAYS[date.getDay()]}` : text;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('zh-CN').format(value);
  }

  function formatClock(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function moodTint(moodKey) {
    return `color-mix(in srgb, var(--mood-${moodKey}) 13%, transparent)`;
  }

  /* =========================================================
     Theme & shell
     ========================================================= */

  function applyTheme() {
    const preference = state.settings.theme || 'system';
    const dark =
      preference === 'dark' ||
      (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#181512' : '#f4efe5');
    const toggle = $('[data-action="toggle-theme"]');
    if (toggle) toggle.setAttribute('aria-label', dark ? '切换为浅色纸张' : '切换为夜间纸张');
    $$('[data-theme-choice]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.themeChoice === preference);
    });
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    state.settings.theme = current === 'dark' ? 'light' : 'dark';
    saveState();
    applyTheme();
  }

  function setShortcutLabels() {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    $$('[data-shortcut-search]').forEach((el) => {
      el.textContent = isMac ? '⌘ K' : 'Ctrl K';
    });
  }

  function updateSidebar() {
    const now = new Date();
    const dayEl = $('#sideDay');
    const monthEl = $('#sideMonth');
    const weekEl = $('#sideWeek');
    const yearEl = $('#sideYear');
    if (dayEl) dayEl.textContent = pad2(now.getDate());
    if (monthEl) monthEl.textContent = MONTH_NAMES[now.getMonth()];
    if (weekEl) weekEl.textContent = WEEKDAYS[now.getDay()];
    if (yearEl) yearEl.textContent = String(now.getFullYear());

    const navCount = $('#navCount');
    if (navCount) navCount.textContent = String(state.entries.length);

    const tagNav = $('#tagNav');
    if (!tagNav) return;
    const tags = getAllTags().slice(0, 7);
    if (!tags.length) {
      tagNav.innerHTML = '<p class="tag-nav-empty">写下第一篇，就会有标签了。</p>';
      return;
    }
    tagNav.innerHTML = tags
      .map(
        (item) =>
          `<a class="tag-link" href="#/tag/${encodeURIComponent(item.tag)}" data-tag="${escapeHTML(
            item.tag
          )}"><span class="tag-link-name">${escapeHTML(item.tag)}</span><span class="tag-link-count">${item.count}</span></a>`
      )
      .join('');
    setActiveNav(ui.routeName, ui.routeTag);
  }

  function setActiveNav(routeName, tag) {
    const navName = routeName === 'tag' ? 'entries' : routeName;
    $$('.nav-item[data-nav]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.nav === navName);
    });
    $$('.tag-link[data-tag]').forEach((item) => {
      item.classList.toggle('is-active', routeName === 'tag' && item.dataset.tag === tag);
    });
  }

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    syncBodyLock();
    const close = $('.sidebar-close');
    if (close) setTimeout(() => close.focus(), 80);
  }

  function closeSidebar(restoreFocus) {
    if (!document.body.classList.contains('sidebar-open')) return;
    document.body.classList.remove('sidebar-open');
    syncBodyLock();
    if (restoreFocus !== false) {
      const menu = $('.menu-btn');
      if (menu) menu.focus();
    }
  }

  function syncBodyLock() {
    const hasOverlay =
      editorRootHasContent() ||
      searchRootHasContent() ||
      settingsRootHasContent() ||
      confirmRootHasContent();
    document.body.classList.toggle('overlay-open', hasOverlay);
    document.body.classList.toggle(
      'sidebar-open',
      document.body.classList.contains('sidebar-open') && !hasOverlay
    );
  }

  function editorRootHasContent() {
    return Boolean($('#editorRoot') && $('#editorRoot').firstElementChild);
  }

  function searchRootHasContent() {
    return Boolean($('#searchRoot') && $('#searchRoot').firstElementChild);
  }

  function settingsRootHasContent() {
    return Boolean($('#settingsRoot') && $('#settingsRoot').firstElementChild);
  }

  function confirmRootHasContent() {
    return Boolean($('#confirmRoot') && $('#confirmRoot').firstElementChild);
  }

  /* =========================================================
     Routing & page chrome
     ========================================================= */

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { name: 'home', tag: null, date: null };
    const parts = raw.split('/');
    const head = parts[0];
    if (head === 'tag' && parts.length > 1) {
      try {
        return { name: 'tag', tag: decodeURIComponent(parts.slice(1).join('/')), date: null };
      } catch (error) {
        return { name: 'entries', tag: null, date: null };
      }
    }
    if (head === 'calendar' && parts[1] && isValidISODate(parts[1])) {
      return { name: 'calendar', tag: null, date: parts[1] };
    }
    if (['home', 'entries', 'calendar', 'insights', 'favorites'].includes(head)) {
      return { name: head, tag: null, date: null };
    }
    return { name: 'home', tag: null, date: null };
  }

  function renderRoute(options) {
    const opts = options || {};
    const route = parseRoute();

    if (route.name === 'calendar' && route.date) {
      setCalendarDate(route.date);
      history.replaceState(null, '', '#/calendar');
    }

    ui.routeName = route.name;
    ui.routeTag = route.tag || null;

    if (route.name === 'calendar') ensureCalendarState();

    const meta = {
      home: { crumb: '书桌', title: '日札 · 把日子写成书' },
      entries: { crumb: '全部日记', title: '全部日记 · 日札' },
      calendar: { crumb: '日历', title: '日历 · 日札' },
      insights: { crumb: '心情手记', title: '心情手记 · 日札' },
      favorites: { crumb: '收藏', title: '收藏 · 日札' },
      tag: { crumb: `# ${route.tag || ''}`, title: `${route.tag || '标签'} · 日札` }
    }[route.name];

    const crumb = $('#crumbCurrent');
    if (crumb) crumb.textContent = meta.crumb;
    document.title = meta.title;
    setActiveNav(ui.routeName, ui.routeTag);
    paintView();

    if (opts.scroll !== false) {
      window.scrollTo(0, 0);
    }
  }

  function paintView() {
    const view = $('#view');
    if (!view) return;
    view.innerHTML =
      ui.routeName === 'home'
        ? renderHomePage()
        : ui.routeName === 'entries' || ui.routeName === 'tag'
          ? renderEntriesPage()
          : ui.routeName === 'calendar'
            ? renderCalendarPage()
            : ui.routeName === 'insights'
              ? renderInsightsPage()
              : renderFavoritesPage();
  }

  /* =========================================================
     Home
     ========================================================= */

  function renderHomePage() {
    const now = new Date();
    const today = todayISO();
    const dateMap = entriesByDate();
    const entries = sortedEntries();
    const recent = entries.slice(0, 4);
    const streak = computeStreak();
    const words = totalWords();
    const days = recordedDays();
    const greeting =
      now.getHours() < 5
        ? '夜深了'
        : now.getHours() < 11
          ? '早安'
          : now.getHours() < 14
            ? '午安'
            : now.getHours() < 18
              ? '午后好'
              : now.getHours() < 23
                ? '晚上好'
                : '夜深了';

    const welcome =
      !state.flags.welcomeDismissed && state.entries.some((entry) => entry.id.indexOf('seed-') === 0)
        ? `<div class="welcome-note">
             <svg class="icon"><use href="#i-sparkle"></use></svg>
             <p>这是刚翻开的一本日记。我们放了几页示例，供你先逛逛；从今天起，这里只属于你。</p>
             <a class="link-btn" href="#/entries">看看示例 <svg class="icon"><use href="#i-arrow-right"></use></svg></a>
             <button class="welcome-close" type="button" data-action="dismiss-welcome" aria-label="不再显示提示"><svg class="icon"><use href="#i-close"></use></svg></button>
           </div>`
        : '';

    return `<div class="home">
      <section class="hero">
        <div class="hero-kicker">
          <span class="greeting">${greeting}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日</span>
          <span class="dot" aria-hidden="true"></span>
          <span>${WEEKDAYS[now.getDay()]}</span>
          <span class="dot" aria-hidden="true"></span>
          <span>第 ${dayOfYear(now)} 天 · 今年还剩 ${daysInYear(now.getFullYear()) - dayOfYear(now)} 天</span>
        </div>
        <h1 class="hero-title">今天，也值得<br>被<em>好好记住</em>。</h1>
        <p class="hero-copy">日子平常，也值得被认真收藏。把此刻的心情写下来，等很久以后再翻，字里行间都是今天的风。</p>
        <div class="hero-actions">
          <button class="btn btn-primary" type="button" data-action="new-entry"><svg class="icon"><use href="#i-feather"></use></svg>写下此刻</button>
          <a class="btn btn-outline" href="#/entries">翻翻从前 <svg class="icon"><use href="#i-arrow-right"></use></svg></a>
        </div>
        <div class="hero-meta" aria-label="写作统计">
          <div class="hero-stat"><strong>${streak}<small>天</small></strong><span>连续记录</span></div>
          <div class="hero-stat"><strong>${state.entries.length}<small>篇</small></strong><span>写下的日记</span></div>
          <div class="hero-stat"><strong>${formatNumber(words)}<small>字</small></strong><span>累计字数</span></div>
          <div class="hero-stat"><strong>${days}<small>天</small></strong><span>有文字的日子</span></div>
        </div>
        <div class="hero-stamp" aria-label="${formatLongDate(today)}">
          <svg class="stamp-ring" viewBox="0 0 160 160" aria-hidden="true">
            <circle class="ring-outer" cx="80" cy="80" r="76"></circle>
            <circle class="ring-inner" cx="80" cy="80" r="68"></circle>
            <path d="M80 4v8M80 148v8M4 80h8M148 80h8" opacity=".55"></path>
          </svg>
          <div class="stamp-content">
            <span class="stamp-month">${MONTHS_EN[now.getMonth()]} · ${MONTH_NAMES[now.getMonth()]}</span>
            <strong class="stamp-day">${pad2(now.getDate())}</strong>
            <span class="stamp-week">${WEEKDAYS[now.getDay()]}</span>
          </div>
          <svg class="stamp-leaf" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M42 5C24 5 9 13 9 28c0 7 5 12 12 12 14 0 21-19 21-35Z"></path>
            <path d="M5 43c5-11 14-20 28-27M16 31c3 1 7 1 10-1M22 24c2 1 5 1 8-1"></path>
          </svg>
        </div>
      </section>
      ${welcome}
      <div class="home-grid">
        <section class="recent" aria-labelledby="recent-title">
          <div class="section-head">
            <h2 class="section-title" id="recent-title">最近的页 <small>RECENT PAGES</small></h2>
            <a class="link-btn" href="#/entries">全部日记 <svg class="icon"><use href="#i-arrow-right"></use></svg></a>
          </div>
          ${
            recent.length
              ? `<div class="entry-grid home-feed">${recent.map((entry) => entryCardHTML(entry)).join('')}</div>`
              : emptyStateHTML('这一页，还空着', '写下第一行字，日记就会从这里开始。', true)
          }
        </section>
        <aside class="home-aside" aria-label="写作提示与日历">
          <div class="prompt-card">
            <span class="prompt-label">今日一问</span>
            <p class="prompt-text">${escapeHTML(currentPrompt())}</p>
            <div class="prompt-foot">
              <button class="prompt-shuffle" type="button" data-action="shuffle-prompt"><svg class="icon"><use href="#i-sparkle"></use></svg>换一个</button>
              <button class="prompt-write" type="button" data-action="new-entry">开始写 <svg class="icon"><use href="#i-arrow-right"></use></svg></button>
            </div>
          </div>
          ${miniCalendarHTML(now.getFullYear(), now.getMonth(), dateMap)}
          <p class="aside-note">“写作，是把易逝的日子，<br>折成可以反复打开的信。”</p>
        </aside>
      </div>
    </div>`;
  }

  function currentPrompt() {
    return PROMPTS[(dayOfYear(new Date()) + ui.promptOffset) % PROMPTS.length];
  }

  function miniCalendarHTML(year, month, dateMap) {
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = first.getDay();
    const today = todayISO();
    let cells = '';
    for (let i = 0; i < offset; i += 1) {
      cells += '<span class="mini-day is-blank" aria-hidden="true"></span>';
    }
    for (let day = 1; day <= days; day += 1) {
      const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      const hasEntry = dateMap.has(iso);
      cells += `<button class="mini-day${hasEntry ? ' has-entry' : ''}${iso === today ? ' is-today' : ''}" type="button" data-action="jump-calendar" data-date="${iso}" aria-label="${formatLongDate(iso)}${hasEntry ? '，有日记' : ''}">${day}</button>`;
    }

    let monthEntries = 0;
    let monthDays = 0;
    dateMap.forEach((value, iso) => {
      if (iso.startsWith(`${year}-${pad2(month + 1)}`)) {
        monthEntries += value.count;
        monthDays += 1;
      }
    });

    return `<div class="mini-calendar">
      <div class="mini-cal-head">
        <span class="mini-cal-title">${MONTH_NAMES[month]} <span>${year}</span></span>
        <a class="mini-cal-link" href="#/calendar">全览 →</a>
      </div>
      <div class="mini-weekdays" aria-hidden="true">${WEEKDAYS_MINI.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="mini-days">${cells}</div>
      <div class="mini-cal-foot"><strong>${monthDays}</strong> 天有记录 · 共 ${monthEntries} 页</div>
    </div>`;
  }

  /* =========================================================
     Entry cards
     ========================================================= */

  function entryCardHTML(entry) {
    const mood = MOODS[entry.mood] || MOODS.calm;
    const weather = WEATHERS[entry.weather] || WEATHERS.sunny;
    const title = entry.title || '无题';
    const excerpt = entry.content.replace(/\s+/g, ' ').trim().slice(0, 140) || '这一页只有题目，也很好。';
    const tags = entry.tags
      .slice(0, 3)
      .map((tag) => `<span class="tag">#${escapeHTML(tag)}</span>`)
      .join('');

    return `<article class="entry-card" role="button" tabindex="0" data-action="open-entry" data-entry-id="${escapeHTML(
      entry.id
    )}" aria-label="打开日记：${escapeHTML(title)}，${formatLongDate(entry.date)}" style="--mood-color:var(--mood-${
      entry.mood
    });--mood-tint:${moodTint(entry.mood)}">
      <div class="entry-top">
        <time class="entry-date" datetime="${entry.date}">${relativeDate(entry.date)}</time>
        <span class="entry-weekday">${weekdayShort(entry.date)}</span>
        <span class="entry-mood" title="${mood.label}">${moodFace(entry.mood)}${mood.label}</span>
        <button class="fav-btn${entry.favorite ? ' is-fav' : ''}" type="button" data-action="toggle-favorite" data-id="${escapeHTML(
          entry.id
        )}" aria-label="${entry.favorite ? '取消收藏' : '收藏这一页'}" aria-pressed="${entry.favorite}">
          <svg class="icon"><use href="#i-star"></use></svg>
        </button>
      </div>
      <h3 class="entry-title">${escapeHTML(title)}</h3>
      <p class="entry-excerpt">${escapeHTML(excerpt)}</p>
      <div class="entry-foot">
        <div class="tag-list">${tags}</div>
        <span class="entry-weather" title="${weather.label}"><svg class="icon"><use href="#${weather.icon}"></use></svg></span>
      </div>
    </article>`;
  }

  function moodFace(moodKey) {
    const path = FACE_PATHS[moodKey] || FACE_PATHS.calm;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle>${path}</svg>`;
  }

  function emptyStateHTML(title, description, withAction, actionLabel, action) {
    return `<div class="empty-state">
      <div class="empty-art"><svg class="icon"><use href="#i-feather"></use></svg></div>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(description)}</p>
      ${
        withAction
          ? `<button class="btn btn-soft" type="button" data-action="${action || 'new-entry'}">${escapeHTML(
              actionLabel || '写下第一篇'
            )}<svg class="icon"><use href="#i-arrow-right"></use></svg></button>`
          : ''
      }
    </div>`;
  }

  /* =========================================================
     Archive
     ========================================================= */

  function archiveEntries(tag) {
    let list = sortedEntries();
    if (tag) list = list.filter((entry) => entry.tags.includes(tag));
    if (ui.archiveMood !== 'all') list = list.filter((entry) => entry.mood === ui.archiveMood);
    if (ui.archiveYear !== 'all') list = list.filter((entry) => entry.date.slice(0, 4) === ui.archiveYear);
    const query = ui.archiveQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((entry) => {
        const haystack = `${entry.title}\n${entry.content}\n${entry.tags.join(' ')}`.toLowerCase();
        return haystack.includes(query);
      });
    }
    return list;
  }

  function renderEntriesPage() {
    const tag = ui.routeTag;
    const allEntries = sortedEntries();
    const years = Array.from(new Set(allEntries.map((entry) => entry.date.slice(0, 4)))).sort(
      (a, b) => Number(b) - Number(a)
    );
    if (ui.archiveYear !== 'all' && !years.includes(ui.archiveYear)) ui.archiveYear = 'all';
    const list = archiveEntries(tag);
    const isTag = Boolean(tag);
    const isFiltered =
      Boolean(ui.archiveQuery.trim()) || ui.archiveMood !== 'all' || ui.archiveYear !== 'all' || isTag;

    const empty = emptyStateHTML(
      allEntries.length ? '没有找到相符的页' : '日记本还是空的',
      allEntries.length
        ? '换一个关键词，或者把筛选条件放宽一点。'
        : '不用等到特别的一天，现在就可以写下第一行。',
      !allEntries.length,
      '写下第一篇'
    );

    return `<div class="page archive-page">
      <header class="page-head">
        <div>
          <div class="eyebrow page-eyebrow">${isTag ? 'TAG · 标签' : 'ARCHIVE · 日记归档'}</div>
          <h1 class="page-title">${isTag ? `# ${escapeHTML(tag)}` : '所有日记'}</h1>
          <p class="page-desc">${isTag ? `所有标记为「${escapeHTML(tag)}」的页。` : '所有认真生活过的证据，都安静地收在这里。'}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" data-action="new-entry"><svg class="icon"><use href="#i-feather"></use></svg>写日记</button>
        </div>
      </header>
      <div class="archive-toolbar">
        <label class="search-field">
          <svg class="icon"><use href="#i-search"></use></svg>
          <input id="archiveSearch" type="search" value="${escapeHTML(ui.archiveQuery)}" placeholder="搜索标题、内容或标签" aria-label="搜索日记">
        </label>
        <div class="select-wrap">
          <select class="filter-select" id="archiveMood" aria-label="按心情筛选">
            <option value="all">全部心情</option>
            ${Object.keys(MOODS)
              .map(
                (key) =>
                  `<option value="${key}"${ui.archiveMood === key ? ' selected' : ''}>${MOODS[key].label}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="select-wrap">
          <select class="filter-select" id="archiveYear" aria-label="按年份筛选">
            <option value="all">全部年份</option>
            ${years
              .map(
                (year) =>
                  `<option value="${year}"${ui.archiveYear === year ? ' selected' : ''}>${year} 年</option>`
              )
              .join('')}
          </select>
        </div>
        <span class="archive-meta" id="archiveMeta">${list.length} 篇 · ${formatNumber(
          list.reduce((sum, entry) => sum + countChars(entry.content), 0)
        )} 字</span>
      </div>
      ${
        isTag
          ? `<div class="active-filter">标签：${escapeHTML(tag)}<button type="button" data-action="clear-filters" aria-label="清除标签筛选"><svg class="icon"><use href="#i-close"></use></svg></button></div>`
          : isFiltered
            ? `<div class="active-filter">已筛选 ${list.length} 页<button type="button" data-action="clear-filters" aria-label="清除筛选"><svg class="icon"><use href="#i-close"></use></svg></button></div>`
            : ''
      }
      <div class="entry-grid archive-grid" id="archiveGrid">
        ${list.length ? list.map((entry) => entryCardHTML(entry)).join('') : `<div class="archive-empty">${empty}</div>`}
      </div>
    </div>`;
  }

  function updateArchiveResults() {
    const grid = $('#archiveGrid');
    if (!grid) return;
    const tag = ui.routeTag;
    const list = archiveEntries(tag);
    const meta = $('#archiveMeta');
    if (meta) {
      meta.textContent = `${list.length} 篇 · ${formatNumber(
        list.reduce((sum, entry) => sum + countChars(entry.content), 0)
      )} 字`;
    }
    if (list.length) {
      grid.innerHTML = list.map((entry) => entryCardHTML(entry)).join('');
    } else {
      const hasAny = state.entries.length > 0;
      grid.innerHTML = `<div class="archive-empty">${emptyStateHTML(
        hasAny ? '没有找到相符的页' : '日记本还是空的',
        hasAny ? '换一个关键词，或者把筛选条件放宽一点。' : '不用等到特别的一天，现在就可以写下第一行。',
        !hasAny,
        '写下第一篇'
      )}</div>`;
    }
  }

  function clearFilters() {
    ui.archiveQuery = '';
    ui.archiveMood = 'all';
    ui.archiveYear = 'all';
    if (ui.routeName === 'tag') {
      location.hash = '#/entries';
    } else {
      renderRoute({ scroll: false });
    }
  }

  /* =========================================================
     Favorites
     ========================================================= */

  function renderFavoritesPage() {
    const favorites = sortedEntries().filter((entry) => entry.favorite);
    return `<div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow page-eyebrow">KEPT · 收藏</div>
          <h1 class="page-title">舍不得忘记的页</h1>
          <p class="page-desc">${favorites.length ? `有 ${favorites.length} 页被你轻轻标了星，放在手边。` : '遇到想反复读的页，点亮右上角的星，它就会留在这里。'}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" data-action="new-entry"><svg class="icon"><use href="#i-feather"></use></svg>写日记</button>
        </div>
      </header>
      <div class="entry-grid archive-grid" style="margin-top:26px">
        ${
          favorites.length
            ? favorites.map((entry) => entryCardHTML(entry)).join('')
            : emptyStateHTML('还没有收藏的页', '去日记本里翻一翻，总有一页值得被留下。', false)
        }
      </div>
    </div>`;
  }

  /* =========================================================
     Calendar
     ========================================================= */

  function ensureCalendarState() {
    if (ui.calYear === null || ui.calMonth === null || !ui.calSelected) {
      const today = new Date();
      ui.calYear = today.getFullYear();
      ui.calMonth = today.getMonth();
      ui.calSelected = todayISO();
    }
  }

  function setCalendarDate(dateISO) {
    if (!isValidISODate(dateISO)) return;
    const date = parseISO(dateISO);
    ui.calYear = date.getFullYear();
    ui.calMonth = date.getMonth();
    ui.calSelected = dateISO;
  }

  function renderCalendarPage() {
    ensureCalendarState();
    const year = ui.calYear;
    const month = ui.calMonth;
    const monthEntries = state.entries.filter(
      (entry) => entry.date.startsWith(`${year}-${pad2(month + 1)}`)
    );
    const selectedEntries = entriesForDate(ui.calSelected);

    return `<div class="page calendar-page">
      <header class="page-head">
        <div>
          <div class="eyebrow page-eyebrow">CALENDAR · 日子</div>
          <h1 class="page-title">日历</h1>
          <p class="page-desc">日子一格一格地过去。点开某一天，就能翻回当时的光景。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" data-action="new-entry"><svg class="icon"><use href="#i-feather"></use></svg>写日记</button>
        </div>
      </header>
      <div class="calendar-layout">
        <section class="calendar-card" aria-label="${year}年${month + 1}月">
          <div class="calendar-top">
            <div class="calendar-heading">
              <strong>${MONTH_NAMES[month]}</strong>
              <span>${year} · ${monthEntries.length} 篇</span>
            </div>
            <div class="month-nav">
              <button class="today-btn" type="button" data-action="calendar-today">今天</button>
              <button class="icon-btn" type="button" data-action="prev-month" aria-label="上个月"><svg class="icon"><use href="#i-chevron-left"></use></svg></button>
              <button class="icon-btn" type="button" data-action="next-month" aria-label="下个月"><svg class="icon"><use href="#i-chevron-right"></use></svg></button>
            </div>
          </div>
          <div class="calendar-weekdays" aria-hidden="true">${WEEKDAYS_MINI.map((day) => `<span>${day}</span>`).join('')}</div>
          <div class="calendar-grid">${calendarGridHTML(year, month)}</div>
        </section>
        ${dayPanelHTML(ui.calSelected, selectedEntries)}
      </div>
    </div>`;
  }

  function calendarGridHTML(year, month) {
    const first = new Date(year, month, 1);
    const start = addDays(first, -first.getDay());
    const dateMap = entriesByDate();
    const today = todayISO();
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(start, index);
      const iso = toISO(date);
      const inMonth = date.getMonth() === month;
      const dayEntries = dateMap.get(iso);
      const dots = dayEntries
        ? dayEntries.entries
            .slice(0, 3)
            .map(
              (entry) =>
                `<i class="cal-dot" style="--mood-color:var(--mood-${entry.mood})"></i>`
            )
            .join('')
        : '';
      const more =
        dayEntries && dayEntries.count > 3
          ? `<span class="cal-more">+${dayEntries.count - 3}</span>`
          : '';
      cells.push(`<button class="cal-day${inMonth ? '' : ' other-month'}${iso === today ? ' is-today' : ''}${
        iso === ui.calSelected ? ' is-selected' : ''
      }" type="button" data-action="select-calendar-day" data-date="${iso}" aria-label="${formatLongDate(
        iso
      )}${dayEntries ? `，${dayEntries.count} 篇日记` : ''}" aria-pressed="${iso === ui.calSelected}">
        <span class="cal-num">${date.getDate()}</span>
        <span class="cal-dots">${dots}${more}</span>
      </button>`);
    }
    return cells.join('');
  }

  function dayPanelHTML(dateISO, entries) {
    const isToday = dateISO === todayISO();
    return `<aside class="day-panel" aria-label="选中日期的日记">
      <div class="day-panel-head">
        <div class="day-panel-date"><strong>${parseISO(dateISO).getMonth() + 1}月${parseISO(dateISO).getDate()}日</strong><span>${WEEKDAYS[parseISO(dateISO).getDay()]}</span></div>
        <p class="day-panel-sub">${isToday ? '今天' : relativeDate(dateISO)} ${entries.length ? `· 写下 ${entries.length} 页` : '· 还没有落笔'}</p>
      </div>
      ${
        entries.length
          ? `<div class="day-entries">${entries
              .map(
                (entry) => `<button class="day-entry" type="button" data-action="open-entry" data-entry-id="${escapeHTML(
                  entry.id
                )}">
                  <span class="day-entry-title">${escapeHTML(entry.title || '无题')}</span>
                  <span class="day-entry-meta">
                    <span class="day-entry-mood" style="--mood-color:var(--mood-${entry.mood})"><i></i>${(MOODS[entry.mood] || MOODS.calm).label}</span>
                    <span>${formatClock(entry.createdAt)}</span>
                    ${entry.favorite ? '<span>★ 已收藏</span>' : ''}
                  </span>
                </button>`
              )
              .join('')}</div>`
          : `<p class="day-empty">这一天空着，<br>像一张等你落笔的纸。</p>`
      }
      <button class="add-day-btn" type="button" data-action="new-entry" data-date="${dateISO}"><svg class="icon"><use href="#i-plus"></use></svg>${isToday ? '写下今天' : '为这一天补一页'}</button>
    </aside>`;
  }

  function selectCalendarDate(dateISO) {
    if (!isValidISODate(dateISO)) return;
    setCalendarDate(dateISO);
    paintView();
    requestAnimationFrame(() => {
      const selected = $(`.cal-day[data-date="${dateISO}"]`);
      if (selected) selected.focus({ preventScroll: true });
    });
  }

  function moveCalendarMonth(delta) {
    ensureCalendarState();
    const base = new Date(ui.calYear, ui.calMonth + delta, 1);
    ui.calYear = base.getFullYear();
    ui.calMonth = base.getMonth();
    const now = new Date();
    ui.calSelected =
      now.getFullYear() === ui.calYear && now.getMonth() === ui.calMonth
        ? todayISO()
        : `${ui.calYear}-${pad2(ui.calMonth + 1)}-01`;
    paintView();
  }

  /* =========================================================
     Insights
     ========================================================= */

  function renderInsightsPage() {
    const entries = sortedEntries();
    const words = totalWords();
    const days = recordedDays();
    const streak = computeStreak();
    const favorites = favoriteCount();
    const moodCounts = getMoodCounts();
    const topMood = Object.keys(MOODS)
      .map((key) => ({ key, count: moodCounts[key] }))
      .sort((a, b) => b.count - a.count)[0];
    const totalForMood = Object.values(moodCounts).reduce((sum, count) => sum + count, 0);
    const tags = getAllTags();
    const favoritePages = favorites;
    const average = entries.length ? Math.round(words / entries.length) : 0;

    return `<div class="page insights-page">
      <header class="page-head">
        <div>
          <div class="eyebrow page-eyebrow">MOOD NOTES · 心情手记</div>
          <h1 class="page-title">写下的日子，<br>慢慢长成了生活。</h1>
          <p class="page-desc">不必每天都很精彩。这些零散的记录，正在替你保存一个真实的自己。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" data-action="new-entry"><svg class="icon"><use href="#i-feather"></use></svg>写日记</button>
        </div>
      </header>
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-label"><svg class="icon"><use href="#i-book"></use></svg>日记总数</span>
          <div class="stat-value">${entries.length}<small>篇</small></div>
          <p class="stat-note">平均每篇 ${average} 字</p>
        </div>
        <div class="stat-card">
          <span class="stat-label"><svg class="icon"><use href="#i-feather"></use></svg>累计字数</span>
          <div class="stat-value">${formatNumber(words)}<small>字</small></div>
          <p class="stat-note">有 ${days} 天留下了文字</p>
        </div>
        <div class="stat-card">
          <span class="stat-label"><svg class="icon"><use href="#i-sparkle"></use></svg>连续记录</span>
          <div class="stat-value">${streak}<small>天</small></div>
          <p class="stat-note">${streak ? '让今天也留下一点什么' : '写下一篇，连续记录就开始了'}</p>
        </div>
        <div class="stat-card">
          <span class="stat-label"><svg class="icon"><use href="#i-star"></use></svg>收藏的页</span>
          <div class="stat-value">${favoritePages}<small>篇</small></div>
          <p class="stat-note">${favoritePages ? '值得反复读的瞬间' : '给喜欢的页标一颗星吧'}</p>
        </div>
      </div>
      <div class="insight-grid">
        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">心情的气候</h2>
            <span class="panel-hint">${topMood.count ? `常见 · ${MOODS[topMood.key].label}` : 'ALL TIME'}</span>
          </div>
          ${
            entries.length
              ? `<div class="mood-bars">${Object.keys(MOODS)
                  .map((key) => {
                    const count = moodCounts[key];
                    const percentage = totalForMood ? (count / totalForMood) * 100 : 0;
                    return `<div class="mood-row" style="--mood-color:${MOODS[key].color}">
                      <span class="mood-row-label"><i></i>${MOODS[key].label}</span>
                      <span class="mood-track"><span class="mood-fill" style="--width:${Math.max(
                        count ? 3 : 0,
                        percentage
                      )}%"></span></span>
                      <span class="mood-row-count">${count} 篇</span>
                    </div>`;
                  })
                  .join('')}</div>`
              : `<p class="insight-empty">写下几页之后，这里会出现你的心情气候。</p>`
          }
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">常写的主题</h2>
            <span class="panel-hint">${tags.length} 个标签</span>
          </div>
          ${
            tags.length
              ? `<div class="tag-cloud">${tags
                  .slice(0, 12)
                  .map(
                    (item, index) =>
                      `<a class="tag ${index === 0 ? 'tag-size-lg' : index < 3 ? 'tag-size-md' : ''}" href="#/tag/${encodeURIComponent(
                        item.tag
                      )}">#${escapeHTML(item.tag)} <span style="opacity:.55">${item.count}</span></a>`
                  )
                  .join('')}</div>`
              : `<p class="insight-empty">给日记加上标签，慢慢地就能看见自己关心的事。</p>`
          }
          <div class="rhythm-note"><svg class="icon"><use href="#i-leaf"></use></svg><span>${rhythmNote(
            entries,
            average
          )}</span></div>
        </section>
        <section class="panel panel-wide">
          <div class="panel-head">
            <h2 class="panel-title">写作的足迹</h2>
            <span class="panel-hint">最近 16 周</span>
          </div>
          ${heatmapHTML()}
        </section>
        <section class="panel panel-wide">
          <div class="panel-head">
            <h2 class="panel-title">${new Date().getFullYear()} 年的书写</h2>
            <span class="panel-hint">1–12 月 · 每月篇数</span>
          </div>
          ${monthChartHTML()}
        </section>
      </div>
    </div>`;
  }

  function getMoodCounts() {
    const counts = {};
    Object.keys(MOODS).forEach((key) => {
      counts[key] = 0;
    });
    state.entries.forEach((entry) => {
      counts[entry.mood] = (counts[entry.mood] || 0) + 1;
    });
    return counts;
  }

  function rhythmNote(entries, average) {
    if (!entries.length) return '第一笔写下去，日子就开始留下形状。';
    const counts = [0, 0, 0, 0, 0, 0, 0];
    entries.forEach((entry) => {
      counts[parseISO(entry.date).getDay()] += 1;
    });
    let best = 0;
    counts.forEach((count, index) => {
      if (count > counts[best]) best = index;
    });
    return `你写得最多的是${WEEKDAYS[best]}，平均每篇 ${average} 字。文字不一定每天都有，但每一次落笔，都是在认真生活。`;
  }

  function heatmapHTML() {
    const dateMap = entriesByDate();
    const today = startOfDay(new Date());
    const dayIndex = (today.getDay() + 6) % 7;
    const start = addDays(today, -dayIndex - 15 * 7);
    let cells = '';
    for (let index = 0; index < 16 * 7; index += 1) {
      const date = addDays(start, index);
      const iso = toISO(date);
      if (date > today) {
        cells += '<span class="heat-cell heat-empty"></span>';
        continue;
      }
      const stats = dateMap.get(iso);
      const words = stats ? stats.words : 0;
      const level = words === 0 ? 0 : words < 140 ? 1 : words < 320 ? 2 : words < 620 ? 3 : 4;
      const titleText = stats ? `${formatLongDate(iso)} · ${stats.count} 篇 · ${formatNumber(words)} 字` : `${formatLongDate(iso)} · 没有记录`;
      cells += `<span class="heat-cell level-${level}" title="${titleText}" aria-label="${titleText}"></span>`;
    }
    return `<div class="heatmap-scroll"><div class="heat-grid" role="img" aria-label="最近十六周的写作热力图">${cells}</div></div>
      <div class="heat-legend"><span>少</span><i></i><i></i><i></i><i></i><i></i><span>多</span></div>`;
  }

  function monthChartHTML() {
    const year = new Date().getFullYear();
    const counts = Array.from({ length: 12 }, () => 0);
    state.entries.forEach((entry) => {
      if (Number(entry.date.slice(0, 4)) === year) {
        counts[Number(entry.date.slice(5, 7)) - 1] += 1;
      }
    });
    const max = Math.max(...counts, 0);
    return `<div class="month-chart">${counts
      .map((count, index) => {
        const height = max ? Math.max(3, Math.round((count / max) * 105)) : 3;
        return `<div class="month-col" title="${index + 1}月 · ${count} 篇">
          <span class="month-count">${count}</span>
          <span class="month-bar" style="height:${height}px"></span>
          <span class="month-label">${index + 1}</span>
        </div>`;
      })
      .join('')}</div>`;
  }

  /* =========================================================
     Editor
     ========================================================= */

  function openEditor(id, presetDate) {
    if (editor) return;
    const existing = id ? state.entries.find((entry) => entry.id === id) : null;
    if (id && !existing) {
      toast('这一页好像已经被删掉了。', 'warning');
      return;
    }

    const draft = existing
      ? {
          id: existing.id,
          title: existing.title,
          content: existing.content,
          date: existing.date,
          mood: existing.mood,
          weather: existing.weather,
          tags: existing.tags.slice(),
          favorite: existing.favorite,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt
        }
      : {
          id: null,
          title: '',
          content: '',
          date: isValidISODate(presetDate) ? presetDate : todayISO(),
          mood: 'calm',
          weather: 'sunny',
          tags: [],
          favorite: false,
          createdAt: null,
          updatedAt: null
        };

    editor = {
      isNew: !existing,
      draft,
      dirty: false,
      returnFocus: document.activeElement
    };

    closeSidebar(false);
    const root = $('#editorRoot');
    root.innerHTML = editorHTML();
    syncBodyLock();

    requestAnimationFrame(() => {
      const title = $('#entryTitle');
      if (title) {
        title.focus({ preventScroll: true });
        if (editor && !editor.isNew) {
          const body = $('#entryBody');
          autoGrowTextarea(body);
        }
      }
      const body = $('#entryBody');
      autoGrowTextarea(body);
    });
    const scroll = $('.editor-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function editorHTML() {
    const draft = editor.draft;
    const weather = WEATHERS[draft.weather] || WEATHERS.sunny;
    const suggestions = getAllTags()
      .filter((item) => !draft.tags.includes(item.tag))
      .slice(0, 6);

    return `<div class="editor-overlay" role="dialog" aria-modal="true" aria-label="${editor.isNew ? '写一篇新日记' : '编辑日记'}">
      <div class="editor-bar">
        <div class="editor-bar-left">
          <button class="editor-back" type="button" data-action="close-editor"><svg class="icon"><use href="#i-arrow-left"></use></svg><span>返回</span></button>
          <span class="editor-status" id="editorStatus">${editor.isNew ? '新的一页 · 还没有保存' : '正在编辑'}</span>
        </div>
        <div class="editor-actions">
          ${
            editor.isNew
              ? ''
              : '<button class="icon-btn" type="button" data-action="delete-current" aria-label="删除这一页" title="删除这一页"><svg class="icon"><use href="#i-trash"></use></svg></button>'
          }
          <button class="editor-fav${draft.favorite ? ' is-fav' : ''}" type="button" data-action="toggle-editor-fav" aria-pressed="${draft.favorite}" aria-label="${draft.favorite ? '取消收藏' : '收藏这一页'}">
            <svg class="icon"><use href="#i-star"></use></svg><span>${draft.favorite ? '已收藏' : '收藏'}</span>
          </button>
          <button class="editor-save" type="button" data-action="save-entry">保存</button>
        </div>
      </div>
      <div class="editor-scroll">
        <article class="editor-paper">
          <header class="editor-head">
            <div class="editor-date-row">
              <input class="date-input" id="entryDate" type="date" value="${draft.date}" aria-label="这篇日记的日期">
              <span class="editor-weekday" id="editorWeekday">${WEEKDAYS[parseISO(draft.date).getDay()]}</span>
            </div>
          </header>
          <div class="meta-pickers">
            <div class="picker-group">
              <span class="picker-label">心情</span>
              <div class="mood-picker" role="group" aria-label="选择心情">
                ${Object.keys(MOODS)
                  .map(
                    (key) => `<button class="mood-option${draft.mood === key ? ' is-active' : ''}" type="button" data-action="pick-mood" data-value="${key}" aria-label="${MOODS[key].label}" aria-pressed="${draft.mood === key}" title="${MOODS[key].label}" style="--mood-color:${MOODS[key].color};--mood-tint:${moodTint(key)}">${moodFace(key)}</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="picker-group">
              <span class="picker-label">天气</span>
              <div class="weather-picker" role="group" aria-label="选择天气">
                ${Object.keys(WEATHERS)
                  .map(
                    (key) => `<button class="weather-option${draft.weather === key ? ' is-active' : ''}" type="button" data-action="pick-weather" data-value="${key}" aria-label="${WEATHERS[key].label}" aria-pressed="${draft.weather === key}" title="${WEATHERS[key].label}"><svg class="icon"><use href="#${WEATHERS[key].icon}"></use></svg><span>${WEATHERS[key].label}</span></button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
          <input class="editor-title" id="entryTitle" type="text" maxlength="140" value="${escapeHTML(
            draft.title
          )}" placeholder="给今天起个题目…" autocomplete="off" aria-label="日记标题">
          <div class="editor-divider" aria-hidden="true"></div>
          <textarea class="editor-body" id="entryBody" placeholder="今天发生了什么？从一句话开始也好…" aria-label="日记正文">${escapeHTML(
            draft.content
          )}</textarea>
          <div class="tag-editor">
            <span class="tag-editor-label">标签</span>
            <span id="editorTags">${tagChipsHTML(draft.tags)}</span>
            <input class="tag-input" id="tagInput" type="text" maxlength="18" placeholder="+ 添加标签" aria-label="添加标签">
          </div>
          <div class="tag-suggestions" id="tagSuggestions">${tagSuggestionsHTML(suggestions)}</div>
          <footer class="editor-footer">
            <span class="word-count" id="wordCount">${formatNumber(countChars(draft.content))} 字</span>
            <span class="editor-privacy"><svg class="icon"><use href="#i-lock"></use></svg>只保存在这台设备</span>
          </footer>
        </article>
      </div>
    </div>`;
  }

  function tagChipsHTML(tags) {
    return tags
      .map(
        (tag) => `<span class="tag-chip">${escapeHTML(tag)}<button type="button" data-action="remove-tag" data-tag="${escapeHTML(
          tag
        )}" aria-label="移除标签 ${escapeHTML(tag)}"><svg class="icon"><use href="#i-close"></use></svg></button></span>`
      )
      .join('');
  }

  function tagSuggestionsHTML(suggestions) {
    if (!suggestions.length) return '';
    return `<span class="tag-editor-label">试试</span>${suggestions
      .map(
        (item) =>
          `<button class="tag-suggestion" type="button" data-action="add-tag" data-tag="${escapeHTML(
            item.tag
          )}">#${escapeHTML(item.tag)}</button>`
      )
      .join('')}`;
  }

  function updateEditorTagsUI() {
    if (!editor) return;
    const tags = $('#editorTags');
    if (tags) tags.innerHTML = tagChipsHTML(editor.draft.tags);
    const suggestions = getAllTags()
      .filter((item) => !editor.draft.tags.includes(item.tag))
      .slice(0, 6);
    const suggestionEl = $('#tagSuggestions');
    if (suggestionEl) suggestionEl.innerHTML = tagSuggestionsHTML(suggestions);
  }

  function markEditorDirty() {
    if (!editor) return;
    if (!editor.dirty) {
      editor.dirty = true;
      const status = $('#editorStatus');
      if (status) {
        status.textContent = '有未保存的修改';
        status.classList.add('is-dirty');
      }
    }
  }

  function updateEditorWeekday() {
    if (!editor) return;
    const input = $('#entryDate');
    if (!input) return;
    const value = input.value;
    if (!isValidISODate(value)) return;
    editor.draft.date = value;
    const weekday = $('#editorWeekday');
    if (weekday) weekday.textContent = WEEKDAYS[parseISO(value).getDay()];
    markEditorDirty();
  }

  function pickMood(value) {
    if (!editor || !MOODS[value]) return;
    editor.draft.mood = value;
    $$('.mood-option').forEach((button) => {
      const active = button.dataset.value === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    markEditorDirty();
  }

  function pickWeather(value) {
    if (!editor || !WEATHERS[value]) return;
    editor.draft.weather = value;
    $$('.weather-option').forEach((button) => {
      const active = button.dataset.value === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    markEditorDirty();
  }

  function toggleEditorFavorite() {
    if (!editor) return;
    editor.draft.favorite = !editor.draft.favorite;
    const button = $('.editor-fav');
    if (button) {
      button.classList.toggle('is-fav', editor.draft.favorite);
      button.setAttribute('aria-pressed', String(editor.draft.favorite));
      button.setAttribute('aria-label', editor.draft.favorite ? '取消收藏' : '收藏这一页');
      const label = button.querySelector('span');
      if (label) label.textContent = editor.draft.favorite ? '已收藏' : '收藏';
    }
    markEditorDirty();
  }

  function addTag(value, silent) {
    if (!editor) return false;
    const tag = String(value || '').replace(/^#+/, '').trim().slice(0, 18);
    if (!tag) return false;
    if (editor.draft.tags.includes(tag)) {
      if (!silent) toast('这个标签已经加过了。');
      return false;
    }
    if (editor.draft.tags.length >= 8) {
      if (!silent) toast('一页最多放 8 个标签。');
      return false;
    }
    editor.draft.tags.push(tag);
    updateEditorTagsUI();
    markEditorDirty();
    return true;
  }

  function commitTagInput() {
    const input = $('#tagInput');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    addTag(value, true);
    input.value = '';
  }

  function autoGrowTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const min = window.innerWidth <= 700 ? 290 : 340;
    textarea.style.height = `${Math.max(min, textarea.scrollHeight + 2)}px`;
  }

  function updateEditorCount() {
    if (!editor) return;
    const body = $('#entryBody');
    if (!body) return;
    editor.draft.content = body.value;
    const wordCount = $('#wordCount');
    if (wordCount) wordCount.textContent = `${formatNumber(countChars(body.value))} 字`;
    autoGrowTextarea(body);
  }

  function saveEditor() {
    if (!editor) return;
    const titleInput = $('#entryTitle');
    const bodyInput = $('#entryBody');
    const dateInput = $('#entryDate');
    if (!titleInput || !bodyInput) return;

    editor.draft.title = titleInput.value.trim();
    editor.draft.content = bodyInput.value;
    if (dateInput && isValidISODate(dateInput.value)) editor.draft.date = dateInput.value;
    commitTagInput();

    if (!editor.draft.title && !editor.draft.content.trim()) {
      toast('先写下一句话，再收好这一页。');
      if (bodyInput) bodyInput.focus();
      return;
    }
    if (!editor.draft.title) editor.draft.title = deriveTitle(editor.draft.content);

    const now = new Date().toISOString();
    const previousEntries = state.entries.slice();
    if (editor.isNew) {
      const newEntry = normalizeEntry({
        ...editor.draft,
        id: uid(),
        createdAt: now,
        updatedAt: now
      });
      state.entries.push(newEntry);
    } else {
      const index = state.entries.findIndex((entry) => entry.id === editor.draft.id);
      if (index !== -1) {
        state.entries[index] = normalizeEntry({
          ...state.entries[index],
          ...editor.draft,
          updatedAt: now
        });
      }
    }

    if (!saveState()) {
      state.entries = previousEntries;
      return;
    }
    editor.dirty = false;
    updateSidebar();
    closeEditor(false);
    renderRoute({ scroll: false });
    toast('这一页，收好了。');
  }

  function deriveTitle(content) {
    const firstLine = String(content || '')
      .split(/\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (!firstLine) return '无题';
    const plain = firstLine.replace(/^#+\s*/, '').replace(/[。！？!?，,；;：:]+$/, '');
    return plain.length > 22 ? `${plain.slice(0, 22)}…` : plain;
  }

  function requestCloseEditor() {
    if (!editor) return;
    if (!editor.dirty) {
      closeEditor(true);
      return;
    }
    openConfirm({
      title: '这一页还没有保存',
      message: '刚刚写下的内容会消失。要离开吗？',
      confirmLabel: '不保存，离开',
      danger: true,
      onConfirm: () => closeEditor(true)
    });
  }

  function closeEditor(restoreFocus) {
    if (!editor) return;
    const target = editor.returnFocus;
    $('#editorRoot').innerHTML = '';
    editor = null;
    syncBodyLock();
    if (restoreFocus && target && target.isConnected) {
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function deleteCurrentEntry() {
    if (!editor || editor.isNew) return;
    const title = editor.draft.title || '无题';
    openConfirm({
      title: '删掉这一页？',
      message: `「${title}」会从日记本里消失，这个动作无法撤回。`,
      confirmLabel: '删除这一页',
      danger: true,
      onConfirm: () => {
        const previousEntries = state.entries.slice();
        state.entries = state.entries.filter((entry) => entry.id !== editor.draft.id);
        if (!saveState()) {
          state.entries = previousEntries;
          return;
        }
        updateSidebar();
        closeEditor(false);
        renderRoute({ scroll: false });
        toast('这一页已经删掉了。');
      }
    });
  }

  /* =========================================================
     Favorites
     ========================================================= */

  function toggleFavorite(id, button) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    const previousFavorite = entry.favorite;
    entry.favorite = !entry.favorite;
    entry.updatedAt = new Date().toISOString();
    if (!saveState()) {
      entry.favorite = previousFavorite;
      return;
    }

    $$('.fav-btn').forEach((item) => {
      if (item.dataset.id !== id) return;
      if (item === button || !button) {
        item.classList.toggle('is-fav', entry.favorite);
        item.setAttribute('aria-pressed', String(entry.favorite));
        item.setAttribute('aria-label', entry.favorite ? '取消收藏' : '收藏这一页');
      }
    });

    if (ui.routeName === 'favorites') {
      paintView();
    }

    toast(entry.favorite ? '已收藏这一页。' : '已取消收藏。');
  }

  /* =========================================================
     Search
     ========================================================= */

  function openSearch() {
    if (searchRootHasContent()) return;
    if (editorRootHasContent()) {
      toast('先保存并退出编辑，再搜索其他日记。');
      return;
    }
    closeSidebar(false);
    searchReturnFocus = document.activeElement;
    const root = $('#searchRoot');
    root.innerHTML = `<div class="overlay" data-overlay="search" role="dialog" aria-modal="true" aria-label="搜索日记">
      <div class="search-palette">
        <div class="search-input-wrap">
          <svg class="icon"><use href="#i-search"></use></svg>
          <input class="search-input" id="globalSearch" type="text" placeholder="搜索标题、内容或标签…" autocomplete="off" aria-label="搜索标题、内容或标签">
          <kbd>ESC</kbd>
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="palette-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> 选择 <kbd>Enter</kbd> 打开</span>
          <span>在字里行间，找回某一天</span>
        </div>
      </div>
    </div>`;
    syncBodyLock();
    renderSearchResults('');
    requestAnimationFrame(() => {
      const input = $('#globalSearch');
      if (input) input.focus();
    });
  }

  function closeSearch(restoreFocus) {
    if (!searchRootHasContent()) return;
    const target = searchReturnFocus;
    searchReturnFocus = null;
    $('#searchRoot').innerHTML = '';
    searchActiveIndex = -1;
    searchEntryIds = [];
    syncBodyLock();
    if (restoreFocus !== false && target && target.isConnected) {
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function renderSearchResults(query) {
    const container = $('#searchResults');
    if (!container) return;
    const normalized = String(query || '').trim().toLowerCase();
    const all = sortedEntries();
    let results;
    if (!normalized) {
      results = all.slice(0, 5);
    } else {
      results = all
        .filter((entry) => {
          const haystack = `${entry.title}\n${entry.content}\n${entry.tags.join(' ')}`.toLowerCase();
          return haystack.includes(normalized);
        })
        .slice(0, 8);
    }
    searchEntryIds = results.map((entry) => entry.id);
    searchActiveIndex = -1;

    if (!all.length) {
      container.innerHTML = `<div class="search-empty"><svg class="icon"><use href="#i-book"></use></svg><p>日记本还是空的</p><small>先去写下第一篇吧。</small></div>`;
      return;
    }

    if (!results.length) {
      container.innerHTML = `<div class="search-empty"><svg class="icon"><use href="#i-search"></use></svg><p>没有找到「${escapeHTML(
        query
      )}」</p><small>换一个词，或试试标签。</small></div>`;
      return;
    }

    container.innerHTML = `<p class="search-section-label">${normalized ? `找到 ${results.length} 页` : '最近写下'}</p>${results
      .map((entry) => {
        const mood = MOODS[entry.mood] || MOODS.calm;
        const excerpt = searchExcerpt(entry.content, normalized);
        return `<button class="search-result" type="button" data-action="open-search-result" data-id="${escapeHTML(
          entry.id
        )}">
          <span class="search-result-date">${parseISO(entry.date).getMonth() + 1}月<strong>${parseISO(entry.date).getDate()}</strong></span>
          <span class="search-result-body">
            <span class="search-result-title">${escapeHTML(entry.title || '无题')}</span>
            <span class="search-result-excerpt">${escapeHTML(excerpt)}</span>
            <span class="search-result-meta"><span class="mood-inline" style="--mood-color:var(--mood-${entry.mood})"><i></i>${mood.label}</span><span>${relativeDate(entry.date)}</span>${entry.tags
              .slice(0, 2)
              .map((tag) => `<span>#${escapeHTML(tag)}</span>`)
              .join('')}</span>
          </span>
          <span class="search-result-arrow"><svg class="icon"><use href="#i-arrow-right"></use></svg></span>
        </button>`;
      })
      .join('')}`;
  }

  function searchExcerpt(content, query) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    if (!text) return '这一页只有题目。';
    if (!query) return text.slice(0, 85);
    const index = text.toLowerCase().indexOf(query);
    if (index === -1) return text.slice(0, 85);
    const start = Math.max(0, index - 28);
    const end = Math.min(text.length, index + query.length + 55);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
  }

  function moveSearchSelection(delta) {
    const results = $$('.search-result', $('#searchResults'));
    if (!results.length) return;
    searchActiveIndex =
      (searchActiveIndex + delta + results.length) % results.length;
    results.forEach((element, index) => {
      element.classList.toggle('is-active', index === searchActiveIndex);
    });
    results[searchActiveIndex].scrollIntoView({ block: 'nearest' });
  }

  function openSearchResult(id) {
    if (!id) return;
    closeSearch(false);
    openEditor(id);
  }

  /* =========================================================
     Settings
     ========================================================= */

  function openSettings() {
    if (settingsRootHasContent()) return;
    closeSidebar(false);
    if (searchRootHasContent()) closeSearch(false);
    settingsReturnFocus = document.activeElement;
    const theme = state.settings.theme;
    const json = JSON.stringify(state);
    let bytes = 0;
    try {
      bytes = new TextEncoder().encode(json).length;
    } catch (error) {
      bytes = json.length * 2;
    }
    const usage = Math.min(100, Math.max(1, (bytes / (5 * 1024 * 1024)) * 100));
    const sizeLabel = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

    const root = $('#settingsRoot');
    root.innerHTML = `<div class="overlay" data-overlay="settings" role="dialog" aria-modal="true" aria-label="偏好与备份">
      <div class="settings-dialog">
        <header class="modal-head">
          <div>
            <h2 class="modal-title">偏好与备份</h2>
            <p class="modal-sub">把日记本调成你顺手的样子。</p>
          </div>
          <button class="icon-btn" type="button" data-action="close-settings" aria-label="关闭设置"><svg class="icon"><use href="#i-close"></use></svg></button>
        </header>
        <div class="modal-body">
          <section class="setting-section">
            <h3 class="setting-title">纸张颜色</h3>
            <p class="setting-desc">跟随系统，或选择一种你更喜欢的阅读光线。</p>
            <div class="theme-options">
              <button class="theme-choice${theme === 'light' ? ' is-active' : ''}" type="button" data-action="theme-choice" data-theme-choice="light">
                <span class="theme-swatch light"></span><span>浅色纸张</span>
              </button>
              <button class="theme-choice${theme === 'dark' ? ' is-active' : ''}" type="button" data-action="theme-choice" data-theme-choice="dark">
                <span class="theme-swatch dark"></span><span>夜间纸张</span>
              </button>
              <button class="theme-choice${theme === 'system' ? ' is-active' : ''}" type="button" data-action="theme-choice" data-theme-choice="system">
                <span class="theme-swatch system"></span><span>跟随系统</span>
              </button>
            </div>
          </section>
          <section class="setting-section">
            <h3 class="setting-title">备份与迁移</h3>
            <p class="setting-desc">日记只存在这台设备的浏览器里。换设备或清理浏览器前，记得带走一份备份。</p>
            <div class="data-actions">
              <button class="btn btn-soft" type="button" data-action="export-data"><svg class="icon"><use href="#i-download"></use></svg>导出全部日记</button>
              <button class="btn btn-soft" type="button" data-action="trigger-import"><svg class="icon"><use href="#i-upload"></use></svg>导入备份</button>
              <input type="file" id="importFile" accept=".json,application/json" class="sr-only" tabindex="-1" aria-label="选择备份文件">
            </div>
            <div class="storage-meter">
              <div class="storage-meter-head"><span>本地存储占用</span><span>${sizeLabel} / 约 5 MB</span></div>
              <div class="storage-meter-bar" style="--usage:${usage}%"><i></i></div>
            </div>
          </section>
          <section class="setting-section">
            <h3 class="setting-title">关于你的文字</h3>
            <div class="settings-note">
              <svg class="icon"><use href="#i-lock"></use></svg>
              <span>日札不会把任何内容上传到服务器。所有标题、正文和标签都由浏览器保存在本地，清理站点数据会让它们一并消失。定期导出备份，是最稳妥的保存方式。</span>
            </div>
          </section>
          <section class="setting-section">
            <h3 class="setting-title">清空日记本</h3>
            <div class="danger-zone">
              <p>删除这台设备上的全部 ${state.entries.length} 页日记。此操作无法撤销。</p>
              <button class="btn" type="button" data-action="clear-all">清空所有</button>
            </div>
          </section>
        </div>
        <footer class="modal-footer">
          <span class="version-note">RIZHA v${APP_VERSION} · LOCAL ONLY</span>
          <button class="btn btn-primary" type="button" data-action="close-settings">完成</button>
        </footer>
      </div>
    </div>`;
    syncBodyLock();
    requestAnimationFrame(() => {
      const close = $('[data-action="close-settings"]');
      if (close) close.focus();
    });
  }

  function closeSettings(restoreFocus) {
    if (!settingsRootHasContent()) return;
    const target = settingsReturnFocus;
    settingsReturnFocus = null;
    $('#settingsRoot').innerHTML = '';
    syncBodyLock();
    if (restoreFocus !== false && target && target.isConnected) {
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function chooseTheme(theme) {
    if (!['light', 'dark', 'system'].includes(theme)) return;
    state.settings.theme = theme;
    saveState();
    applyTheme();
    $$('[data-theme-choice]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.themeChoice === theme);
    });
  }

  function exportData() {
    if (!state.entries.length) {
      toast('日记本还是空的，暂时没有可导出的内容。');
      return;
    }
    const payload = {
      app: 'rizha-diary',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
      settings: { theme: state.settings.theme }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `日札-备份-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast('备份文件已经导出。');
  }

  async function importData(file) {
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      const parsed = JSON.parse(text);
      const rawEntries = Array.isArray(parsed) ? parsed : parsed && parsed.entries;
      if (!Array.isArray(rawEntries)) throw new Error('not a backup');
      const imported = rawEntries.map(normalizeEntry).filter(Boolean);
      if (!imported.length) throw new Error('empty backup');

      const map = new Map(state.entries.map((entry) => [entry.id, entry]));
      imported.forEach((entry) => map.set(entry.id, entry));
      const previousEntries = state.entries.slice();
      state.entries = Array.from(map.values());
      if (!saveState()) {
        state.entries = previousEntries;
        return;
      }
      updateSidebar();
      closeSettings(false);
      renderRoute({ scroll: false });
      toast(`导入了 ${imported.length} 页日记。`);
    } catch (error) {
      toast('这个文件看起来不是日札备份。', 'warning');
    } finally {
      const input = $('#importFile');
      if (input) input.value = '';
    }
  }

  function clearAllData() {
    const count = state.entries.length;
    openConfirm({
      title: '真的要清空日记本吗？',
      message: `全部 ${count} 页日记都会从这台设备上删除，且无法恢复。建议先导出一份备份。`,
      confirmLabel: '清空日记本',
      danger: true,
      onConfirm: () => {
        const previousEntries = state.entries.slice();
        const previousFlags = { ...state.flags };
        state.entries = [];
        state.flags.welcomeDismissed = true;
        if (!saveState()) {
          state.entries = previousEntries;
          state.flags = previousFlags;
          return;
        }
        closeSettings(false);
        updateSidebar();
        if (location.hash === '#/home') renderRoute();
        else location.hash = '#/home';
        toast('日记本已经清空。');
      }
    });
  }

  /* =========================================================
     Confirm dialog
     ========================================================= */

  function openConfirm(options) {
    if (confirmRootHasContent()) return;
    confirmReturnFocus = document.activeElement;
    confirmCallback = options.onConfirm || null;
    const root = $('#confirmRoot');
    root.innerHTML = `<div class="confirm-overlay" id="confirmOverlay" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmText">
      <div class="confirm-dialog">
        <h3 id="confirmTitle">${escapeHTML(options.title || '确认操作')}</h3>
        <p id="confirmText">${escapeHTML(options.message || '')}</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" type="button" data-action="confirm-cancel">取消</button>
          <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" type="button" data-action="confirm-ok">${escapeHTML(
            options.confirmLabel || '确认'
          )}</button>
        </div>
      </div>
    </div>`;
    syncBodyLock();
    requestAnimationFrame(() => {
      const cancel = $('[data-action="confirm-cancel"]');
      if (cancel) cancel.focus();
    });
  }

  function closeConfirm(restoreFocus) {
    if (!confirmRootHasContent()) return;
    const target = confirmReturnFocus;
    confirmReturnFocus = null;
    $('#confirmRoot').innerHTML = '';
    syncBodyLock();
    if (restoreFocus && target && target.isConnected) {
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function handleConfirmOk() {
    const callback = confirmCallback;
    confirmCallback = null;
    closeConfirm(false);
    if (callback) callback();
  }

  /* =========================================================
     Toasts
     ========================================================= */

  function toast(message, type) {
    const host = $('#toastHost');
    if (!host) return;
    const item = document.createElement('div');
    item.className = 'toast';
    item.setAttribute('role', 'status');
    const icon = type === 'warning' ? 'i-sparkle' : 'i-check';
    item.innerHTML = `<svg class="icon"><use href="#${icon}"></use></svg><span></span>`;
    item.querySelector('span').textContent = message;
    host.appendChild(item);
    const timeout = setTimeout(() => {
      item.classList.add('is-leaving');
      setTimeout(() => item.remove(), 220);
    }, 2800);
    item.addEventListener('click', () => {
      clearTimeout(timeout);
      item.remove();
    });
  }

  /* =========================================================
     Events
     ========================================================= */

  function handleDocumentClick(event) {
    const target = event.target;

    if (target.classList && target.classList.contains('overlay')) {
      if (target.dataset.overlay === 'search') closeSearch(true);
      else if (target.dataset.overlay === 'settings') closeSettings(true);
      return;
    }
    if (target.id === 'confirmOverlay') {
      closeConfirm(true);
      return;
    }

    const actionEl = target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case 'new-entry':
        openEditor(null, actionEl.dataset.date || null);
        break;
      case 'open-entry':
        openEditor(actionEl.dataset.entryId || actionEl.closest('[data-entry-id]')?.dataset.entryId);
        break;
      case 'toggle-favorite':
        toggleFavorite(actionEl.dataset.id, actionEl);
        break;
      case 'open-sidebar':
        openSidebar();
        break;
      case 'close-sidebar':
        closeSidebar(true);
        break;
      case 'open-search':
        openSearch();
        break;
      case 'close-search':
        closeSearch(true);
        break;
      case 'open-settings':
        openSettings();
        break;
      case 'close-settings':
        closeSettings(true);
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'shuffle-prompt': {
        ui.promptOffset += 1;
        const prompt = $('.prompt-text');
        if (prompt) {
          prompt.style.opacity = '0';
          prompt.style.transform = 'translateY(3px)';
          setTimeout(() => {
            prompt.textContent = currentPrompt();
            prompt.style.transition = 'opacity 240ms ease, transform 240ms ease';
            prompt.style.opacity = '1';
            prompt.style.transform = 'translateY(0)';
          }, 150);
        }
        break;
      }
      case 'dismiss-welcome':
        state.flags.welcomeDismissed = true;
        saveState();
        renderRoute({ scroll: false });
        break;
      case 'jump-calendar':
        if (isValidISODate(actionEl.dataset.date)) {
          setCalendarDate(actionEl.dataset.date);
          if (ui.routeName === 'calendar') renderRoute({ scroll: false });
          else location.hash = '#/calendar';
        }
        break;
      case 'select-calendar-day':
        selectCalendarDate(actionEl.dataset.date);
        break;
      case 'prev-month':
        moveCalendarMonth(-1);
        break;
      case 'next-month':
        moveCalendarMonth(1);
        break;
      case 'calendar-today':
        setCalendarDate(todayISO());
        paintView();
        break;
      case 'clear-filters':
        clearFilters();
        break;
      case 'open-search-result':
        openSearchResult(actionEl.dataset.id);
        break;
      case 'close-editor':
        requestCloseEditor();
        break;
      case 'save-entry':
        saveEditor();
        break;
      case 'delete-current':
        deleteCurrentEntry();
        break;
      case 'toggle-editor-fav':
        toggleEditorFavorite();
        break;
      case 'pick-mood':
        pickMood(actionEl.dataset.value);
        break;
      case 'pick-weather':
        pickWeather(actionEl.dataset.value);
        break;
      case 'remove-tag': {
        if (!editor) break;
        editor.draft.tags = editor.draft.tags.filter((tag) => tag !== actionEl.dataset.tag);
        updateEditorTagsUI();
        markEditorDirty();
        break;
      }
      case 'add-tag':
        if (editor) {
          addTag(actionEl.dataset.tag);
          const input = $('#tagInput');
          if (input) input.focus();
        }
        break;
      case 'theme-choice':
        chooseTheme(actionEl.dataset.themeChoice);
        break;
      case 'export-data':
        exportData();
        break;
      case 'trigger-import': {
        const input = $('#importFile');
        if (input) input.click();
        break;
      }
      case 'clear-all':
        clearAllData();
        break;
      case 'confirm-ok':
        handleConfirmOk();
        break;
      case 'confirm-cancel':
        closeConfirm(true);
        break;
      default:
        break;
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.id === 'entryTitle') {
      if (!editor) return;
      editor.draft.title = target.value;
      markEditorDirty();
      return;
    }
    if (target.id === 'entryBody') {
      if (!editor) return;
      updateEditorCount();
      markEditorDirty();
      return;
    }
    if (target.id === 'archiveSearch') {
      ui.archiveQuery = target.value;
      updateArchiveResults();
      return;
    }
    if (target.id === 'globalSearch') {
      searchActiveIndex = -1;
      renderSearchResults(target.value);
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target.id === 'entryDate') {
      updateEditorWeekday();
      return;
    }
    if (target.id === 'archiveMood') {
      ui.archiveMood = target.value;
      updateArchiveResults();
      return;
    }
    if (target.id === 'archiveYear') {
      ui.archiveYear = target.value;
      updateArchiveResults();
      return;
    }
    if (target.id === 'importFile') {
      const file = target.files && target.files[0];
      if (file) importData(file);
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }

    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === 'k') {
      if (editor) return;
      event.preventDefault();
      if (searchRootHasContent()) closeSearch(true);
      else if (settingsRootHasContent()) {
        closeSettings(false);
        openSearch();
      } else openSearch();
      return;
    }

    if (modifier && event.key.toLowerCase() === 's' && editor) {
      event.preventDefault();
      saveEditor();
      return;
    }

    if (event.key === 'Escape') {
      if (confirmRootHasContent()) {
        closeConfirm(true);
        return;
      }
      if (searchRootHasContent()) {
        closeSearch(true);
        return;
      }
      if (settingsRootHasContent()) {
        closeSettings(true);
        return;
      }
      if (editor) {
        requestCloseEditor();
        return;
      }
      if (document.body.classList.contains('sidebar-open')) {
        closeSidebar(true);
        return;
      }
      return;
    }

    if (event.target.id === 'globalSearch') {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSearchSelection(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSearchSelection(-1);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const id =
          searchEntryIds[searchActiveIndex >= 0 ? searchActiveIndex : 0] || searchEntryIds[0];
        if (id) openSearchResult(id);
        return;
      }
    }

    if (event.target.id === 'tagInput') {
      if (event.isComposing) return;
      if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
        event.preventDefault();
        const value = event.target.value.trim();
        if (value) {
          addTag(value);
          event.target.value = '';
          updateEditorTagsUI();
        }
        return;
      }
      if (event.key === 'Backspace' && !event.target.value && editor && editor.draft.tags.length) {
        event.preventDefault();
        editor.draft.tags.pop();
        updateEditorTagsUI();
        markEditorDirty();
        return;
      }
    }

    if (event.target.id === 'entryTitle' && event.key === 'Enter') {
      event.preventDefault();
      const body = $('#entryBody');
      if (body) body.focus();
      return;
    }

    if (isTyping(event.target)) return;

    if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (searchRootHasContent() || settingsRootHasContent() || confirmRootHasContent()) return;
      event.preventDefault();
      openEditor(null);
      return;
    }

    if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
      if (searchRootHasContent() || settingsRootHasContent() || confirmRootHasContent()) return;
      event.preventDefault();
      openSearch();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.entry-card')) {
      event.preventDefault();
      const id = event.target.dataset.entryId;
      if (id) openEditor(id);
    }
  }

  function isTyping(element) {
    if (!element) return false;
    const tag = element.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      element.isContentEditable
    );
  }

  function trapFocus(event) {
    let root = null;
    if (confirmRootHasContent()) root = $('#confirmRoot');
    else if (searchRootHasContent()) root = $('#searchRoot');
    else if (settingsRootHasContent()) root = $('#settingsRoot');
    else if (editorRootHasContent()) root = $('#editorRoot');
    if (!root) return;

    const focusable = $$(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      root
    ).filter(
      (element) =>
        element.tabIndex >= 0 &&
        (element.offsetParent !== null || element === document.activeElement)
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!root.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  /* =========================================================
     Utilities
     ========================================================= */

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
