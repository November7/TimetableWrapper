const state = {
  categories: {
    oddzialy: [],
    nauczyciele: [],
    sale: []
  },
  planSources: [],
  currentPlanRoot: null,
  pathIndex: new Map(),
  currentCategory: "oddzialy",
  currentItem: null,
  filterText: "",
  rememberCategoryFilters: false,
  categoryFilters: {
    oddzialy: "",
    nauczyciele: "",
    sale: ""
  },
  currentPlan: null,
  currentPlanSourceLabel: "Aktualny",
  planRequestId: 0,
  planFontScale: 1,
  separatePanelScroll: false,
  hideEmptyDays: false,
  contentWheelTarget: null,
  contentWheelRafId: 0,
  contentStickyTop: 20,
  contentStickyTopMin: 20,
  lastWindowScrollY: 0,
  labelVisibility: {
    oddzialy: {
      group: true,
      teacher: true,
      room: false
    },
    nauczyciele: {
      group: true,
      teacher: true,
      room: false
    },
    sale: {
      group: true,
      teacher: true,
      room: false
    }
  }
};

const refs = {
  sidebar: document.getElementById("sidebar"),
  content: document.querySelector(".content"),
  list: document.getElementById("item-list"),
  planSourceSelect: document.getElementById("plan-source-select"),
  labelControls: document.getElementById("label-controls"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  search: document.getElementById("search-input"),
  title: document.getElementById("plan-title"),
  meta: document.getElementById("plan-meta"),
  schedule: document.getElementById("schedule"),
  generatedInfo: document.getElementById("generated-info"),
  menuToggle: document.getElementById("menu-toggle"),
  fontDecrease: document.getElementById("font-decrease"),
  fontIncrease: document.getElementById("font-increase"),
  themeToggle: document.getElementById("theme-toggle"),
  themeIcon: document.getElementById("theme-icon")
};

const APP_VERSION = "1.3.17";
const SIDEBAR_COLLAPSE_WIDTH = Math.max(
  1,
  Number.parseInt(String(window.TIMETABLE_SIDEBAR_COLLAPSE_WIDTH || "1000"), 10) || 1000
);
const FONT_SCALE_MIN = 0.8;
const FONT_SCALE_MAX = 1.3;
const FONT_SCALE_STEP = 0.1;
const PANEL_SCROLL_MODE_STORAGE_KEY = "panelScrollMode";
const HIDE_EMPTY_DAYS_STORAGE_KEY = "hideEmptyDays";
const REMEMBER_CATEGORY_FILTERS_STORAGE_KEY = "rememberCategoryFilters";
const HISTORY_STATE_VERSION = 1;
const ARCHIVE_MAX_ENTRIES = Math.max(
  1,
  Number.parseInt(String(window.TIMETABLE_ARCHIVE_MAX_ENTRIES || "24"), 10) || 24
);

const DEFAULT_PLAN_ROOT = normalizePlanRoot(window.TIMETABLE_PLAN_ROOT || "../plan");
const DEFAULT_ARCHIVE_ROOT = normalizePlanRoot(
  window.TIMETABLE_ARCHIVE_ROOT || buildSiblingRoot(DEFAULT_PLAN_ROOT, "../stareplany")
);
const SUBJECT_NAME_MAP = createSubjectNameMap(window.TIMETABLE_SUBJECT_NAME_MAP);
const SUBJECT_WORD_ABBREVIATION_MAP = createSubjectWordAbbreviationMap(
  window.TIMETABLE_SUBJECT_WORD_ABBREVIATION_MAP
);

function normalizePlanRoot(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "src";
  }

  return raw.replace(/\/+$/, "");
}

function buildSiblingRoot(root, siblingName) {
  const normalizedRoot = normalizePlanRoot(root);
  const lastSlash = normalizedRoot.lastIndexOf("/");

  if (lastSlash < 0) {
    return siblingName;
  }

  const parent = normalizedRoot.slice(0, lastSlash);
  if (!parent) {
    return "/" + siblingName;
  }

  return parent + "/" + siblingName;
}

function getPlanRoot() {
  return state.currentPlanRoot || DEFAULT_PLAN_ROOT;
}

function createSubjectNameMap(rawMap) {
  const entries = Object.entries(rawMap || {});
  return new Map(
    entries
      .map(([sourceName, targetName]) => [normalizeSpaces(sourceName), normalizeSpaces(targetName)])
      .filter(([sourceName, targetName]) => sourceName && targetName)
  );
}

function createSubjectWordAbbreviationMap(rawMap) {
  const entries = Object.entries(rawMap || {});
  return new Map(
    entries
      .map(([sourceWord, targetWord]) => [
        normalizeSpaces(sourceWord).toLocaleLowerCase("pl-PL"),
        normalizeSpaces(targetWord)
      ])
      .filter(([sourceWord, targetWord]) => sourceWord && targetWord)
  );
}

function normalizeSubjectName(subject) {
  const normalizedSubject = normalizeSpaces(subject);
  return normalizedSubject.replace(/-(\d+[\/][\dA-Za-z]+)$/i, " $1");
}

function capitalizeSubjectName(subject) {
  const normalized = normalizeSpaces(subject);
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toLocaleUpperCase("pl-PL") + normalized.slice(1);
}

function mapSubjectName(subject) {
  const normalizedSubject = normalizeSubjectName(subject);
  const directMatch = SUBJECT_NAME_MAP.get(normalizedSubject);
  if (directMatch) {
    return directMatch;
  }

  const groupSuffixMatch = /^(.*?)(\s+\d+[\/][\dA-Za-z]+)$/i.exec(normalizedSubject);
  if (!groupSuffixMatch) {
    return normalizedSubject;
  }

  const baseSubject = normalizeSpaces(groupSuffixMatch[1]);
  const groupSuffix = groupSuffixMatch[2];
  const mappedBaseSubject = SUBJECT_NAME_MAP.get(baseSubject);
  return mappedBaseSubject ? mappedBaseSubject + groupSuffix : normalizedSubject;
}

function abbreviateSubjectWords(subject) {
  const normalizedSubject = normalizeSpaces(subject);
  if (!normalizedSubject) {
    return "";
  }

  return normalizedSubject.replace(/\p{L}+/gu, (word) => {
    const abbreviation = SUBJECT_WORD_ABBREVIATION_MAP.get(word.toLocaleLowerCase("pl-PL"));
    return abbreviation || word;
  });
}

