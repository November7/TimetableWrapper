const state = {
  categories: {
    oddzialy: [],
    nauczyciele: [],
    sale: []
  },
  pathIndex: new Map(),
  currentCategory: "oddzialy",
  currentItem: null,
  filterText: "",
  currentPlan: null,
  planFontScale: 1,
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
  list: document.getElementById("item-list"),
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

const FONT_SCALE_MIN = 0.8;
const FONT_SCALE_MAX = 1.3;
const FONT_SCALE_STEP = 0.1;

async function init() {
  setupTheme();
  setupPlanFontScale();
  attachEvents();
  renderLabelControls();
  setStatus("Wczytywanie listy planow...");

  try {
    await loadIndex();
    renderItems();

    const first = state.categories[state.currentCategory][0];
    if (first) {
      await selectItem(first.path);
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
  refs.tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      const category = tab.dataset.category;
      if (!category || category === state.currentCategory) {
        return;
      }

      state.currentCategory = category;
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
    if (window.innerWidth > 860) {
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
  const response = await fetch("src/lista.html", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Brak dostepu do src/lista.html");
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  state.categories.oddzialy = parseCategory(doc, "oddzialy");
  state.categories.nauczyciele = parseCategory(doc, "nauczyciele");
  state.categories.sale = parseCategory(doc, "sale");
  buildPathIndex();
}

function parseCategory(doc, id) {
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
        path: "src/" + normalized
      };
    })
    .filter((item) => item.path !== "src/");
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
      if (window.innerWidth <= 860) {
        refs.sidebar.classList.remove("open");
        refs.menuToggle.setAttribute("aria-expanded", "false");
      }
    });

    li.appendChild(button);
    refs.list.appendChild(li);
  });
}

async function selectItem(path) {
  const item = findItemByPath(path);
  if (item) {
    state.currentCategory = item.category;
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
    state.currentPlan = plan;
    renderPlan(plan);
  } catch (error) {
    console.error(error);
    state.currentPlan = null;
    setStatus("Nie udalo sie odczytac wybranego planu.", true);
  }
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
  title.textContent = "Etykiety w komorkach";
  refs.labelControls.appendChild(title);

  toggles.forEach((toggle) => {
    createLabelToggle(toggle.key, toggle.text, visibility[toggle.key]);
  });
}

function createLabelToggle(key, text, checked) {
  const wrapper = document.createElement("label");
  wrapper.className = "toggle-line";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => {
    const visibility = getLabelVisibility(state.currentCategory);
    visibility[key] = input.checked;
    if (state.currentPlan) {
      renderPlan(state.currentPlan);
    }
  });

  const caption = document.createElement("span");
  caption.textContent = text;

  wrapper.appendChild(input);
  wrapper.appendChild(caption);
  refs.labelControls.appendChild(wrapper);
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
  const validFrom = normalizeSpaces(findLabelText(doc, "Obowiazuje od:"));
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

      const subject = normalizeSpaces(holder.querySelector(".p")?.textContent || "");
      const teacherNode = holder.querySelector("a.n");
      const groupNode = holder.querySelector("a.o, a.k");
      const roomNode = holder.querySelector("a.s");

      const teacher = normalizeSpaces(teacherNode?.textContent || "");
      const group = normalizeSpaces(groupNode?.textContent || "");
      const room = normalizeSpaces(roomNode?.textContent || "");
      const text = normalizeSpaces(holder.textContent || "");

      return {
        subject,
        teacher,
        teacherLink: resolvePlanPath(teacherNode?.getAttribute("href")),
        group,
        groupLink: resolvePlanPath(groupNode?.getAttribute("href")),
        room,
        roomLink: resolvePlanPath(roomNode?.getAttribute("href")),
        text
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

  const clean = raw.replace(/^\.\//, "");
  if (clean.startsWith("src/")) {
    return clean;
  }
  if (clean.startsWith("plany/")) {
    return "src/" + clean;
  }
  if (/^[nos]\d+\.html$/i.test(clean)) {
    return "src/plany/" + clean;
  }
  return "src/plany/" + clean;
}

async function handleLinkedPlanClick(path, event) {
  event.preventDefault();
  if (!path) {
    return;
  }

  state.filterText = "";
  refs.search.value = "";
  await selectItem(path);
}

function renderPlan(plan) {
  refs.title.textContent = plan.title || "Plan lekcji";

  const metaParts = [];
  if (plan.validFrom) {
    metaParts.push(plan.validFrom);
  }
  refs.meta.textContent = metaParts.join(" | ");
  refs.generatedInfo.textContent = plan.generated || "";
  const labelVisibility = getLabelVisibility(state.currentCategory);

  const table = document.createElement("table");
  table.className = "timetable";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  headRow.appendChild(makeHeaderCell("Nr"));
  headRow.appendChild(makeHeaderCell("Godz."));
  plan.days.forEach((day) => headRow.appendChild(makeHeaderCell(day)));

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

    lesson.dayEntries.forEach((entries) => {
      const cell = document.createElement("td");
      cell.className = "day-cell";

      if (entries.length === 0) {
        const empty = document.createElement("span");
        empty.className = "empty";
        empty.textContent = "-";
        cell.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "entry-list";

        entries.forEach((entry) => {
          const card = document.createElement("article");
          card.className = "entry";

          const subject = document.createElement("div");
          subject.className = "subject";
          subject.textContent = entry.subject || entry.text;
          card.appendChild(subject);

          const detail = [
            entry.group,
            entry.teacher,
            entry.room
          ].filter(Boolean);

          if (detail.length > 0) {
            const detailsNode = document.createElement("div");
            detailsNode.className = "entry-links";
            appendDetailNode(detailsNode, "Oddzial", entry.group, entry.groupLink, labelVisibility.group, false);
            appendDetailNode(detailsNode, "Nauczyciel", entry.teacher, entry.teacherLink, labelVisibility.teacher, false);
            appendDetailNode(detailsNode, "Sala", entry.room, entry.roomLink, labelVisibility.room, false);
            card.appendChild(detailsNode);
          }

          list.appendChild(card);
        });

        cell.appendChild(list);
      }

      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  refs.schedule.innerHTML = "";
  refs.schedule.appendChild(table);
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