function formatSubjectName(subject) {
  const mapped = mapSubjectName(subject);
  const abbreviated = abbreviateSubjectWords(mapped);
  return capitalizeSubjectName(abbreviated);
}

function toPlanPath(relativePath, root = getPlanRoot()) {
  const normalizedRoot = normalizePlanRoot(root);
  const clean = String(relativePath || "")
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\//, "");

  if (!clean) {
    return normalizedRoot;
  }

  if (/^(https?:)?\/\//i.test(clean)) {
    return clean;
  }

  return normalizedRoot + "/" + clean;
}

async function init() {
  setupTheme();
  setupPlanFontScale();
  setupSidebarResponsiveMode();
  setupPanelScrollMode();
  setupHideEmptyDaysMode();
  setupRememberCategoryFiltersMode();
  attachEvents();
  renderLabelControls();
  state.currentPlanRoot = DEFAULT_PLAN_ROOT;
  setStatus("Wczytywanie listy planow...");

  try {
    await loadIndex();
    await loadPlanSources();
    renderPlanSourceOptions();
    renderItems();

    const initialNavigation = getInitialNavigationState();
    if (initialNavigation?.planRoot && initialNavigation.planRoot !== getPlanRoot()) {
      state.currentPlanRoot = initialNavigation.planRoot;
      renderPlanSourceOptions();
      await loadIndex();
      renderItems();
    }

    const initialPath = initialNavigation?.path;
    const first = initialPath ? findItemByPath(initialPath) : state.categories[state.currentCategory][0];
    if (first) {
      if (initialNavigation?.category) {
        setCurrentCategory(initialNavigation.category);
        applyTabState();
        renderLabelControls();
      }
      await selectItem(first.path, { historyMode: "replace" });
    } else {
      setStatus("Brak pozycji w wybranej kategorii.", false);
    }
  } catch (error) {
    console.error(error);
    setStatus("Nie udalo sie odczytac danych z plikow zrodlowych.", true);
  }
}

function setupTheme() {
  const saved = localStorage.getItem("theme");
  const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = saved || (preferredDark ? "dark" : "light");
  applyTheme(initialTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  const dark = theme === "dark";
  refs.themeIcon.textContent = dark ? "☀" : "🌙";
  refs.themeToggle.setAttribute("aria-label", dark ? "Przelacz na motyw jasny" : "Przelacz na motyw ciemny");
  refs.themeToggle.setAttribute("title", dark ? "Motyw jasny" : "Motyw ciemny");
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function setupPlanFontScale() {
  const saved = Number.parseFloat(localStorage.getItem("planFontScale") || "1");
  applyPlanFontScale(Number.isFinite(saved) ? saved : 1);
}

function isSidebarCollapsedLayout() {
  return window.innerWidth <= SIDEBAR_COLLAPSE_WIDTH;
}

function setupSidebarResponsiveMode() {
  document.documentElement.style.setProperty("--sidebar-collapse-width", SIDEBAR_COLLAPSE_WIDTH + "px");
  applySidebarResponsiveMode();
}

function applySidebarResponsiveMode() {
  const collapsed = isSidebarCollapsedLayout();
  document.documentElement.setAttribute("data-sidebar-mode", collapsed ? "collapsed" : "expanded");

  if (!collapsed) {
    refs.sidebar.classList.remove("open");
    refs.menuToggle.setAttribute("aria-expanded", "false");
  }
}

function setupPanelScrollMode() {
  const savedMode = String(localStorage.getItem(PANEL_SCROLL_MODE_STORAGE_KEY) || "linked");
  applyPanelScrollMode(savedMode === "separate", { persist: false });
}

function setupHideEmptyDaysMode() {
  const saved = String(localStorage.getItem(HIDE_EMPTY_DAYS_STORAGE_KEY) || "false");
  applyHideEmptyDaysMode(saved === "true", { persist: false });
}

function setupRememberCategoryFiltersMode() {
  const saved = String(localStorage.getItem(REMEMBER_CATEGORY_FILTERS_STORAGE_KEY) || "false");
  applyRememberCategoryFiltersMode(saved === "true", { persist: false });
}

function applyPanelScrollMode(enabled, options) {
  const settings = {
    persist: true,
    ...options
  };

  state.separatePanelScroll = Boolean(enabled);
  const mode = state.separatePanelScroll ? "separate" : "linked";

  document.documentElement.setAttribute("data-panel-scroll-mode", mode);

  const separateScrollToggle = document.getElementById("separate-scroll-toggle");
  if (separateScrollToggle instanceof HTMLInputElement) {
    separateScrollToggle.checked = state.separatePanelScroll;
  }

  if (settings.persist) {
    localStorage.setItem(PANEL_SCROLL_MODE_STORAGE_KEY, mode);
  }

  stopContentWheelAnimation();

  state.lastWindowScrollY = window.scrollY;
  refreshContentStickyBounds(true);
}

function applyHideEmptyDaysMode(enabled, options) {
  const settings = {
    persist: true,
    ...options
  };

  state.hideEmptyDays = Boolean(enabled);

  const hideEmptyDaysToggle = document.getElementById("hide-empty-days-toggle");
  if (hideEmptyDaysToggle instanceof HTMLInputElement) {
    hideEmptyDaysToggle.checked = state.hideEmptyDays;
  }

  if (settings.persist) {
    localStorage.setItem(HIDE_EMPTY_DAYS_STORAGE_KEY, state.hideEmptyDays ? "true" : "false");
  }

  if (state.currentPlan) {
    renderPlan(state.currentPlan);
  }
}

function applyRememberCategoryFiltersMode(enabled, options) {
  const settings = {
    persist: true,
    ...options
  };

  const nextValue = Boolean(enabled);
  if (nextValue && !state.rememberCategoryFilters) {
    state.categoryFilters[state.currentCategory] = state.filterText;
  }

  state.rememberCategoryFilters = nextValue;

  const rememberFilterToggle = document.getElementById("remember-category-filters-toggle");
  if (rememberFilterToggle instanceof HTMLInputElement) {
    rememberFilterToggle.checked = state.rememberCategoryFilters;
  }

  if (settings.persist) {
    localStorage.setItem(
      REMEMBER_CATEGORY_FILTERS_STORAGE_KEY,
      state.rememberCategoryFilters ? "true" : "false"
    );
  }
}

function setCurrentCategory(category) {
  const nextCategory = String(category || "").trim();
  if (!nextCategory || nextCategory === state.currentCategory) {
    return;
  }

  if (state.rememberCategoryFilters) {
    state.categoryFilters[state.currentCategory] = state.filterText;
  }

  state.currentCategory = nextCategory;

  if (state.rememberCategoryFilters) {
    state.filterText = state.categoryFilters[nextCategory] || "";
    if (refs.search) {
      refs.search.value = state.filterText;
    }
  }
}

function resetFilterState(options) {
  const settings = {
    allCategories: false,
    ...options
  };

  state.filterText = "";

  if (state.rememberCategoryFilters) {
    if (settings.allCategories) {
      state.categoryFilters.oddzialy = "";
      state.categoryFilters.nauczyciele = "";
      state.categoryFilters.sale = "";
    } else {
      state.categoryFilters[state.currentCategory] = "";
    }
  }

  if (refs.search) {
    refs.search.value = "";
  }
}

function stopContentWheelAnimation() {
  if (state.contentWheelRafId) {
    cancelAnimationFrame(state.contentWheelRafId);
    state.contentWheelRafId = 0;
  }

  state.contentWheelTarget = null;
}

function resetPlanScrollPosition() {
  stopContentWheelAnimation();

  if (refs.content) {
    refs.content.scrollTop = 0;
  }

  if (isDesktopLayout()) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  state.lastWindowScrollY = window.scrollY;
  refreshContentStickyBounds(true);
}

function enqueueSmoothContentScroll(deltaY) {
  if (!refs.content) {
    return;
  }

  const maxScroll = Math.max(0, refs.content.scrollHeight - refs.content.clientHeight);
  if (maxScroll <= 0) {
    return;
  }

  const baseTarget = state.contentWheelTarget ?? refs.content.scrollTop;
  state.contentWheelTarget = Math.max(0, Math.min(maxScroll, baseTarget + deltaY));

  if (state.contentWheelRafId) {
    return;
  }

  const step = () => {
    if (!refs.content || state.contentWheelTarget == null) {
      stopContentWheelAnimation();
      return;
    }

    const diff = state.contentWheelTarget - refs.content.scrollTop;
    if (Math.abs(diff) < 0.5) {
      refs.content.scrollTop = state.contentWheelTarget;
      stopContentWheelAnimation();
      return;
    }

    refs.content.scrollTop += diff * 0.22;
    state.contentWheelRafId = requestAnimationFrame(step);
  };

  state.contentWheelRafId = requestAnimationFrame(step);
}

function isDesktopLayout() {
  return window.matchMedia("(min-width: 861px)").matches;
}

function getContentStickyTopLimit() {
  return window.matchMedia("(max-width: 1024px)").matches ? 12 : 20;
}

function applyContentStickyTop(top) {
  if (!refs.content) {
    return;
  }

  refs.content.style.setProperty("--content-sticky-top", `${top}px`);
}

function refreshContentStickyBounds(resetToTop) {
  if (!refs.content) {
    return;
  }

  state.lastWindowScrollY = window.scrollY;

  if (!isDesktopLayout()) {
    state.contentStickyTop = getContentStickyTopLimit();
    state.contentStickyTopMin = state.contentStickyTop;
    applyContentStickyTop(state.contentStickyTop);
    return;
  }

  if (state.separatePanelScroll) {
    const topLimit = getContentStickyTopLimit();
    state.contentStickyTopMin = topLimit;
    state.contentStickyTop = topLimit;
    applyContentStickyTop(topLimit);
    return;
  }

  const topLimit = getContentStickyTopLimit();
  const contentHeight = refs.content.offsetHeight;
  const viewportHeight = window.innerHeight;
  const minTop = Math.min(topLimit, viewportHeight - topLimit - contentHeight);

  state.contentStickyTopMin = minTop;

  if (resetToTop) {
    state.contentStickyTop = topLimit;
  } else {
    state.contentStickyTop = Math.max(
      minTop,
      Math.min(topLimit, state.contentStickyTop)
    );
  }

  applyContentStickyTop(state.contentStickyTop);
}

function handleWindowScrollForContentSticky() {
  if (!refs.content) {
    return;
  }

  const currentScrollY = window.scrollY;
  const delta = currentScrollY - state.lastWindowScrollY;
  state.lastWindowScrollY = currentScrollY;

  if (!isDesktopLayout()) {
    return;
  }

  if (state.separatePanelScroll) {
    return;
  }

  if (delta === 0) {
    return;
  }

  const topLimit = getContentStickyTopLimit();
  const nextTop = Math.max(
    state.contentStickyTopMin,
    Math.min(topLimit, state.contentStickyTop - delta)
  );

  if (nextTop === state.contentStickyTop) {
    return;
  }

  state.contentStickyTop = nextTop;
  applyContentStickyTop(nextTop);
}

function clampPlanFontScale(scale) {
  return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, scale));
}

function applyPlanFontScale(scale) {
  const clamped = clampPlanFontScale(scale);
  const normalized = Math.round(clamped * 10) / 10;
  state.planFontScale = normalized;
  document.documentElement.style.setProperty("--plan-font-scale", String(normalized));
  localStorage.setItem("planFontScale", String(normalized));
  updateFontButtonsState();
  refreshContentStickyBounds(false);
}

function updateFontButtonsState() {
  if (refs.fontDecrease) {
    refs.fontDecrease.disabled = state.planFontScale <= FONT_SCALE_MIN;
  }
  if (refs.fontIncrease) {
    refs.fontIncrease.disabled = state.planFontScale >= FONT_SCALE_MAX;
  }
}

function changePlanFontScale(delta) {
  applyPlanFontScale(state.planFontScale + delta);
}

function attachEvents() {
  window.addEventListener("popstate", async (event) => {
    await restoreNavigationState(event.state);
  });

  window.addEventListener("scroll", handleWindowScrollForContentSticky, { passive: true });
  window.addEventListener("resize", () => {
    applySidebarResponsiveMode();
    refreshContentStickyBounds(false);
  }, { passive: true });

  if (refs.content) {
    refs.content.addEventListener("wheel", (event) => {
      if (!state.separatePanelScroll || !isDesktopLayout()) {
        return;
      }

      const maxScroll = Math.max(0, refs.content.scrollHeight - refs.content.clientHeight);
      if (maxScroll <= 0) {
        return;
      }

      event.preventDefault();
      enqueueSmoothContentScroll(event.deltaY);
    }, { passive: false });
  }

  if (refs.planSourceSelect) {
    refs.planSourceSelect.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }

      await switchPlanRoot(target.value);
    });
  }

  refs.tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      const category = tab.dataset.category;
      if (!category || category === state.currentCategory) {
        return;
      }

      setCurrentCategory(category);
      state.currentItem = null;
      applyTabState();
      renderLabelControls();
      renderItems();

      const first = getFilteredItems()[0];
      if (first) {
        await selectItem(first.path);
      } else {
        setStatus("Brak wynikow dla tej kategorii.", false);
      }
    });
  });

  refs.search.addEventListener("input", async (event) => {
    state.filterText = String(event.target.value || "").trim().toLowerCase();
    if (state.rememberCategoryFilters) {
      state.categoryFilters[state.currentCategory] = state.filterText;
    }
    renderItems();

    const active = getFilteredItems().find((item) => item.path === state.currentItem?.path);
    if (!active) {
      const first = getFilteredItems()[0];
      if (first) {
        await selectItem(first.path);
      } else {
        setStatus("Brak wynikow wyszukiwania.", false);
      }
    }
  });

  refs.menuToggle.addEventListener("click", () => {
    const isOpen = refs.sidebar.classList.toggle("open");
    refs.menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  refs.themeToggle.addEventListener("click", toggleTheme);

  if (refs.fontDecrease) {
    refs.fontDecrease.addEventListener("click", () => {
      changePlanFontScale(-FONT_SCALE_STEP);
    });
  }

  if (refs.fontIncrease) {
    refs.fontIncrease.addEventListener("click", () => {
      changePlanFontScale(FONT_SCALE_STEP);
    });
  }

  document.addEventListener("click", (event) => {
    if (!isSidebarCollapsedLayout()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (!refs.sidebar.contains(target) && target !== refs.menuToggle) {
      refs.sidebar.classList.remove("open");
      refs.menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function applyTabState() {
  refs.tabs.forEach((tab) => {
    const isActive = tab.dataset.category === state.currentCategory;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

async function loadIndex() {
  const planRoot = getPlanRoot();
  const indexPath = toPlanPath("lista.html");
  const response = await fetch(indexPath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Brak dostepu do " + indexPath);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  state.categories.oddzialy = parseCategory(doc, "oddzialy", planRoot);
  state.categories.nauczyciele = parseCategory(doc, "nauczyciele", planRoot);
  state.categories.sale = parseCategory(doc, "sale", planRoot);
  buildPathIndex();
}

function parseCategory(doc, id, planRoot) {
  const root = doc.getElementById(id);
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll("a[href]"))
    .map((a) => {
      const href = String(a.getAttribute("href") || "").trim();
      const normalized = href.replace(/^\.\//, "");
      return {
        category: id,
        label: normalizeSpaces(a.textContent || ""),
        path: toPlanPath(normalized, planRoot)
      };
    })
    .filter((item) => item.path !== normalizePlanRoot(planRoot));
}

async function loadPlanSources() {
  const archiveRoot = DEFAULT_ARCHIVE_ROOT;
  const sources = [
    {
      label: state.currentPlanSourceLabel || "Aktualny",
      root: DEFAULT_PLAN_ROOT
    }
  ];

  try {
    const response = await fetch(archiveRoot + "/", { cache: "no-store" });
    if (response.ok) {
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const folders = getArchiveFolderNames(doc);

      folders.forEach((name) => {
        sources.push({
          label: name,
          root: toPlanPath(name, archiveRoot)
        });
      });
    }
  } catch (error) {
    console.warn("Nie udalo sie odczytac listy folderu stareplany.", error);
  }

  state.planSources = sources;
}

function updateCurrentPlanSourceLabelFromPlan(plan) {
  if (!plan || getPlanRoot() !== DEFAULT_PLAN_ROOT) {
    return;
  }

  const date = extractIsoDateFromText(plan.validFrom);
  const nextLabel = date ? `Aktualny (${date} r.)` : "Aktualny";
  if (nextLabel === state.currentPlanSourceLabel) {
    return;
  }

  state.currentPlanSourceLabel = nextLabel;

  if (state.planSources[0]?.root === DEFAULT_PLAN_ROOT) {
    state.planSources[0].label = nextLabel;
    renderPlanSourceOptions();
  }
}

function extractIsoDateFromText(value) {
  const match = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(String(value || ""));
  if (!match) {
    return "";
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  // Walidacja zakresów
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");

  return `od ${dd}.${mm}.${year}`;
}

function getArchiveFolderNames(doc) {
  const folders = new Set();

  Array.from(doc.querySelectorAll("a[href]")).forEach((anchor) => {
    const href = String(anchor.getAttribute("href") || "").trim();
    if (!href || href === "./" || href === "../") {
      return;
    }

    const withoutHash = href.split("#")[0];
    const clean = withoutHash.split("?")[0];
    if (!clean) {
      return;
    }

    let folderName = "";

    const trimmed = clean.replace(/^\.\//, "").replace(/\/$/, "");
    if (!trimmed || trimmed.endsWith(".html")) {
      return;
    }

    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length === 0) {
      return;
    }

    folderName = decodeURIComponent(parts[parts.length - 1]);
    if (!folderName || folderName.toLowerCase() === "stareplany") {
      return;
    }

    folders.add(folderName);
  });

  const schoolYearStartDate = getCurrentSchoolYearStartDate();

  return Array.from(folders)
    .map((name) => {
      const parsedDate = parseArchiveFolderDate(name);
      return {
        name,
        date: parsedDate
      };
    })
    .filter((entry) => entry.date && entry.date.getTime() >= schoolYearStartDate.getTime())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, ARCHIVE_MAX_ENTRIES)
    .map((entry) => entry.name);
}

function getCurrentSchoolYearStartDate(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();

  // Rok szkolny trwa od 1 wrzesnia do 31 sierpnia.
  const schoolYearStartYear = monthIndex >= 8 ? year : year - 1;
  return new Date(schoolYearStartYear, 8, 1);
}

function parseArchiveFolderDate(folderName) {
  const match = /^do\s+(\d{4})\.(\d{2})\.(\d{2})$/i.exec(String(folderName || "").trim());
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, monthIndex, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function renderPlanSourceOptions() {
  if (!refs.planSourceSelect) {
    return;
  }

  refs.planSourceSelect.innerHTML = "";

  state.planSources.forEach((source, index) => {
    const option = document.createElement("option");
    option.value = source.root;
    let prefix = '';
    if (index >= 1) {
      prefix = ' ▸ Obowiązujący ';
    }

    option.textContent = prefix + source.label;
    refs.planSourceSelect.appendChild(option);

    if (index === 0 && state.planSources.length > 1) {
      const separator = document.createElement("option");
      separator.value = "";
      separator.textContent = "Archiwalne:";
      separator.disabled = true;
      refs.planSourceSelect.appendChild(separator);
    }
  });

  refs.planSourceSelect.value = getPlanRoot();
}

async function switchPlanRoot(nextRoot) {
  const normalizedNextRoot = normalizePlanRoot(nextRoot);
  if (!normalizedNextRoot || normalizedNextRoot === getPlanRoot()) {
    return;
  }

  state.currentPlanRoot = normalizedNextRoot;
  state.currentItem = null;
  state.currentPlan = null;
  resetFilterState({ allCategories: true });
  setStatus("Wczytywanie listy planow...", false);
  if (refs.planSourceSelect) {
    refs.planSourceSelect.value = normalizedNextRoot;
  }

  try {
    await loadIndex();
    renderItems();

    const first = state.categories[state.currentCategory][0] || getFilteredItems()[0];
    if (first) {
      await selectItem(first.path);
      return;
    }

    setStatus("Brak pozycji w wybranej wersji planu.", false);
  } catch (error) {
    console.error(error);
    setStatus("Nie udalo sie odczytac wybranej wersji planu.", true);
  }
}

function buildPathIndex() {
  state.pathIndex = new Map();
  Object.values(state.categories)
    .flat()
    .forEach((item) => {
      state.pathIndex.set(item.path, item);
    });
}

function findItemByPath(path) {
  return state.pathIndex.get(path) || null;
}

function getFilteredItems() {
  const items = state.categories[state.currentCategory] || [];
  if (!state.filterText) {
    return items;
  }

  return items.filter((item) => item.label.toLowerCase().includes(state.filterText));
}

function renderItems() {
  const items = getFilteredItems();
  refs.list.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Brak wynikow";
    refs.list.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.className = state.currentItem?.path === item.path ? "active" : "";
    button.addEventListener("click", async () => {
      await selectItem(item.path);
      if (isSidebarCollapsedLayout()) {
        refs.sidebar.classList.remove("open");
        refs.menuToggle.setAttribute("aria-expanded", "false");
      }
    });

    li.appendChild(button);
    refs.list.appendChild(li);
  });
}

async function selectItem(path, options) {
  const settings = {
    historyMode: "push",
    ...options
  };
  const requestId = ++state.planRequestId;

  const item = findItemByPath(path);
  if (item) {
    setCurrentCategory(item.category);
    state.currentItem = item;
    applyTabState();
    renderLabelControls();
  } else {
    state.currentItem = {
      category: state.currentCategory,
      label: path,
      path
    };
  }

  renderItems();
  setStatus("Wczytywanie planu...", false);

  try {
    const plan = await loadPlan(path);
    if (requestId !== state.planRequestId) {
      return;
    }

    state.currentPlan = plan;
    updateCurrentPlanSourceLabelFromPlan(plan);
    renderPlan(plan);
    resetPlanScrollPosition();
    updateNavigationState(settings.historyMode);
  } catch (error) {
    if (requestId !== state.planRequestId) {
      return;
    }

    console.error(error);
    state.currentPlan = null;
    setStatus("Nie udalo sie odczytac wybranego planu.", true);
  }
}

function updateNavigationState(mode) {
  if (!window.history || !window.location) {
    return;
  }

  const entry = createNavigationState();
  if (!entry.path) {
    return;
  }

  const currentState = readNavigationState(window.history.state);
  const sameAsCurrent =
    currentState &&
    currentState.path === entry.path &&
    currentState.planRoot === entry.planRoot &&
    currentState.category === entry.category;

  if (sameAsCurrent && mode !== "replace") {
    return;
  }

  const url = buildNavigationUrl(entry);
  if (mode === "replace" || sameAsCurrent) {
    window.history.replaceState(entry, "", url);
  } else {
    window.history.pushState(entry, "", url);
  }
}

function createNavigationState() {
  return {
    version: HISTORY_STATE_VERSION,
    planRoot: getPlanRoot(),
    category: state.currentCategory,
    path: state.currentItem?.path || ""
  };
}

function buildNavigationUrl(entry) {
  const url = new URL(window.location.href);

  url.searchParams.set("planRoot", entry.planRoot);
  url.searchParams.set("category", entry.category);
  url.searchParams.set("path", entry.path);

  return url.pathname + url.search + url.hash;
}

function readNavigationState(rawState) {
  if (!rawState || rawState.version !== HISTORY_STATE_VERSION) {
    return null;
  }

  const path = String(rawState.path || "").trim();
  if (!path) {
    return null;
  }

  return {
    version: HISTORY_STATE_VERSION,
    planRoot: normalizePlanRoot(rawState.planRoot || getPlanRoot()),
    category: String(rawState.category || "").trim() || state.currentCategory,
    path
  };
}

function parseNavigationStateFromUrl() {
  const url = new URL(window.location.href);
  const path = String(url.searchParams.get("path") || "").trim();
  if (!path) {
    return null;
  }

  return {
    version: HISTORY_STATE_VERSION,
    planRoot: normalizePlanRoot(url.searchParams.get("planRoot") || getPlanRoot()),
    category: String(url.searchParams.get("category") || "").trim() || state.currentCategory,
    path
  };
}

function getInitialNavigationState() {
  return readNavigationState(window.history.state) || parseNavigationStateFromUrl();
}

async function restoreNavigationState(rawState) {
  const entry = readNavigationState(rawState) || parseNavigationStateFromUrl();
  if (!entry?.path) {
    return;
  }

  if (entry.planRoot && entry.planRoot !== getPlanRoot()) {
    state.currentPlanRoot = entry.planRoot;
    state.currentItem = null;
    state.currentPlan = null;
    resetFilterState({ allCategories: true });
    if (refs.planSourceSelect) {
      refs.planSourceSelect.value = entry.planRoot;
    }

    await loadIndex();
    renderItems();
  }

  if (entry.category && state.currentCategory !== entry.category) {
    setCurrentCategory(entry.category);
    applyTabState();
    renderLabelControls();
    renderItems();
  }

  await selectItem(entry.path, { historyMode: "replace" });
}

function getLabelVisibility(category) {
  return state.labelVisibility[category] || state.labelVisibility.oddzialy;
}

function renderLabelControls() {
  if (!refs.labelControls) {
    return;
  }

  const visibility = getLabelVisibility(state.currentCategory);
  const togglesByCategory = {
    oddzialy: [
      { key: "teacher", text: "Pokaz link nauczyciela" },
      { key: "room", text: "Pokaz link sali" }
    ],
    nauczyciele: [
      { key: "group", text: "Pokaz link oddzialu" },
      { key: "room", text: "Pokaz link sali" }
    ],
    sale: [
      { key: "teacher", text: "Pokaz link nauczyciela" },
      { key: "group", text: "Pokaz link oddzialu" }
    ]
  };
  const toggles = togglesByCategory[state.currentCategory] || togglesByCategory.oddzialy;

  refs.labelControls.innerHTML = "";

  const title = document.createElement("p");
  title.className = "label-controls-title";
  title.textContent = "Ustawienia wyswietlania planu:";
  refs.labelControls.appendChild(title);

  toggles.forEach((toggle) => {
    createLabelToggle(toggle.key, toggle.text, visibility[toggle.key]);
  });

  createScrollModeToggle();
  createHideEmptyDaysToggle();
  createRememberCategoryFiltersToggle();
}

function createScrollModeToggle() {
  const toggle = createToggleLine({
    id: "separate-scroll-toggle",
    text: "Przewijaj panele osobno",
    checked: state.separatePanelScroll,
    onChange: (checked) => {
      applyPanelScrollMode(checked);
    }
  });

  refs.labelControls.appendChild(toggle);
}

function createHideEmptyDaysToggle() {
  const toggle = createToggleLine({
    id: "hide-empty-days-toggle",
    text: "Ukryj dni bez zajęć",
    checked: state.hideEmptyDays,
    onChange: (checked) => {
      applyHideEmptyDaysMode(checked);
    }
  });

  refs.labelControls.appendChild(toggle);
}

function createRememberCategoryFiltersToggle() {
  const toggle = createToggleLine({
    id: "remember-category-filters-toggle",
    text: "Pamietaj filtrowania w kategoriach",
    checked: state.rememberCategoryFilters,
    onChange: (checked) => {
      applyRememberCategoryFiltersMode(checked);
    }
  });

  refs.labelControls.appendChild(toggle);
}

function createLabelToggle(key, text, checked) {
  const toggleId = `label-toggle-${state.currentCategory}-${key}`;
  const toggle = createToggleLine({
    id: toggleId,
    text,
    checked,
    onChange: (isChecked) => {
    const visibility = getLabelVisibility(state.currentCategory);
      visibility[key] = isChecked;
    if (state.currentPlan) {
      renderPlan(state.currentPlan);
    }
    }
  });

  refs.labelControls.appendChild(toggle);
}

function createToggleLine(options) {
  const settings = {
    id: "",
    text: "",
    checked: false,
    onChange: () => {},
    className: "toggle-line",
    ...options
  };

  const wrapper = document.createElement("label");
  wrapper.className = settings.className;

  if (settings.id) {
    wrapper.setAttribute("for", settings.id);
  }

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = settings.checked;
  if (settings.id) {
    input.id = settings.id;
  }
  input.addEventListener("change", () => {
    settings.onChange(input.checked);
  });

  const caption = document.createElement("span");
  caption.textContent = settings.text;

  wrapper.appendChild(input);
  wrapper.appendChild(caption);
  return wrapper;
}

async function loadPlan(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Brak dostepu do pliku planu: " + path);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const title = normalizeSpaces(doc.querySelector(".tytulnapis")?.textContent || state.currentItem?.label || "Plan lekcji");
  const validFrom = normalizeSpaces(findLabelText(doc, "Obowiązuje od:"));
  const generated = normalizeSpaces(doc.querySelector(".op")?.textContent || findLabelText(doc, "wygenerowano"));

  const table = doc.querySelector("table.tabela");
  if (!table) {
    throw new Error("Nie znaleziono tabeli planu w pliku: " + path);
  }

  const rows = Array.from(table.querySelectorAll("tr"));
  const headerCells = rows[0]?.querySelectorAll("th") || [];
  const days = Array.from(headerCells)
    .slice(2)
    .map((th) => normalizeSpaces(th.textContent || ""));

  const lessons = [];

  rows.slice(1).forEach((row) => {
    const numberCell = row.querySelector("td.nr");
    const timeCell = row.querySelector("td.g");
    if (!numberCell || !timeCell) {
      return;
    }

    const dayCells = Array.from(row.querySelectorAll("td.l"));
    const dayEntries = dayCells.map((cell) => parseLessonCell(cell));

    lessons.push({
      number: normalizeSpaces(numberCell.textContent || ""),
      time: normalizeSpaces(timeCell.textContent || ""),
      dayEntries
    });
  });

  return {
    title,
    validFrom,
    generated,
    days,
    lessons,
    path
  };
}

function parseCommentText(text) {
  return formatSubjectName(text);
}

function parseLessonCell(cell) {
  const html = String(cell.innerHTML || "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  if (!html || html === "") {
    return [];
  }

  const chunks = html
    .split(/<br\s*\/?>/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const entries = chunks
    .map((chunk) => {
      const holder = document.createElement("div");
      holder.innerHTML = chunk;

      const subjectNode = holder.querySelector(".p");
      const isComment = !subjectNode;

      const subject = isComment
        ? parseCommentText(holder.textContent || "")
        : formatSubjectName(subjectNode.textContent || "");

      const teacherNode = isComment ? null : holder.querySelector("a.n");
      const groupNode = isComment ? null : holder.querySelector("a.o, a.k");
      const roomNode = isComment ? null : holder.querySelector("a.s");

      const teacher = normalizeSpaces(teacherNode?.textContent || "");
      const group = normalizeSpaces(groupNode?.textContent || "");
      const room = normalizeSpaces(roomNode?.textContent || "");
      const text = isComment ? subject : normalizeSpaces(holder.textContent || "");

      return {
        subject,
        teacher,
        teacherLink: resolvePlanPath(teacherNode?.getAttribute("href")),
        group,
        groupLink: resolvePlanPath(groupNode?.getAttribute("href")),
        room,
        roomLink: resolvePlanPath(roomNode?.getAttribute("href")),
        text,
        isComment
      };
    })
    .filter((entry) => entry.text.length > 0);

  return entries;
}

function resolvePlanPath(href) {
  const raw = String(href || "").trim();
  if (!raw) {
    return "";
  }

  if (/^(https?:)?\/\//i.test(raw)) {
    return raw;
  }

  const clean = raw.replace(/^\.\//, "").replace(/^\//, "");
  if (clean.startsWith("src/")) {
    return toPlanPath(clean.slice(4));
  }
  if (clean.startsWith("plany/")) {
    return toPlanPath(clean);
  }
  if (/^[nos]\d+\.html$/i.test(clean)) {
    return toPlanPath("plany/" + clean);
  }
  return toPlanPath("plany/" + clean);
}

async function handleLinkedPlanClick(path, event) {
  event.preventDefault();
  if (!path) {
    return;
  }

  resetFilterState();
  await selectItem(path);
}

function renderPlan(plan) {
  refs.title.textContent = plan.title || "Plan lekcji";

  refs.meta.textContent = "";
  renderGeneratedInfo(plan);
  const labelVisibility = getLabelVisibility(state.currentCategory);

  refs.schedule.innerHTML = "";
  refs.schedule.appendChild(createDesktopTable(plan, labelVisibility));

  const mobileSchedule = createMobileSchedule(plan, labelVisibility);
  refs.schedule.appendChild(mobileSchedule.container);

  if (mobileSchedule.activeDayIndex >= 0) {
    setActiveMobileDay(mobileSchedule.container, mobileSchedule.activeDayIndex);
  }

  refreshContentStickyBounds(false);
}

function renderGeneratedInfo(plan) {
  if (!refs.generatedInfo) {
    return;
  }

  refs.generatedInfo.innerHTML = "";

  const info = document.createElement("p");
  const parts = [];

  if (plan.validFrom) {
    // parts.push(plan.validFrom);
  }

  parts.push("Wygenerowano za pomocą programu Vulcan");
  info.append(parts.join(" | "));

  const repo_link = document.createElement("a");
  repo_link.href = 'https://github.com/November7/TimetableWrapper';
  repo_link.target = "_blank";
  repo_link.rel = "noopener noreferrer";
  repo_link.textContent = "GitHub repository - Timetable Wrapper (version: " + APP_VERSION + ")";

  const br = document.createElement("br");
  info.append(br, repo_link);


  const link = document.createElement("a");
  link.href = plan.path;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = plan.path;

  // info.appendChild(link);
  refs.generatedInfo.appendChild(info);
}

function createDesktopTable(plan, labelVisibility) {
  const visibleDayIndexes = getVisibleDayIndexes(plan);

  const table = document.createElement("table");
  table.className = "timetable";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  headRow.appendChild(makeHeaderCell("Nr"));
  headRow.appendChild(makeHeaderCell("Godz."));
  visibleDayIndexes.forEach((dayIndex) => {
    headRow.appendChild(makeHeaderCell(plan.days[dayIndex] || ""));
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  plan.lessons.forEach((lesson) => {
    const row = document.createElement("tr");

    const num = document.createElement("td");
    num.className = "lesson-col";
    num.textContent = lesson.number;

    const time = document.createElement("td");
    time.className = "time-col";
    time.textContent = lesson.time;

    row.appendChild(num);
    row.appendChild(time);

    visibleDayIndexes.forEach((dayIndex) => {
      const entries = lesson.dayEntries[dayIndex] || [];
      const cell = document.createElement("td");
      cell.className = "day-cell";
      const displayEntries = buildDisplayEntries(entries);

      if (displayEntries.length === 0) {
        const empty = document.createElement("span");
        empty.className = "empty";
        empty.textContent = "-";
        cell.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "entry-list";
        list.style.setProperty("--entry-columns", String(Math.max(1, displayEntries.length)));

        displayEntries.forEach((entry) => {
          if (entry.isPlaceholder) {
            list.appendChild(createEmptyEntryCard());
          } else {
            list.appendChild(createEntryCard(entry, labelVisibility, false));
          }
        });

        cell.appendChild(list);
      }

      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

function createMobileSchedule(plan, labelVisibility) {
  const container = document.createElement("div");
  container.className = "mobile-days";

  const visibleDayIndexes = getVisibleDayIndexes(plan);
  const visibleDays = visibleDayIndexes.map((dayIndex) => plan.days[dayIndex] || "");
  const activeDayIndex = getTodayPlanDayIndex(visibleDays);

  visibleDayIndexes.forEach((sourceDayIndex, dayIndex) => {
    const day = plan.days[sourceDayIndex] || "";
    const section = document.createElement("section");
    section.className = "mobile-day";
    section.dataset.dayIndex = String(dayIndex);
    section.tabIndex = -1;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-day-toggle";
    button.textContent = day;
    button.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "mobile-day-panel";
    panel.hidden = true;

    const lessons = plan.lessons.filter((lesson) => {
      const entries = lesson.dayEntries[sourceDayIndex] || [];
      return buildDisplayEntries(entries).some((entry) => !entry.isPlaceholder);
    });
    if (lessons.length === 0) {
      const empty = document.createElement("p");
      empty.className = "mobile-day-empty";
      empty.textContent = "Brak zajęć";
      panel.appendChild(empty);
    } else {
      lessons.forEach((lesson) => {
        const lessonBlock = document.createElement("article");
        lessonBlock.className = "mobile-lesson";

        const header = document.createElement("div");
        header.className = "mobile-lesson-header";

        const number = document.createElement("span");
        number.className = "mobile-lesson-number";
        number.textContent = lesson.number + ". lekcja";

        const time = document.createElement("span");
        time.className = "mobile-lesson-time";
        time.textContent = lesson.time;

        header.appendChild(number);
        header.appendChild(time);
        lessonBlock.appendChild(header);

        const entryList = document.createElement("div");
        entryList.className = "mobile-entry-list";
        const displayEntries = buildDisplayEntries(lesson.dayEntries[sourceDayIndex] || []);
        entryList.style.setProperty("--entry-columns", String(Math.max(1, displayEntries.length)));
        displayEntries.forEach((entry) => {
          if (entry.isPlaceholder) {
            entryList.appendChild(createEmptyEntryCard());
          } else {
            entryList.appendChild(createEntryCard(entry, labelVisibility, true));
          }
        });

        lessonBlock.appendChild(entryList);
        panel.appendChild(lessonBlock);
      });
    }

    button.addEventListener("click", () => {
      setActiveMobileDay(container, dayIndex);
    });

    section.appendChild(button);
    section.appendChild(panel);
    container.appendChild(section);
  });

  return {
    container,
    activeDayIndex
  };
}

function getVisibleDayIndexes(plan) {
  const dayCount = Array.isArray(plan?.days) ? plan.days.length : 0;
  const indexes = Array.from({ length: dayCount }, (_, index) => index);

  if (!state.hideEmptyDays) {
    return indexes;
  }

  const visible = indexes.filter((dayIndex) => {
    return plan.lessons.some((lesson) => {
      const entries = lesson.dayEntries[dayIndex] || [];
      return entries.length > 0;
    });
  });

  return visible.length > 0 ? visible : indexes;
}

function createEntryCard(entry, labelVisibility, showLabel) {
  const card = document.createElement("article");
  card.className = "entry";

  const subject = document.createElement("div");
  subject.className = "subject";
  const fullSubjectText = entry.subject || entry.text;
  subject.textContent = fullSubjectText;
  subject.title = fullSubjectText;
  card.appendChild(subject);

  const detailsNode = document.createElement("div");
  detailsNode.className = "entry-links";
  appendDetailNode(detailsNode, "Oddzial", entry.group, entry.groupLink, labelVisibility.group, showLabel);
  appendDetailNode(detailsNode, "Nauczyciel", entry.teacher, entry.teacherLink, labelVisibility.teacher, showLabel);
  appendDetailNode(detailsNode, "Sala", entry.room, entry.roomLink, labelVisibility.room, showLabel);

  if (detailsNode.childElementCount > 0) {
    card.appendChild(detailsNode);
  }

  return card;
}

function createEmptyEntryCard() {
  const card = document.createElement("article");
  card.className = "entry entry-placeholder";

  const subject = document.createElement("div");
  subject.className = "subject";
  subject.textContent = "-";
  card.appendChild(subject);

  return card;
}

function buildDisplayEntries(entries) {
  const safeEntries = Array.isArray(entries) ? entries.slice() : [];
  if (safeEntries.length !== 1) {
    return safeEntries;
  }

  const onlyEntry = safeEntries[0];
  const fraction = readGroupFraction(onlyEntry);
  if (!fraction || fraction.denominator < 2) {
    return safeEntries;
  }

  const placeholder = { isPlaceholder: true };
  if (fraction.numerator === 1) {
    return [onlyEntry, placeholder];
  }

  return [placeholder, onlyEntry];
}

function readGroupFraction(entry) {
  if (!entry) {
    return null;
  }

  const candidates = [entry.subject, entry.group, entry.text];
  for (const candidate of candidates) {
    const match = /(?:^|\s)(\d+)\/(\d+)(?=\s|$)/.exec(String(candidate || ""));
    if (!match) {
      continue;
    }

    const numerator = Number.parseInt(match[1], 10);
    const denominator = Number.parseInt(match[2], 10);
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
      continue;
    }

    return {
      numerator,
      denominator
    };
  }

  return null;
}

function getTodayPlanDayIndex(days) {
  const today = new Date().getDay();
  const aliases = {
    niedziela: 0,
    ndz: 0,
    poniedzialek: 1,
    pon: 1,
    wtorek: 2,
    wt: 2,
    sroda: 3,
    sr: 3,
    czwartek: 4,
    czw: 4,
    piatek: 5,
    pt: 5,
    sobota: 6,
    sob: 6
  };

  const dayIndex = days.findIndex((day) => aliases[normalizeDayName(day)] === today);
  return dayIndex >= 0 ? dayIndex : 0;
}

function normalizeDayName(value) {
  return normalizeSpaces(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setActiveMobileDay(container, activeDayIndex) {
  const sections = Array.from(container.querySelectorAll(".mobile-day"));
  let activeSection = null;
  let activeButton = null;

  sections.forEach((section, dayIndex) => {
    const isActive = dayIndex === activeDayIndex;
    section.classList.toggle("active", isActive);

    const button = section.querySelector(".mobile-day-toggle");
    const panel = section.querySelector(".mobile-day-panel");
    if (button) {
      button.setAttribute("aria-expanded", String(isActive));
    }
    if (panel) {
      panel.hidden = !isActive;
    }

    if (isActive) {
      activeSection = section;
      activeButton = button;
    }
  });

  if (!activeSection || !activeButton) {
    return;
  }
}

function appendDetailNode(container, label, value, linkPath, isVisible, showLabel) {
  if (!isVisible || !value) {
    return;
  }

  const line = document.createElement("span");
  line.className = "details";
  if (showLabel) {
    line.append(label + ": ");
  }

  if (linkPath) {
    const anchor = document.createElement("a");
    anchor.className = "entry-link";
    anchor.href = "#";
    anchor.textContent = value;
    anchor.addEventListener("click", async (event) => {
      await handleLinkedPlanClick(linkPath, event);
    });
    line.appendChild(anchor);
  } else {
    line.append(value);
  }

  container.appendChild(line);
}

function makeHeaderCell(text) {
  const cell = document.createElement("th");
  cell.textContent = text;
  return cell;
}

function findLabelText(doc, marker) {
  const text = normalizeSpaces(doc.body?.textContent || "");
  const lowerText = text.toLowerCase();
  const lowerMarker = marker.toLowerCase();

  const index = lowerText.indexOf(lowerMarker);
  if (index < 0) {
    return "";
  }

  return text.slice(index, index + 80);
}

function setStatus(message, isError) {
  refs.schedule.innerHTML = "";
  refs.generatedInfo.textContent = "";
  const el = document.createElement("div");
  el.className = "status" + (isError ? " error" : "");
  el.textContent = message;
  refs.schedule.appendChild(el);
}

function normalizeSpaces(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

init();
