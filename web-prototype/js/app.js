/* Fit Buddy — web prototype application code.
 *
 * Single-file implementation that pulls together state, views, sheets,
 * business logic and the test runner. Pure functions used by the runner are
 * collected in `LOGIC` and exported on window.UFB_LOGIC for assertion tests.
 */
(function (global) {
  'use strict';

  const { icon } = global.UFB_ICONS;
  const { FOODS, EXERCISES } = global.UFB_DATA;
  const { BARCODE_FIXTURES, generateDemoData } = global.UFB_FIXTURES;

  // ============================================================
  // DOM helpers
  // ============================================================
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (attrs[k] == null || attrs[k] === false) continue;
        if (k === 'class') el.className = attrs[k];
        else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(el.style, attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k === 'html') el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      el.appendChild(typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child);
    }
    return el;
  }
  const svg = (name, opts) => {
    const wrap = document.createElement('span');
    wrap.style.display = 'inline-flex';
    wrap.innerHTML = icon(name, opts);
    return wrap.firstChild;
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ============================================================
  // Persistence + state
  // ============================================================
  const STORAGE_KEY = 'ufb_state_v4';
  const defaultState = () => ({
    theme: null,         // null = follow system, 'light' or 'dark' = override
    goals: {
      calories: 2200, protein: 160, carbs: 220, fat: 70,
      height: 180, weight: 80,
      waterMl: 2500
    },
    user: { displayName: '' },
    meals: {},           // yyyy-mm-dd → { breakfast: [], lunch: [], dinner: [], snack: [] }
    workouts: [],        // [{ id, startedAt, endedAt, name, sets: [...] }]
    weights: [],         // [{ kg, recordedAt }]
    customFoods: [],     // user-defined foods
    favouriteFoodIds: [],// foodIds the user pinned
    routines: [],        // [{ id, name, exerciseIds: [], notes }]
    customExercises: [], // user-created exercises mirroring EXERCISES shape
    recipes: [],         // [{ id, name, servings, ingredients: [{ foodId, grams }] }]
    savedMeals: [],      // [{ id, name, items: [{ foodId, grams }] }]
    waterLog: {},        // yyyy-mm-dd → [{ ml, at }]
    cardio: {},          // yyyy-mm-dd → [{ id, type, minutes, kcal, at }]
    bodyMeasurements: [],// [{ kind, value, recordedAt }] kind: chest/arm/waist/thigh/bodyFat/etc
    onboarded: false,    // first-launch onboarding seen
    activeWorkoutId: null
  });

  function loadState() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      || JSON.parse(localStorage.getItem('ufb_state_v3') || 'null');  // v3 → v4 auto-upgrade
    const def = defaultState();
    if (!stored || typeof stored !== 'object') return def;
    return {
      ...def,
      ...stored,
      goals: { ...def.goals, ...(stored.goals || {}) },
      user: { ...def.user, ...(stored.user || {}) },
      meals: stored.meals || def.meals,
      waterLog: stored.waterLog || def.waterLog,
      cardio: stored.cardio || def.cardio,
      workouts: Array.isArray(stored.workouts) ? stored.workouts : def.workouts,
      weights: Array.isArray(stored.weights) ? stored.weights : def.weights,
      customFoods: Array.isArray(stored.customFoods) ? stored.customFoods : def.customFoods,
      favouriteFoodIds: Array.isArray(stored.favouriteFoodIds) ? stored.favouriteFoodIds : def.favouriteFoodIds,
      routines: Array.isArray(stored.routines) ? stored.routines : def.routines,
      customExercises: Array.isArray(stored.customExercises) ? stored.customExercises : def.customExercises,
      recipes: Array.isArray(stored.recipes) ? stored.recipes : def.recipes,
      savedMeals: Array.isArray(stored.savedMeals) ? stored.savedMeals : def.savedMeals,
      bodyMeasurements: Array.isArray(stored.bodyMeasurements) ? stored.bodyMeasurements : def.bodyMeasurements
    };
  }
  let state = loadState();
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function reset() { state = defaultState(); save(); }

  // ============================================================
  // Theme
  // ============================================================
  function applyTheme() {
    const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = state.theme ? state.theme === 'dark' : sysDark;
    document.body.dataset.theme = dark ? 'dark' : 'light';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  function setTheme(t) { state.theme = t; save(); applyTheme(); rerender(); }

  // ============================================================
  // Pure business logic (exposed for tests)
  // ============================================================
  const LOGIC = {
    /* Per-100g food → macros for given grams. */
    macrosFor(food, grams) {
      const k = grams / 100;
      return {
        cal: food.cal * k,
        p: food.p * k,
        c: food.c * k,
        f: food.f * k,
        fiber: (food.fiber || 0) * k
      };
    },

    /* Sum entries on a given date into one macro total. */
    totalsForDate(meals, dateKey) {
      const safe = meals || {};
      const day = safe[dateKey] || {};
      let cal = 0, p = 0, c = 0, f = 0;
      for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
        for (const e of (day[slot] || [])) {
          cal += e.cal; p += e.p; c += e.c; f += e.fat;
        }
      }
      return { cal, p, c, f };
    },

    /* Plate calc — returns [{plate, count}] for one side of the bar. */
    platesPerSide(targetKg, barKg, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
      let rem = Math.max(0, (targetKg - barKg) / 2);
      const out = [];
      for (const p of plates) {
        const n = Math.floor(rem / p + 1e-9);
        if (n > 0) {
          out.push({ plate: p, count: n });
          rem -= n * p;
        }
      }
      return out;
    },

    /* Epley formula 1RM estimate. */
    estimate1RM(weightKg, reps) {
      if (weightKg <= 0 || reps <= 0) return 0;
      return weightKg * (1 + reps / 30);
    },

    /* Group sets by exercise, preserving in-session order. */
    groupSets(sets) {
      const map = new Map();
      for (const s of sets) {
        if (!map.has(s.exerciseId)) {
          map.set(s.exerciseId, { id: s.exerciseId, name: s.exerciseName, sets: [] });
        }
        map.get(s.exerciseId).sets.push(s);
      }
      return [...map.values()];
    },

    /* Total volume kg for a workout. */
    totalVolume(sets) {
      return sets.reduce((s, x) => s + ((x.weight || 0) * (x.reps || 0)), 0);
    },

    /* yyyy-mm-dd date key, local timezone safe. */
    dateKey(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    /* Days between two dates (ignoring time). */
    daysBetween(a, b) {
      const ms = 86400000;
      const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((b0 - a0) / ms);
    },

    /* Goal progress, capped at 100% for display. */
    goalProgress(value, goal) {
      if (goal <= 0) return 0;
      return Math.max(0, Math.min(1, value / goal));
    },

    /* Lookup a barcode against the fixture set. Returns null if not found. */
    lookupBarcode(code, fixtures) {
      const cleaned = (code || '').trim();
      return fixtures.find(f => f.barcode === cleaned) || null;
    },

    /* Total water in ml for a given date. */
    waterTotalForDate(waterLog, dateKey) {
      const entries = (waterLog && waterLog[dateKey]) || [];
      return entries.reduce((s, e) => s + (e.ml || 0), 0);
    },

    /* Total calories burned via cardio for a given date. */
    cardioTotalForDate(cardio, dateKey) {
      const entries = (cardio && cardio[dateKey]) || [];
      return entries.reduce((s, e) => s + (e.kcal || 0), 0);
    },

    /* Recently logged food ids, ordered most-recent first, deduped, capped. */
    recentFoodIds(meals, limit = 30) {
      const seen = new Map();
      const dates = Object.keys(meals || {}).sort().reverse();
      for (const day of dates) {
        const slots = meals[day] || {};
        for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
          const entries = slots[slot] || [];
          // most recent at end of array → iterate reversed for "newest first within day"
          for (let i = entries.length - 1; i >= 0; i--) {
            const id = entries[i].foodId;
            if (!id || id === 'custom' || id === 'quickadd') continue;
            if (!seen.has(id)) seen.set(id, entries[i].consumedAt);
            if (seen.size >= limit) return [...seen.keys()];
          }
        }
      }
      return [...seen.keys()];
    },

    /* Detect a personal record: heaviest completed weight × reps for an
     * exercise across the entire history, where "PR" means a NEW max weight
     * for any rep count, OR a new max for the same/lower rep count. */
    detectPRs(allSets) {
      const byExercise = new Map();
      const completed = [...allSets]
        .filter(s => s.completed)
        .sort((a, b) => new Date(a.performedAt) - new Date(b.performedAt));
      const prs = new Set();
      for (const s of completed) {
        const key = s.exerciseId;
        if (!byExercise.has(key)) byExercise.set(key, []);
        const prior = byExercise.get(key);
        const isPR = !prior.some(p => p.weight >= s.weight && p.reps >= s.reps);
        if (isPR && s.weight > 0 && s.reps > 0) {
          prs.add(s.id || `${s.exerciseId}:${s.performedAt}`);
        }
        prior.push(s);
      }
      return prs;
    },

    /* Compose a recipe's per-serving macros from its ingredients. */
    recipePerServing(recipe, foodLookup) {
      const totals = { cal: 0, p: 0, c: 0, f: 0, fiber: 0 };
      for (const ing of (recipe.ingredients || [])) {
        const food = foodLookup(ing.foodId);
        if (!food) continue;
        const factor = (ing.grams || 0) / 100;
        totals.cal   += (food.cal || 0) * factor;
        totals.p     += (food.p   || 0) * factor;
        totals.c     += (food.c   || 0) * factor;
        totals.f     += (food.f   || 0) * factor;
        totals.fiber += (food.fiber || 0) * factor;
      }
      const servings = Math.max(1, recipe.servings || 1);
      return {
        cal: totals.cal / servings,
        p: totals.p / servings,
        c: totals.c / servings,
        f: totals.f / servings,
        fiber: totals.fiber / servings
      };
    },

    /* Streak: number of consecutive days up to today that have at least one
     * logged meal entry. */
    mealStreak(meals, today) {
      let count = 0;
      let d = new Date(today);
      d.setHours(0, 0, 0, 0);
      while (true) {
        const k = LOGIC.dateKey(d);
        const slots = meals[k] || {};
        const has = ['breakfast','lunch','dinner','snack'].some(s => (slots[s] || []).length > 0);
        if (!has) break;
        count++;
        d.setDate(d.getDate() - 1);
      }
      return count;
    },

    /* Best estimated 1RM per session, sorted by date. */
    bestPerSession(allSets) {
      const byDay = new Map();
      for (const s of allSets) {
        if (!s.completed) continue;
        const d = new Date(s.performedAt);
        const key = LOGIC.dateKey(d);
        const v = LOGIC.estimate1RM(s.weight, s.reps);
        if (!byDay.has(key) || byDay.get(key).oneRm < v) {
          byDay.set(key, { date: key, oneRm: v });
        }
      }
      return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    }
  };

  // ============================================================
  // Today / date plumbing
  // ============================================================
  let viewDate = new Date(); viewDate.setHours(0, 0, 0, 0);
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function isToday(d) { return LOGIC.dateKey(d) === LOGIC.dateKey(today()); }

  // ============================================================
  // Toast
  // ============================================================
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ============================================================
  // Components
  // ============================================================
  function listSection({ header, footer, rows }) {
    return h('div', { class: 'list-section' },
      header && h('div', { class: 'list-header' }, header),
      h('div', { class: 'list-rows' }, rows),
      footer && h('div', { class: 'list-footer' }, footer)
    );
  }

  function listRow({ icon: iconName, iconBg, title, subtitle, accessory, onClick, rightInput, rightLabel, hasIcon }) {
    const leadingIcon = iconName
      ? h('div', { class: 'leading-icon ' + (iconBg || 'bg-gray') }, svg(iconName, { size: 18, strokeWidth: 2 }))
      : null;
    const text = h('div', { class: 'text' },
      h('div', { class: 'title' }, title),
      subtitle != null && h('div', { class: 'subtitle' }, subtitle)
    );
    const accy = h('div', { class: 'accessory' });
    if (rightLabel) accy.appendChild(h('span', null, rightLabel));
    if (rightInput) accy.appendChild(rightInput);
    if (accessory === 'chevron') accy.appendChild(svg('chevron.right', { size: 14, strokeWidth: 2.2, class: 'chevron' }));
    else if (accessory) accy.appendChild(typeof accessory === 'string' ? document.createTextNode(accessory) : accessory);
    return h('div', {
      class: 'list-row' + (onClick ? ' tappable' : '') + ((hasIcon || iconName) ? ' has-icon' : ''),
      onClick: onClick || null
    }, leadingIcon, text, accy);
  }

  function card(...children) {
    return h('div', { class: 'card' }, ...children);
  }

  function macroBar(name, value, goal, varColor) {
    const pct = Math.min(100, Math.round((value / Math.max(goal, 1)) * 100));
    return h('div', { class: 'macro-bar' },
      h('div', { class: 'label-row' },
        h('span', { class: 'name', style: { color: `var(${varColor})` } }, name),
        h('span', null, `${Math.round(value)}/${Math.round(goal)} g`)
      ),
      h('div', { class: 'track' },
        h('div', { class: 'fill', style: { width: pct + '%', background: `var(${varColor})` } })
      )
    );
  }

  function ring(value, goal, varColor) {
    const pct = Math.min(100, (value / Math.max(goal, 1)) * 100);
    const el = h('div', { class: 'ring', style: { '--pct': pct.toFixed(2), '--color': `var(${varColor})` } },
      h('div', { class: 'ring-inner' },
        h('div', { class: 'big' }, Math.round(value).toLocaleString()),
        h('div', { class: 'sub' }, '/ ' + Math.round(goal).toLocaleString() + ' kcal')
      )
    );
    return el;
  }

  function searchField({ placeholder, value, onInput }) {
    const input = h('input', { type: 'text', placeholder, value: value || '', oninput: e => onInput(e.target.value) });
    return h('div', { class: 'search-field' }, svg('magnifyingglass', { size: 17 }), input);
  }

  function chipRow(items, selectedId, onSelect) {
    return h('div', { class: 'chip-row' }, items.map(it =>
      h('button', { class: 'chip' + (it.id === selectedId ? ' active' : ''), onClick: () => onSelect(it.id) }, it.label)
    ));
  }

  function emptyState(iconName, title, sub) {
    return h('div', { class: 'empty' },
      svg(iconName, { size: 48, strokeWidth: 1.5 }),
      h('div', { style: { marginTop: '8px' } }, title),
      sub && h('div', { class: 'subtitle' }, sub)
    );
  }

  // ============================================================
  // Sheet system
  // ============================================================
  let sheetClose = null;
  function openSheet({ title, leading, trailing, body }) {
    closeSheet();
    const scrim = h('div', { class: 'scrim', onClick: closeSheet });
    const grabber = h('div', { class: 'sheet-grabber' });
    const header = h('div', { class: 'sheet-header' });
    if (leading) header.appendChild(h('div', { class: 'leading' }, leading));
    if (title) header.appendChild(h('div', { class: 'sheet-title' }, title));
    if (trailing) header.appendChild(h('div', { class: 'trailing' }, trailing));
    const content = h('div', { class: 'sheet-content' }, body);
    const sheet = h('div', { class: 'sheet' }, grabber, header, content);
    $('#phone').append(scrim, sheet);
    sheetClose = () => { scrim.remove(); sheet.remove(); sheetClose = null; };
  }
  function closeSheet() { if (sheetClose) sheetClose(); }

  // ============================================================
  // VIEWS
  // ============================================================
  function renderTabs(activeTab) {
    const tabs = [
      ['dashboard', 'house', 'house.fill', 'Today'],
      ['workouts',  'dumbbell', 'dumbbell.fill', 'Workouts'],
      ['nutrition', 'fork.knife', 'fork.knife.fill', 'Nutrition'],
      ['profile',   'person.crop.circle', 'person.crop.circle.fill', 'You']
    ];
    const bar = $('#tab-bar');
    bar.innerHTML = '';
    for (const [key, icOff, icOn, label] of tabs) {
      const btn = h('button', {
        class: 'tab-btn' + (activeTab === key ? ' active' : ''),
        onClick: () => navigate(key)
      },
        h('span', { html: icon(activeTab === key ? icOn : icOff, { size: 26, strokeWidth: 1.8 }) }),
        h('span', null, label)
      );
      bar.appendChild(btn);
    }
  }

  let currentTab = 'dashboard';
  function navigate(tab) {
    stopRestTimer();   // ephemeral overlays don't survive a tab switch
    currentTab = tab;
    rerender();
  }
  function rerender() {
    renderTabs(currentTab);
    const c = $('#content');
    c.innerHTML = '';
    c.scrollTop = 0;
    if (currentTab === 'dashboard')   c.appendChild(viewDashboard());
    else if (currentTab === 'workouts')   c.appendChild(viewWorkouts());
    else if (currentTab === 'active')     c.appendChild(viewActiveWorkout());
    else if (currentTab === 'nutrition')  c.appendChild(viewNutrition());
    else if (currentTab === 'profile')    c.appendChild(viewProfile());
    else if (currentTab === 'tests')      c.appendChild(viewTests());
  }

  // ----- Dashboard -----
  function viewDashboard() {
    const wrap = h('div');
    const day = today();
    const totals = LOGIC.totalsForDate(state.meals, LOGIC.dateKey(day));
    const g = state.goals;

    // Nav bar
    const streak = LOGIC.mealStreak(state.meals, day);
    const navBar = h('div', { class: 'nav-bar' },
      h('div', { class: 'nav-titlebar' },
        h('div', { class: 'leading' },
          streak > 0 ? h('span', {
            style: {
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '12px',
              background: 'var(--orange)', color: '#fff',
              font: '600 13px var(--font)'
            }
          }, '🔥', String(streak), 'd') : null
        ),
        h('div', { class: 'trailing' },
          h('button', { class: 'icon-btn', onClick: () => navigate('tests') }, svg('testtube.2', { size: 22, strokeWidth: 1.8 }))
        )
      ),
      h('h1', { class: 'nav-large-title' }, day.toLocaleDateString(undefined, { weekday: 'long' })),
      h('div', { class: 'nav-subtitle' }, day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }))
    );
    wrap.appendChild(navBar);

    // Energy + macros card
    wrap.appendChild(card(
      h('div', { class: 'row-flex', style: { gap: '20px' } },
        ring(totals.cal, g.calories, '--macro-calories'),
        h('div', { style: { flex: '1' } },
          macroBar('Protein', totals.p, g.protein, '--macro-protein'),
          macroBar('Carbs', totals.c, g.carbs, '--macro-carbs'),
          macroBar('Fat', totals.f, g.fat, '--macro-fat')
        )
      )
    ));

    // Today's workout
    const todayWk = state.workouts.find(w => isToday(new Date(w.startedAt)));
    if (todayWk) {
      const totalVol = LOGIC.totalVolume(todayWk.sets);
      wrap.appendChild(card(
        h('div', { class: 'row-flex' },
          h('div', { class: 'leading-icon bg-orange', style: { width: '32px', height: '32px' } }, svg('dumbbell.fill', { size: 18 })),
          h('div', { style: { flex: '1' } },
            h('div', { style: { font: '500 13px var(--font)', color: 'var(--label-secondary)' } }, "TODAY'S WORKOUT"),
            h('div', { style: { font: '600 17px var(--font)', marginTop: '2px' } }, todayWk.name || 'Workout'),
            h('div', { class: 'subtitle' }, `${todayWk.sets.length} sets · ${Math.round(totalVol).toLocaleString()} kg total volume`)
          )
        )
      ));
    } else {
      wrap.appendChild(card(
        h('button', { class: 'btn-primary', onClick: startNewWorkout },
          svg('play.fill', { size: 18 }),
          'Start a workout'
        )
      ));
    }

    // Apple Health card (mocked)
    wrap.appendChild(card(
      h('div', { class: 'card-header' },
        h('span', null, 'From Apple Health'),
        h('span', { style: { marginLeft: 'auto', font: '500 12px var(--font)', color: 'var(--label-tertiary)' } }, 'mocked')
      ),
      h('div', { class: 'row-flex', style: { gap: '24px' } },
        metricCell('flame.fill', '--orange', '412', 'active kcal'),
        metricCell('figure.walk', '--blue', '8,243', 'steps'),
        metricCell('heart.fill', '--red', '67', 'resting bpm')
      )
    ));

    // Body weight
    const latest = state.weights[state.weights.length - 1];
    wrap.appendChild(card(
      h('div', { class: 'card-header' },
        h('span', null, 'Body weight'),
        h('button', { class: 'btn-link', style: { marginLeft: 'auto' }, onClick: openWeightSheet }, 'Log')
      ),
      latest
        ? h('div', null,
            h('div', { style: { font: '700 28px var(--font)', fontVariantNumeric: 'tabular-nums' } }, latest.kg.toFixed(1) + ' kg'),
            h('div', { class: 'subtitle' }, 'Last logged ' + relativeDate(new Date(latest.recordedAt)))
          )
        : h('div', { class: 'muted' }, 'No weight logged yet')
    ));

    // Weight chart (if data)
    if (state.weights.length >= 5) {
      const points = state.weights.slice(-30).map(w => ({ x: new Date(w.recordedAt).getTime(), y: w.kg }));
      wrap.appendChild(weightChart(points));
    }

    // 7-day calorie trend
    const calorieDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(day);
      d.setDate(d.getDate() - i);
      const k = LOGIC.dateKey(d);
      const t = LOGIC.totalsForDate(state.meals, k);
      calorieDays.push({ x: d.getTime(), y: Math.round(t.cal) });
    }
    if (calorieDays.some(p => p.y > 0)) {
      wrap.appendChild(weeklyCalorieChart(calorieDays, state.goals.calories));
    }

    return wrap;
  }

  function weeklyCalorieChart(points, goal) {
    const w = 358 - 32, hpx = 160;
    const max = Math.max(goal, ...points.map(p => p.y)) * 1.1 + 1;
    const barW = (w - 14) / points.length - 6;
    let bars = '';
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = 8 + i * (barW + 6);
      const bh = Math.max(2, (p.y / max) * (hpx - 30));
      const y = hpx - 18 - bh;
      const colour = p.y > goal ? 'var(--red)'
                   : p.y > goal * 0.85 ? 'var(--green)'
                   : 'var(--orange)';
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" style="fill: ${colour}; opacity: 0.85"/>`;
      const label = new Date(p.x).toLocaleDateString(undefined, { weekday: 'narrow' });
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(hpx - 4).toFixed(1)}" text-anchor="middle" style="fill: var(--label-secondary); font: 10px var(--font);">${label}</text>`;
    }
    // Goal line
    const goalY = hpx - 18 - (goal / max) * (hpx - 30);
    bars += `<line x1="0" y1="${goalY.toFixed(1)}" x2="${w}" y2="${goalY.toFixed(1)}" stroke="var(--label-tertiary)" stroke-dasharray="4 4" stroke-width="1"/>`;
    bars += `<text x="${w - 4}" y="${(goalY - 4).toFixed(1)}" text-anchor="end" style="fill: var(--label-secondary); font: 10px var(--font);">goal ${goal}</text>`;

    const svgWrap = document.createElement('div');
    svgWrap.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${hpx}" preserveAspectRatio="none">${bars}</svg>`;
    const avg = Math.round(points.reduce((s, p) => s + p.y, 0) / Math.max(1, points.filter(p => p.y > 0).length));
    return h('div', { class: 'chart-card' },
      h('div', { class: 'chart-card-header' },
        h('span', { class: 'chart-card-title' }, 'Calories — last 7 days'),
        h('span', { class: 'chart-card-value' }, avg + ' avg / ' + goal + ' goal')
      ),
      svgWrap.firstChild
    );
  }

  function metricCell(iconName, colorVar, value, label) {
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { class: 'leading-icon', style: { width: '28px', height: '28px', background: `var(${colorVar})` } }, svg(iconName, { size: 16 })),
      h('div', null,
        h('div', { style: { font: '600 17px var(--font)', fontVariantNumeric: 'tabular-nums' } }, value),
        h('div', { class: 'subtitle' }, label)
      )
    );
  }

  function weightChart(points) {
    if (points.length === 0) return h('div');
    const w = 358 - 32, hpx = 140;
    const xMin = points[0].x, xMax = points[points.length - 1].x;
    const ys = points.map(p => p.y);
    const yMin = Math.min(...ys) - 0.5, yMax = Math.max(...ys) + 0.5;
    const sx = (x) => ((x - xMin) / Math.max(1, (xMax - xMin))) * (w - 20) + 10;
    const sy = (y) => hpx - ((y - yMin) / Math.max(0.1, (yMax - yMin))) * (hpx - 20) - 10;
    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.x).toFixed(1) + ',' + sy(p.y).toFixed(1)).join(' ');
    const areaPath = linePath + ` L${sx(points[points.length - 1].x).toFixed(1)},${hpx} L${sx(points[0].x).toFixed(1)},${hpx} Z`;
    // SVG must be parsed by HTML parser (not createElement) for namespace.
    const svgWrap = document.createElement('div');
    svgWrap.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${hpx}" preserveAspectRatio="none">
      <line class="axis" x1="0" y1="${hpx-1}" x2="${w}" y2="${hpx-1}"/>
      <path class="area" d="${areaPath}"/>
      <path class="line" d="${linePath}"/>
      ${points.slice(-1).map(p => `<circle class="point" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3"/>`).join('')}
    </svg>`;
    const trend = points.length >= 2 ? (points[points.length-1].y - points[0].y) : 0;
    return h('div', { class: 'chart-card' },
      h('div', { class: 'chart-card-header' },
        h('span', { class: 'chart-card-title' }, 'Weight trend'),
        h('span', { class: 'chart-card-value' }, (trend >= 0 ? '+' : '') + trend.toFixed(1) + ' kg · ' + points.length + ' d')
      ),
      svgWrap.firstChild
    );
  }

  // ----- Workouts -----
  function viewWorkouts() {
    const wrap = h('div');
    wrap.appendChild(h('div', { class: 'nav-bar' },
      h('h1', { class: 'nav-large-title' }, 'Workouts')
    ));

    wrap.appendChild(listSection({
      rows: [
        listRow({
          icon: 'play.fill', iconBg: 'bg-green',
          title: 'Start empty workout',
          accessory: 'chevron',
          onClick: startNewWorkout
        }),
        listRow({
          icon: 'list.bullet.rectangle.fill', iconBg: 'bg-blue',
          title: 'Routines',
          subtitle: state.routines.length + (state.routines.length === 1 ? ' saved' : ' saved'),
          accessory: 'chevron',
          onClick: openRoutinesPicker
        }),
        listRow({
          icon: 'dumbbell.fill', iconBg: 'bg-orange',
          title: 'Exercise library',
          accessory: 'chevron',
          onClick: openExerciseLibrary
        }),
        listRow({
          icon: 'chart.bar.fill', iconBg: 'bg-purple',
          title: 'Calendar',
          subtitle: 'See workouts + meals by day',
          accessory: 'chevron',
          onClick: openCalendar
        })
      ]
    }));

    const sorted = [...state.workouts].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    if (sorted.length === 0) {
      wrap.appendChild(emptyState('dumbbell', 'No workouts logged', 'Tap Start empty workout above to begin.'));
    } else {
      wrap.appendChild(listSection({
        header: 'History',
        rows: sorted.map(w => {
          const totalVol = LOGIC.totalVolume(w.sets);
          return listRow({
            icon: 'dumbbell.fill', iconBg: 'bg-orange',
            title: w.name || 'Workout',
            subtitle: new Date(w.startedAt).toLocaleDateString() + ' · ' + w.sets.length + ' sets · ' + Math.round(totalVol) + ' kg',
            accessory: 'chevron',
            onClick: () => openWorkoutDetail(w.id)
          });
        })
      }));
    }
    return wrap;
  }

  function startNewWorkout(seed) {
    // `seed` is an optional routine — pre-populates the new workout with one
    // empty set per exercise from the routine, in order.
    const w = {
      id: 'wk-' + Date.now(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      name: seed ? seed.name : '',
      sets: []
    };
    if (seed && Array.isArray(seed.exerciseIds)) {
      let ordinal = 0;
      for (const exId of seed.exerciseIds) {
        const ex = allExercises().find(e => e.id === exId);
        if (!ex) continue;
        w.sets.push({
          exerciseId: ex.id, exerciseName: ex.name,
          weight: 0, reps: 0, completed: false, isWarmup: false,
          ordinal: ordinal++, performedAt: new Date().toISOString()
        });
      }
    }
    state.workouts.push(w);
    state.activeWorkoutId = w.id;
    save();
    navigate('active');
  }

  function openRoutinesPicker() {
    function build() {
      const body = h('div');
      if (state.routines.length === 0) {
        body.appendChild(emptyState('list.bullet.rectangle', 'No routines yet',
          'Save the next workout you build as a routine to reuse it later.'));
      } else {
        body.appendChild(listSection({
          header: 'Your routines',
          rows: state.routines.map(r => listRow({
            icon: 'dumbbell.fill', iconBg: 'bg-orange',
            title: r.name || 'Routine',
            subtitle: (r.exerciseIds || []).length + ' exercises' + (r.notes ? ' · ' + r.notes : ''),
            accessory: 'chevron',
            onClick: () => {
              closeSheet();
              startNewWorkout(r);
            }
          }))
        }));
        body.appendChild(listSection({
          rows: state.routines.map(r => listRow({
            icon: 'trash', iconBg: 'bg-red',
            title: 'Delete: ' + (r.name || 'Routine'),
            onClick: () => {
              if (confirm('Delete routine \'' + (r.name || 'Routine') + '\'?')) {
                state.routines = state.routines.filter(x => x.id !== r.id);
                save(); replace();
              }
            }
          }))
        }));
      }
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Routines',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: build()
    });
  }

  function saveCurrentAsRoutine() {
    const w = getActiveWorkout();
    if (!w) return;
    const groups = LOGIC.groupSets(w.sets);
    if (groups.length === 0) {
      toast('Add at least one exercise');
      return;
    }
    const name = prompt('Routine name', w.name || 'New routine');
    if (!name) return;
    const routine = {
      id: 'r-' + Date.now(),
      name,
      exerciseIds: groups.map(g => g.id),
      notes: ''
    };
    state.routines.push(routine);
    save();
    toast('Saved routine');
  }

  function getActiveWorkout() {
    return state.workouts.find(w => w.id === state.activeWorkoutId);
  }

  function openWorkoutDetail(id) {
    const w = state.workouts.find(x => x.id === id);
    if (!w) return;
    const groups = LOGIC.groupSets(w.sets);
    openSheet({
      title: w.name || 'Workout',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      trailing: h('button', { class: 'btn-link destructive', onClick: () => {
        if (confirm('Delete this workout?')) {
          state.workouts = state.workouts.filter(x => x.id !== id);
          save(); closeSheet(); rerender();
          toast('Deleted');
        }
      } }, 'Delete'),
      body: [
        listSection({
          rows: [
            listRow({ title: 'Started', accessory: new Date(w.startedAt).toLocaleString() }),
            w.endedAt ? listRow({ title: 'Ended', accessory: new Date(w.endedAt).toLocaleTimeString() }) : null,
            listRow({ title: 'Total volume', accessory: Math.round(LOGIC.totalVolume(w.sets)) + ' kg' })
          ].filter(Boolean)
        }),
        ...groups.map(g => listSection({
          header: g.name,
          rows: [
            listRow({
              title: 'View progression',
              icon: 'chart.line.uptrend.xyaxis', iconBg: 'bg-purple',
              accessory: 'chevron',
              onClick: () => { closeSheet(); openExerciseProgression(g.id, g.name); }
            }),
            ...g.sets.map((s, i) => listRow({
              title: 'Set ' + (i + 1) + (s.isWarmup ? ' (warmup)' : ''),
              accessory: `${s.weight || 0} kg × ${s.reps || 0}`
            }))
          ]
        }))
      ]
    });
  }

  // ----- Per-exercise progression -----
  function openExerciseProgression(exerciseId, exerciseName) {
    const allSets = state.workouts.flatMap(w => w.sets.map(s => ({ ...s, id: setKey(s) })));
    const exerciseSets = allSets.filter(s => s.exerciseId === exerciseId);
    const completed = exerciseSets.filter(s => s.completed && !s.isWarmup);

    // 1RM per session
    const oneRmPoints = LOGIC.bestPerSession(completed.map(s => ({ ...s }))).map(p => ({
      x: new Date(p.date).getTime(), y: p.oneRm
    }));

    // Volume per session
    const volByDay = new Map();
    for (const s of completed) {
      const day = LOGIC.dateKey(new Date(s.performedAt));
      volByDay.set(day, (volByDay.get(day) || 0) + (s.weight || 0) * (s.reps || 0));
    }
    const volPoints = [...volByDay.entries()]
      .sort()
      .map(([d, v]) => ({ x: new Date(d).getTime(), y: v }));

    const prSet = LOGIC.detectPRs(allSets);

    openSheet({
      title: exerciseName,
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: (() => {
        const body = h('div');
        if (completed.length === 0) {
          body.appendChild(emptyState('chart.line.uptrend.xyaxis',
            'No completed sets yet',
            'Log a few sessions to see your progress.'));
          return body;
        }
        // Charts
        if (oneRmPoints.length >= 2) body.appendChild(progressChart('Estimated 1RM', oneRmPoints, 'kg', 'var(--blue)'));
        if (volPoints.length >= 2)   body.appendChild(progressChart('Total volume', volPoints, 'kg', 'var(--orange)'));
        // Best lift
        const heaviest = completed.reduce((b, s) => (s.weight > (b?.weight || 0) ? s : b), null);
        if (heaviest) {
          body.appendChild(listSection({
            header: 'Personal records',
            rows: [
              listRow({ title: 'Heaviest', accessory: heaviest.weight + ' kg × ' + heaviest.reps }),
              listRow({ title: 'Best 1RM', accessory: Math.round(LOGIC.estimate1RM(heaviest.weight, heaviest.reps) * 10) / 10 + ' kg' }),
              listRow({ title: 'Total sessions', accessory: String(volByDay.size) }),
              listRow({ title: 'Total volume', accessory: Math.round([...volByDay.values()].reduce((a, b) => a + b, 0)).toLocaleString() + ' kg' })
            ]
          }));
        }
        // Session list
        const sessions = [...volByDay.entries()].sort().reverse();
        body.appendChild(listSection({
          header: 'History',
          rows: sessions.map(([day, vol]) => {
            const daySets = completed.filter(s => LOGIC.dateKey(new Date(s.performedAt)) === day);
            const best = daySets.reduce((b, s) => (s.weight > (b?.weight || 0) ? s : b), null);
            const isPR = best && prSet.has(best.id);
            return listRow({
              title: new Date(day).toLocaleDateString(),
              subtitle: best ? `Top: ${best.weight} kg × ${best.reps}${isPR ? ' ★ PR' : ''}` : '',
              accessory: Math.round(vol) + ' kg'
            });
          })
        }));
        return body;
      })()
    });
  }

  function progressChart(title, points, unit, color) {
    if (points.length === 0) return h('div');
    const w = 358 - 32, hpx = 140;
    const xMin = points[0].x, xMax = points[points.length - 1].x;
    const ys = points.map(p => p.y);
    const yMin = Math.min(...ys) * 0.95, yMax = Math.max(...ys) * 1.05;
    const sx = (x) => ((x - xMin) / Math.max(1, (xMax - xMin))) * (w - 20) + 10;
    const sy = (y) => hpx - ((y - yMin) / Math.max(0.1, (yMax - yMin))) * (hpx - 20) - 10;
    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + sx(p.x).toFixed(1) + ',' + sy(p.y).toFixed(1)).join(' ');
    const areaPath = linePath + ` L${sx(points[points.length - 1].x).toFixed(1)},${hpx} L${sx(points[0].x).toFixed(1)},${hpx} Z`;
    const svgWrap = document.createElement('div');
    svgWrap.innerHTML = `<svg class="chart-svg" viewBox="0 0 ${w} ${hpx}" preserveAspectRatio="none">
      <line class="axis" x1="0" y1="${hpx-1}" x2="${w}" y2="${hpx-1}"/>
      <path d="${areaPath}" style="fill:${color}; opacity:0.12"/>
      <path d="${linePath}" style="fill:none; stroke:${color}; stroke-width:2; stroke-linejoin:round; stroke-linecap:round"/>
      ${points.slice(-1).map(p => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" style="fill:${color}"/>`).join('')}
    </svg>`;
    const last = points[points.length - 1].y;
    const first = points[0].y;
    const delta = last - first;
    return h('div', { class: 'chart-card' },
      h('div', { class: 'chart-card-header' },
        h('span', { class: 'chart-card-title' }, title),
        h('span', { class: 'chart-card-value' }, (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' ' + unit + ' · ' + points.length + ' sessions')
      ),
      svgWrap.firstChild
    );
  }

  // ----- Calendar / history view -----
  function openCalendar() {
    let viewMonth = new Date();
    viewMonth.setDate(1); viewMonth.setHours(0,0,0,0);
    function build() {
      const body = h('div');
      const monthName = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      // Header
      body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', padding: '0 16px 8px', gap: '8px' } },
        h('button', { class: 'icon-btn', onClick: () => { viewMonth = new Date(viewMonth); viewMonth.setMonth(viewMonth.getMonth()-1); replace(); } }, svg('chevron.left', { size: 18, strokeWidth: 2.5 })),
        h('div', { style: { flex: '1', textAlign: 'center', font: '600 17px var(--font)' } }, monthName),
        h('button', { class: 'icon-btn', onClick: () => { viewMonth = new Date(viewMonth); viewMonth.setMonth(viewMonth.getMonth()+1); replace(); } }, svg('chevron.right', { size: 18, strokeWidth: 2.5 }))
      ));
      // Day-of-week header
      const dows = ['M','T','W','T','F','S','S'];
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', padding: '0 16px' } });
      for (const d of dows) grid.appendChild(h('div', { style: { textAlign: 'center', font: '500 11px var(--font)', color: 'var(--label-secondary)', padding: '4px 0' } }, d));
      const firstDay = new Date(viewMonth);
      const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
      // Monday-first leading blanks
      let leading = (firstDay.getDay() + 6) % 7;
      for (let i = 0; i < leading; i++) grid.appendChild(h('div'));
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
        const key = LOGIC.dateKey(date);
        const wkCount = state.workouts.filter(w => LOGIC.dateKey(new Date(w.startedAt)) === key).length;
        const slots = state.meals[key] || {};
        const mealCount = ['breakfast','lunch','dinner','snack'].filter(s => (slots[s]||[]).length > 0).length;
        const cell = h('button', {
          style: {
            appearance: 'none', border: 0, padding: 0, cursor: 'pointer',
            background: isSameDay(date, today()) ? 'var(--tint)' : 'var(--fill-tertiary)',
            color: isSameDay(date, today()) ? '#fff' : 'var(--label-primary)',
            borderRadius: '8px',
            aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            font: '500 14px var(--font)', position: 'relative'
          },
          onClick: () => openDayDetail(key)
        }, String(d));
        // Activity dots
        if (wkCount > 0 || mealCount > 0) {
          const dots = h('div', { style: { display: 'flex', gap: '2px', marginTop: '2px' } });
          if (wkCount > 0) dots.appendChild(h('span', { style: { width: '4px', height: '4px', borderRadius: '50%', background: 'var(--orange)' } }));
          if (mealCount > 0) dots.appendChild(h('span', { style: { width: '4px', height: '4px', borderRadius: '50%', background: 'var(--green)' } }));
          cell.appendChild(dots);
        }
        grid.appendChild(cell);
      }
      body.appendChild(grid);
      // Legend
      body.appendChild(h('div', { style: { display: 'flex', gap: '16px', padding: '12px 16px 0', font: '500 12px var(--font)', color: 'var(--label-secondary)' } },
        h('span', null,
          h('span', { style: { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--orange)', marginRight: '6px' } }),
          'workout'
        ),
        h('span', null,
          h('span', { style: { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginRight: '6px' } }),
          'meals'
        )
      ));
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Calendar',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: build()
    });
  }
  function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function openDayDetail(key) {
    const wks = state.workouts.filter(w => LOGIC.dateKey(new Date(w.startedAt)) === key);
    const slots = state.meals[key] || {};
    const totals = LOGIC.totalsForDate(state.meals, key);
    const date = new Date(key + 'T12:00:00');
    const body = h('div');
    body.appendChild(listSection({
      header: 'Nutrition',
      rows: [
        listRow({ title: 'Calories', accessory: Math.round(totals.cal) + ' kcal' }),
        listRow({ title: 'Protein',  accessory: Math.round(totals.p) + ' g' }),
        listRow({ title: 'Carbs',    accessory: Math.round(totals.c) + ' g' }),
        listRow({ title: 'Fat',      accessory: Math.round(totals.f) + ' g' })
      ]
    }));
    if (wks.length > 0) {
      body.appendChild(listSection({
        header: 'Workouts',
        rows: wks.map(w => listRow({
          icon: 'dumbbell.fill', iconBg: 'bg-orange',
          title: w.name || 'Workout',
          subtitle: w.sets.length + ' sets · ' + Math.round(LOGIC.totalVolume(w.sets)) + ' kg',
          accessory: 'chevron',
          onClick: () => { closeSheet(); openWorkoutDetail(w.id); }
        }))
      }));
    } else {
      body.appendChild(emptyState('dumbbell', 'No workouts that day'));
    }
    openSheet({
      title: date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
      leading: h('button', { class: 'btn-link', onClick: () => { closeSheet(); openCalendar(); } }, '‹ Calendar'),
      body
    });
  }

  function openExerciseLibrary() {
    let q = '';
    let muscle = 'all';
    function rebuild() {
      const muscles = ['all', ...new Set(EXERCISES.map(e => e.muscle))];
      const filtered = EXERCISES.filter(e =>
        (muscle === 'all' || e.muscle === muscle) &&
        (!q || e.name.toLowerCase().includes(q.toLowerCase()))
      );
      const body = h('div');
      body.appendChild(searchField({ placeholder: 'Search exercises', value: q, onInput: v => { q = v; replace(); } }));
      body.appendChild(chipRow(muscles.map(m => ({ id: m, label: m === 'all' ? 'All' : capitalize(m) })), muscle, m => { muscle = m; replace(); }));
      if (filtered.length === 0) {
        body.appendChild(emptyState('magnifyingglass', 'No exercises match'));
      } else {
        body.appendChild(listSection({
          rows: filtered.map(e => listRow({
            title: e.name, subtitle: capitalize(e.muscle) + ' · ' + capitalize(e.equipment),
            accessory: 'chevron'
          }))
        }));
      }
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(rebuild()); }
    }
    openSheet({
      title: 'Exercises',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: rebuild()
    });
  }

  // ----- Active workout view -----
  let activeTimer = null;
  function viewActiveWorkout() {
    const w = getActiveWorkout();
    if (!w) { setTimeout(() => navigate('workouts'), 0); return h('div'); }
    const wrap = h('div');
    wrap.appendChild(h('div', { class: 'nav-bar' },
      h('div', { class: 'nav-titlebar' },
        h('div', { class: 'leading' },
          h('button', { class: 'btn-link', onClick: () => { stopTimer(); navigate('workouts'); } }, svg('chevron.left', { size: 17, strokeWidth: 2.5 }), 'Workouts')
        ),
        h('div', { class: 'trailing' },
          h('button', { class: 'btn-link', onClick: saveCurrentAsRoutine }, 'Save as routine'),
          h('button', { class: 'btn-link bold', onClick: finishActive }, 'Finish')
        )
      )
    ));

    // Header card
    const nameInput = h('input', { type: 'text', class: 'row-input', value: w.name, placeholder: 'Workout name', style: { textAlign: 'left', width: '100%' } });
    nameInput.addEventListener('input', () => { w.name = nameInput.value; save(); });
    wrap.appendChild(card(
      nameInput,
      h('div', { class: 'row-flex', style: { marginTop: '8px' } },
        svg('clock', { size: 16, strokeWidth: 2 }),
        h('span', { id: 'active-elapsed', class: 'numeric subtitle', style: { marginLeft: '4px' } }, '00:00:00'),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn-link', onClick: openPlateCalc }, 'Plate calc')
      )
    ));

    // Groups
    const groups = LOGIC.groupSets(w.sets);
    for (const g of groups) {
      wrap.appendChild(renderActiveGroup(w, g));
    }

    // Add exercise
    wrap.appendChild(h('div', { style: { padding: '0 16px' } },
      h('button', { class: 'btn-secondary', onClick: openExercisePicker },
        svg('plus', { size: 18, strokeWidth: 2.4 }),
        'Add exercise'
      )
    ));

    // Empty-state hint when no exercises picked yet
    if (groups.length === 0) {
      wrap.appendChild(h('div', { class: 'empty', style: { paddingTop: '24px' } },
        svg('dumbbell', { size: 48, strokeWidth: 1.5 }),
        h('div', { style: { marginTop: '8px' } }, 'No exercises yet'),
        h('div', { class: 'subtitle' }, 'Tap Add exercise to start logging sets.')
      ));
    }

    // Start timer
    stopTimer();
    activeTimer = setInterval(() => {
      const elapsed = $('#active-elapsed');
      if (!elapsed) { stopTimer(); return; }
      const sec = Math.floor((Date.now() - new Date(w.startedAt).getTime()) / 1000);
      const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      elapsed.textContent = `${hh}:${mm}:${ss}`;
    }, 1000);

    return wrap;
  }
  function stopTimer() { if (activeTimer) { clearInterval(activeTimer); activeTimer = null; } }

  function setKey(s) { return s.id || `${s.exerciseId}:${s.performedAt}`; }
  function activePRSet() {
    const all = state.workouts.flatMap(w => w.sets.map(s => ({ ...s, id: setKey(s) })));
    return LOGIC.detectPRs(all);
  }

  function renderActiveGroup(w, g) {
    const c = h('div', { class: 'workout-group' });
    c.appendChild(h('div', { class: 'workout-group-header' },
      h('div', { class: 'workout-group-name' }, g.name),
      h('span', { class: 'workout-group-pill' }, g.sets.length + ' sets')
    ));
    const prs = activePRSet();
    g.sets.forEach((s, i) => c.appendChild(setRow(w, s, i + 1, prs.has(setKey(s)))));
    c.appendChild(h('button', {
      class: 'btn-link', style: { marginTop: '4px' },
      onClick: () => addSetTo(w, g)
    }, svg('plus', { size: 16, strokeWidth: 2.4 }), 'Add set'));
    return c;
  }

  function setRow(w, s, n, isPR) {
    const row = h('div', { class: 'set-row' });
    const numClass = 'set-num' + (s.completed ? ' done' : '') + (s.isWarmup ? ' warmup' : '');
    const label = s.isWarmup ? 'W' : String(n);
    const numEl = h('div', { class: numClass, onClick: () => {
      // Tap the number to toggle warmup
      s.isWarmup = !s.isWarmup;
      save(); rerender();
    } }, label);
    row.appendChild(numEl);

    const weightInput = h('input', { type: 'number', step: '0.5', value: s.weight || 0, inputmode: 'decimal' });
    weightInput.addEventListener('input', () => { s.weight = parseFloat(weightInput.value) || 0; save(); });
    row.appendChild(h('div', { class: 'input-pill' },
      weightInput, h('span', { class: 'unit' }, 'kg')
    ));

    const repsInput = h('input', { type: 'number', value: s.reps || 0, inputmode: 'numeric' });
    repsInput.addEventListener('input', () => { s.reps = parseInt(repsInput.value) || 0; save(); });
    row.appendChild(h('div', { class: 'input-pill' },
      repsInput, h('span', { class: 'unit' }, 'reps')
    ));

    const checkBtn = h('button', { class: 'check-btn' + (s.completed ? ' done' : ''), onClick: () => {
      s.completed = !s.completed;
      s.performedAt = new Date().toISOString();
      if (!s.id) s.id = 'set-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      save();
      // Re-render for PR badge update
      rerender();
      if (s.completed) startRestTimer(90);
    } }, svg('checkmark', { size: 16, strokeWidth: 3 }));
    row.appendChild(checkBtn);
    if (isPR) {
      // PR star — overlaid as a small badge top-right of the set number
      numEl.style.position = 'relative';
      numEl.appendChild(h('span', {
        style: {
          position: 'absolute', top: '-6px', right: '-6px',
          width: '16px', height: '16px',
          background: 'var(--yellow)', color: '#111',
          font: '700 10px var(--font)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', boxShadow: '0 0 0 1.5px var(--bg-grouped-content)'
        }
      }, '★'));
    }
    return row;
  }

  function addSetTo(w, g) {
    const last = g.sets[g.sets.length - 1] || {};
    const exercise = EXERCISES.find(e => e.id === g.id) || { id: g.id, name: g.name };
    w.sets.push({
      exerciseId: exercise.id, exerciseName: exercise.name,
      weight: last.weight || 0, reps: last.reps || 0,
      completed: false, ordinal: w.sets.length, performedAt: new Date().toISOString()
    });
    save();
    rerender();
  }

  function finishActive() {
    const w = getActiveWorkout();
    if (!w) { navigate('workouts'); return; }
    w.endedAt = new Date().toISOString();
    state.activeWorkoutId = null;
    save();
    stopTimer();
    toast('Workout saved');
    navigate('workouts');
  }

  function allExercises() {
    return [...EXERCISES, ...state.customExercises];
  }
  function openExercisePicker() {
    let q = '';
    let muscle = 'all';
    function rebuild() {
      const all = allExercises();
      const muscles = ['all', ...new Set(all.map(e => e.muscle))];
      const filtered = all.filter(e =>
        (muscle === 'all' || e.muscle === muscle) &&
        (!q || e.name.toLowerCase().includes(q.toLowerCase()))
      );
      const body = h('div');
      // Action row: create custom exercise
      body.appendChild(h('div', { class: 'list-section' },
        h('div', { class: 'list-rows' },
          listRow({
            icon: 'plus', iconBg: 'bg-purple',
            title: 'Create custom exercise',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openCustomExerciseEditor(); }
          })
        )
      ));
      body.appendChild(searchField({ placeholder: 'Search', value: q, onInput: v => { q = v; replace(); } }));
      body.appendChild(chipRow(muscles.map(m => ({ id: m, label: m === 'all' ? 'All' : capitalize(m) })), muscle, m => { muscle = m; replace(); }));
      if (filtered.length === 0) body.appendChild(emptyState('magnifyingglass', 'No exercises match'));
      else body.appendChild(listSection({
        rows: filtered.map(e => listRow({
          title: e.name + (e.isCustom ? ' (custom)' : ''),
          subtitle: capitalize(e.muscle) + ' · ' + capitalize(e.equipment),
          accessory: 'chevron',
          onClick: () => {
            const w = getActiveWorkout(); if (!w) return;
            w.sets.push({
              exerciseId: e.id, exerciseName: e.name,
              weight: 0, reps: 0, completed: false, isWarmup: false,
              ordinal: w.sets.length, performedAt: new Date().toISOString()
            });
            save(); closeSheet(); rerender();
          }
        }))
      }));
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(rebuild()); }
    }
    openSheet({
      title: 'Pick exercise',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: rebuild()
    });
  }

  function openCustomExerciseEditor() {
    const muscles = ['quads','hamstrings','glutes','calves','chest','back','shoulders','traps','biceps','triceps','core','obliques','fullBody'];
    const equipment = ['barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other'];
    let name = '', muscle = muscles[0], eq = equipment[0], mechanic = 'compound';
    function build() {
      const body = h('div');
      body.appendChild(listSection({
        header: 'Exercise',
        rows: [
          listRow({
            title: 'Name',
            rightInput: (() => {
              const i = h('input', { type: 'text', class: 'row-input', placeholder: 'e.g., Goblet Squat 2.0' });
              i.style.textAlign = 'right';
              i.addEventListener('input', () => name = i.value);
              return i;
            })()
          })
        ]
      }));
      body.appendChild(listSection({
        header: 'Primary muscle',
        rows: muscles.map(m => listRow({
          title: capitalize(m),
          accessory: m === muscle ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
          onClick: () => { muscle = m; replace(); }
        }))
      }));
      body.appendChild(listSection({
        header: 'Equipment',
        rows: equipment.map(e => listRow({
          title: capitalize(e),
          accessory: e === eq ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
          onClick: () => { eq = e; replace(); }
        }))
      }));
      body.appendChild(listSection({
        header: 'Mechanic',
        rows: [
          listRow({
            title: 'Compound',
            accessory: mechanic === 'compound' ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
            onClick: () => { mechanic = 'compound'; replace(); }
          }),
          listRow({
            title: 'Isolation',
            accessory: mechanic === 'isolation' ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
            onClick: () => { mechanic = 'isolation'; replace(); }
          })
        ]
      }));
      body.appendChild(h('div', { style: { padding: '0 16px', marginTop: '8px' } },
        h('button', { class: 'btn-primary', onClick: () => {
          if (!name) return toast('Name required');
          state.customExercises.push({
            id: 'cex-' + Date.now(),
            name, muscle, equipment: eq, mechanic, category: 'strength', isCustom: true
          });
          save(); closeSheet();
          toast('Exercise saved');
          openExercisePicker();
        } }, 'Save')
      ));
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'New exercise',
      leading: h('button', { class: 'btn-link', onClick: () => { closeSheet(); openExercisePicker(); } }, 'Cancel'),
      body: build()
    });
  }

  function openPlateCalc() {
    let target = 100, bar = 20;
    function build() {
      const ps = LOGIC.platesPerSide(target, bar);
      const body = h('div');
      body.appendChild(listSection({
        header: 'Inputs',
        rows: [
          listRow({
            title: 'Target weight',
            rightInput: numericInput(target, v => { target = v; replace(); }, 'kg')
          }),
          listRow({
            title: 'Bar weight',
            rightInput: numericInput(bar, v => { bar = v; replace(); }, 'kg')
          })
        ]
      }));
      if (ps.length > 0) {
        body.appendChild(listSection({
          header: 'Per side',
          rows: ps.map(p => listRow({
            title: p.plate + ' kg',
            accessory: '× ' + p.count
          }))
        }));
      } else {
        body.appendChild(emptyState('info.circle', 'No plates needed', 'Bar is heavy enough already.'));
      }
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Plate calculator',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Done'),
      body: build()
    });
  }

  function numericInput(value, onChange, unit) {
    const wrap = h('div', { class: 'row-flex', style: { gap: '6px' } });
    const input = h('input', {
      type: 'number', class: 'row-input', value: value, inputmode: 'decimal', step: '0.5'
    });
    input.addEventListener('input', () => onChange(parseFloat(input.value) || 0));
    wrap.appendChild(input);
    if (unit) wrap.appendChild(h('span', { class: 'subtitle' }, unit));
    return wrap;
  }

  // ----- Nutrition -----
  function viewNutrition() {
    const wrap = h('div');
    const key = LOGIC.dateKey(viewDate);
    const totals = LOGIC.totalsForDate(state.meals, key);
    const g = state.goals;

    wrap.appendChild(h('div', { class: 'nav-bar' },
      h('div', { class: 'nav-titlebar' },
        h('div', { class: 'leading' },
          h('button', { class: 'icon-btn', onClick: () => { viewDate = new Date(viewDate); viewDate.setDate(viewDate.getDate() - 1); rerender(); } }, svg('chevron.left', { size: 18, strokeWidth: 2.5 }))
        ),
        h('div', { class: 'trailing' },
          h('button', { class: 'icon-btn', onClick: () => { const d = new Date(viewDate); d.setDate(d.getDate() + 1); if (d <= today()) { viewDate = d; rerender(); } else { toast("Can't log future"); } } }, svg('chevron.right', { size: 18, strokeWidth: 2.5 }))
        )
      ),
      h('h1', { class: 'nav-large-title' },
        isToday(viewDate) ? 'Today' :
        LOGIC.dateKey(viewDate) === LOGIC.dateKey(addDays(today(), -1)) ? 'Yesterday' :
        viewDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      )
    ));

    // Daily totals card — net of cardio burned (MyFitnessPal style)
    const cardioToday = LOGIC.cardioTotalForDate(state.cardio, key);
    const netConsumed = totals.cal;
    const adjustedGoal = g.calories + cardioToday;
    const left = Math.max(0, Math.round(adjustedGoal - netConsumed));
    wrap.appendChild(card(
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '6px' } },
        h('span', { style: { font: '700 36px var(--font)', fontVariantNumeric: 'tabular-nums' } }, Math.round(netConsumed).toLocaleString()),
        h('span', { class: 'subtitle' }, '/ ' + adjustedGoal.toLocaleString() + ' kcal'),
        h('span', { style: { marginLeft: 'auto', fontWeight: '500', color: 'var(--label-secondary)' } }, left + ' left')
      ),
      cardioToday > 0
        ? h('div', { class: 'subtitle', style: { marginTop: '2px' } }, '+' + Math.round(cardioToday) + ' kcal from cardio')
        : null,
      h('div', { style: { marginTop: '8px' } },
        macroBar('Protein', totals.p, g.protein, '--macro-protein'),
        macroBar('Carbs', totals.c, g.carbs, '--macro-carbs'),
        macroBar('Fat', totals.f, g.fat, '--macro-fat')
      )
    ));

    // Water card
    wrap.appendChild(waterCard(key));

    // Cardio card (above meal cards)
    wrap.appendChild(cardioCard(key));

    // Meals
    const meals = state.meals[key] || {};
    const slots = [
      ['breakfast', 'Breakfast', 'sun.max.fill', 'bg-yellow'],
      ['lunch', 'Lunch', 'flame.fill', 'bg-orange'],
      ['dinner', 'Dinner', 'moon.fill', 'bg-indigo'],
      ['snack', 'Snacks', 'fork.knife.fill', 'bg-green']
    ];
    for (const [key2, label, ic, ic_bg] of slots) {
      const items = meals[key2] || [];
      const cal = items.reduce((s, e) => s + e.cal, 0);
      const c = h('div', { class: 'meal-card' });
      c.appendChild(h('div', { class: 'meal-card-header' },
        h('div', { class: 'meal-card-icon ' + ic_bg }, svg(ic, { size: 16 })),
        h('div', { class: 'meal-card-title' }, label),
        items.length > 0 && h('div', { class: 'meal-card-cal' }, Math.round(cal) + ' kcal'),
        items.length > 0 ? h('button', {
          class: 'icon-btn', style: { padding: '4px', fontSize: '18px', lineHeight: '1' },
          onClick: () => saveMealAsTemplate(key2, key)
        }, '🔖') : null,
        h('button', { class: 'meal-card-add', onClick: () => openFoodSearch(key2) }, svg('plus', { size: 14, strokeWidth: 2.6 }))
      ));
      if (items.length === 0) {
        c.appendChild(h('div', { class: 'subtitle', style: { padding: '8px 0' } }, 'Empty'));
      } else {
        items.forEach((entry, i) => {
          c.appendChild(h('div', { class: 'food-entry' },
            h('div', { class: 'text' },
              h('div', { class: 'title' }, entry.foodName),
              h('div', { class: 'subtitle' }, Math.round(entry.grams) + ' g · ' + Math.round(entry.cal) + ' kcal · P ' + Math.round(entry.p) + ' / C ' + Math.round(entry.c) + ' / F ' + Math.round(entry.fat))
            ),
            h('button', { class: 'delete-btn', onClick: () => {
              meals[key2].splice(i, 1); save(); rerender();
            } }, svg('xmark', { size: 16, strokeWidth: 2.5 }))
          ));
        });
      }
      wrap.appendChild(c);
    }
    return wrap;
  }

  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

  // ----- Water card -----
  const WATER_GLASS_ML = 250;
  function waterCard(dateKey) {
    const total = LOGIC.waterTotalForDate(state.waterLog, dateKey);
    const goal = state.goals.waterMl || 2500;
    const glasses = Math.round(total / WATER_GLASS_ML);
    const goalGlasses = Math.max(1, Math.round(goal / WATER_GLASS_ML));
    const c = h('div', { class: 'meal-card' });
    c.appendChild(h('div', { class: 'meal-card-header' },
      h('div', { class: 'meal-card-icon bg-blue' }, svg('flame.fill', { size: 16 })),  // placeholder droplet
      h('div', { class: 'meal-card-title' }, 'Water'),
      h('div', { class: 'meal-card-cal' }, Math.round(total) + ' / ' + goal + ' ml'),
      h('button', { class: 'meal-card-add', onClick: () => addWater(dateKey, WATER_GLASS_ML) }, svg('plus', { size: 14, strokeWidth: 2.6 }))
    ));
    // Cup row: filled / unfilled circles
    const row = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' } });
    for (let i = 0; i < goalGlasses; i++) {
      const filled = i < glasses;
      row.appendChild(h('button', {
        style: {
          width: '32px', height: '40px',
          appearance: 'none', border: 0, padding: 0, cursor: 'pointer',
          borderRadius: '6px',
          background: filled ? 'var(--blue)' : 'var(--fill-tertiary)',
          color: filled ? '#fff' : 'var(--label-secondary)',
          font: '600 12px var(--font)'
        },
        onClick: () => setWaterGlasses(dateKey, i + 1)
      }, '💧'));
    }
    c.appendChild(row);
    if (glasses > 0) {
      c.appendChild(h('button', {
        class: 'btn-link', style: { marginTop: '4px', padding: '4px 0', color: 'var(--red)' },
        onClick: () => removeLastWater(dateKey)
      }, 'Remove last'));
    }
    return c;
  }
  function addWater(dateKey, ml) {
    state.waterLog[dateKey] = state.waterLog[dateKey] || [];
    state.waterLog[dateKey].push({ ml, at: new Date().toISOString() });
    save(); rerender();
    toast('+' + ml + ' ml water');
  }
  function setWaterGlasses(dateKey, n) {
    state.waterLog[dateKey] = [];
    for (let i = 0; i < n; i++) {
      state.waterLog[dateKey].push({ ml: WATER_GLASS_ML, at: new Date().toISOString() });
    }
    save(); rerender();
  }
  function removeLastWater(dateKey) {
    const arr = state.waterLog[dateKey] || [];
    if (arr.length === 0) return;
    arr.pop(); save(); rerender();
  }

  // ----- Cardio card -----
  function cardioCard(dateKey) {
    const entries = state.cardio[dateKey] || [];
    const total = LOGIC.cardioTotalForDate(state.cardio, dateKey);
    const c = h('div', { class: 'meal-card' });
    c.appendChild(h('div', { class: 'meal-card-header' },
      h('div', { class: 'meal-card-icon bg-orange' }, svg('flame.fill', { size: 16 })),
      h('div', { class: 'meal-card-title' }, 'Cardio'),
      entries.length > 0
        ? h('div', { class: 'meal-card-cal' }, '+' + Math.round(total) + ' kcal')
        : null,
      h('button', { class: 'meal-card-add', onClick: () => openCardioSheet(dateKey) }, svg('plus', { size: 14, strokeWidth: 2.6 }))
    ));
    if (entries.length === 0) {
      c.appendChild(h('div', { class: 'subtitle', style: { padding: '8px 0' } }, 'No cardio logged'));
    } else {
      entries.forEach((e, i) => {
        c.appendChild(h('div', { class: 'food-entry' },
          h('div', { class: 'text' },
            h('div', { class: 'title' }, e.type),
            h('div', { class: 'subtitle' }, e.minutes + ' min · +' + Math.round(e.kcal) + ' kcal')
          ),
          h('button', { class: 'delete-btn', onClick: () => {
            entries.splice(i, 1); save(); rerender();
          } }, svg('xmark', { size: 16, strokeWidth: 2.5 }))
        ));
      });
    }
    return c;
  }
  function openCardioSheet(dateKey) {
    const types = ['Running', 'Cycling', 'Swimming', 'Walking', 'Hiking', 'Rowing', 'Elliptical', 'HIIT', 'Other'];
    let type = types[0];
    let minutes = 30;
    let kcal = 300;
    function build() {
      const body = h('div');
      body.appendChild(listSection({
        header: 'Activity',
        rows: types.map(t => listRow({
          title: t,
          accessory: t === type ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
          onClick: () => { type = t; replace(); }
        }))
      }));
      body.appendChild(listSection({
        header: 'Details',
        rows: [
          listRow({ title: 'Duration', rightInput: numericInput(minutes, v => { minutes = v; replace(); }, 'min') }),
          listRow({ title: 'Calories burned', rightInput: numericInput(kcal, v => { kcal = v; }, 'kcal') })
        ],
        footer: 'These calories are added to your daily calorie budget.'
      }));
      body.appendChild(h('div', { style: { padding: '0 16px', marginTop: '8px' } },
        h('button', { class: 'btn-primary', onClick: () => {
          state.cardio[dateKey] = state.cardio[dateKey] || [];
          state.cardio[dateKey].push({
            id: 'cardio-' + Date.now(),
            type, minutes: minutes || 0, kcal: kcal || 0,
            at: new Date().toISOString()
          });
          save(); closeSheet(); rerender();
          toast('+' + Math.round(kcal) + ' kcal cardio');
        } }, 'Save')
      ));
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Log cardio',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: build()
    });
  }

  function openFoodSearch(slot) {
    let q = '';
    function foodById(id) {
      return [...FOODS, ...state.customFoods].find(f => f.id === id);
    }
    function favouriteToggle(id) {
      const i = state.favouriteFoodIds.indexOf(id);
      if (i >= 0) state.favouriteFoodIds.splice(i, 1);
      else state.favouriteFoodIds.unshift(id);
      save();
    }
    function build() {
      const body = h('div');
      // Action row: scan / quick-add / custom food / recipes / saved meals
      body.appendChild(h('div', { class: 'list-section' },
        h('div', { class: 'list-rows' },
          listRow({
            icon: 'barcode.viewfinder', iconBg: 'bg-blue',
            title: 'Scan barcode',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openScanner(slot); }
          }),
          listRow({
            icon: 'plus', iconBg: 'bg-green',
            title: 'Quick add calories',
            subtitle: 'No food, just numbers',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openQuickAdd(slot); }
          }),
          listRow({
            icon: 'fork.knife.fill', iconBg: 'bg-orange',
            title: 'Recipes',
            subtitle: state.recipes.length + ' saved',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openRecipesSheet(slot); }
          }),
          listRow({
            icon: 'list.bullet.rectangle.fill', iconBg: 'bg-teal',
            title: 'Saved meals',
            subtitle: state.savedMeals.length + ' saved',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openSavedMealsSheet(slot); }
          }),
          listRow({
            icon: 'square.and.pencil', iconBg: 'bg-purple',
            title: 'Add custom food',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openCustomFood(slot); }
          })
        )
      ));
      body.appendChild(searchField({ placeholder: 'Search foods', value: q, onInput: v => { q = v; replace(); } }));

      const all = [...FOODS, ...state.customFoods];
      if (q) {
        const ql = q.toLowerCase();
        const filtered = all.filter(f => f.name.toLowerCase().includes(ql));
        if (filtered.length === 0) body.appendChild(emptyState('magnifyingglass', 'Nothing found'));
        else body.appendChild(listSection({
          rows: filtered.map(f => foodRow(f))
        }));
      } else {
        // Favourites first
        const favIds = state.favouriteFoodIds;
        const favs = favIds.map(id => all.find(f => f.id === id)).filter(Boolean);
        if (favs.length > 0) {
          body.appendChild(listSection({
            header: 'Favourites',
            rows: favs.map(f => foodRow(f))
          }));
        }
        // Recent
        const recentIds = LOGIC.recentFoodIds(state.meals, 8);
        const recent = recentIds.map(id => all.find(f => f.id === id)).filter(Boolean);
        if (recent.length > 0) {
          body.appendChild(listSection({
            header: 'Recent',
            rows: recent.map(f => foodRow(f))
          }));
        }
        // All foods (capped)
        body.appendChild(listSection({
          header: 'All foods',
          rows: all.slice(0, 50).map(f => foodRow(f))
        }));
      }
      return body;

      function foodRow(f) {
        const isFav = state.favouriteFoodIds.includes(f.id);
        const star = h('button', {
          class: 'icon-btn',
          style: { padding: '4px', color: isFav ? 'var(--yellow)' : 'var(--label-tertiary)' },
          onClick: (e) => { e.stopPropagation(); favouriteToggle(f.id); replace(); }
        }, svg('checkmark', { size: 18, strokeWidth: 2.4 }));
        // Use a star-ish character via text since we don't have a star icon
        star.innerHTML = isFav ? '★' : '☆';
        star.style.fontSize = '20px'; star.style.lineHeight = '1';
        return listRow({
          title: f.name,
          subtitle: Math.round(f.cal) + ' kcal/100g · P ' + f.p + ' / C ' + f.c + ' / F ' + f.f,
          accessory: star,
          onClick: () => { closeSheet(); openFoodPortion(f, slot); }
        });
      }
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Add to ' + capitalize(slot),
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: build()
    });
  }

  // ----- Recipes -----
  function openRecipesSheet(slot) {
    function build() {
      const body = h('div');
      body.appendChild(h('div', { class: 'list-section' },
        h('div', { class: 'list-rows' },
          listRow({
            icon: 'plus', iconBg: 'bg-purple',
            title: 'Create recipe',
            accessory: 'chevron',
            onClick: () => { closeSheet(); openRecipeEditor(slot); }
          })
        )
      ));
      if (state.recipes.length === 0) {
        body.appendChild(emptyState('fork.knife', 'No recipes yet',
          'Recipes combine multiple foods into one logged item.'));
      } else {
        body.appendChild(listSection({
          header: 'Your recipes',
          rows: state.recipes.map(r => {
            const m = LOGIC.recipePerServing(r, foodById);
            return listRow({
              title: r.name,
              subtitle: r.servings + (r.servings === 1 ? ' serving · ' : ' servings · ') +
                Math.round(m.cal) + ' kcal/serving',
              accessory: 'chevron',
              onClick: () => {
                if (slot) { closeSheet(); logRecipeAsFood(r, slot); }
                else openRecipeEditor(slot, r.id);
              }
            });
          })
        }));
        body.appendChild(listSection({
          rows: state.recipes.map(r => listRow({
            icon: 'square.and.pencil', iconBg: 'bg-blue',
            title: 'Edit: ' + r.name,
            onClick: () => { closeSheet(); openRecipeEditor(slot, r.id); }
          }))
        }));
      }
      return body;
    }
    openSheet({
      title: slot ? 'Add recipe to ' + capitalize(slot) : 'Recipes',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: build()
    });
  }

  function logRecipeAsFood(recipe, slot) {
    const m = LOGIC.recipePerServing(recipe, foodById);
    const entry = {
      foodId: 'recipe:' + recipe.id,
      foodName: recipe.name,
      grams: 0,
      cal: m.cal, p: m.p, c: m.c, fat: m.f, fiber: m.fiber,
      consumedAt: new Date().toISOString(),
      servings: 1, recipeId: recipe.id
    };
    const key = LOGIC.dateKey(viewDate);
    state.meals[key] = state.meals[key] || { breakfast: [], lunch: [], dinner: [], snack: [] };
    state.meals[key][slot].push(entry);
    save(); rerender();
    toast('+1 ' + recipe.name);
  }

  function openRecipeEditor(returnSlot, recipeId) {
    const editing = recipeId ? state.recipes.find(r => r.id === recipeId) : null;
    const r = editing
      ? JSON.parse(JSON.stringify(editing))
      : { id: 'recipe-' + Date.now(), name: '', servings: 1, ingredients: [] };
    function build() {
      const m = LOGIC.recipePerServing(r, foodById);
      const body = h('div');
      body.appendChild(listSection({
        header: 'Recipe',
        rows: [
          listRow({
            title: 'Name',
            rightInput: (() => {
              const i = h('input', { type: 'text', class: 'row-input', placeholder: 'e.g., Power oats', value: r.name });
              i.style.textAlign = 'right';
              i.addEventListener('input', () => r.name = i.value);
              return i;
            })()
          }),
          listRow({
            title: 'Servings',
            rightInput: numericInput(r.servings, v => { r.servings = Math.max(1, Math.round(v || 1)); replace(); }, '')
          })
        ]
      }));
      // Ingredients
      const ingRows = r.ingredients.map((ing, idx) => {
        const food = foodById(ing.foodId);
        const cal = food ? Math.round(food.cal * (ing.grams || 0) / 100) : 0;
        return listRow({
          title: food ? food.name : '(missing food)',
          subtitle: ing.grams + ' g · ' + cal + ' kcal',
          accessory: h('button', { class: 'icon-btn', style: { color: 'var(--red)' }, onClick: () => {
            r.ingredients.splice(idx, 1); replace();
          } }, svg('xmark', { size: 16, strokeWidth: 2.5 }))
        });
      });
      ingRows.push(listRow({
        icon: 'plus', iconBg: 'bg-green',
        title: 'Add ingredient',
        accessory: 'chevron',
        onClick: () => openIngredientPicker(r, replace)
      }));
      body.appendChild(listSection({ header: 'Ingredients', rows: ingRows }));
      body.appendChild(listSection({
        header: 'Per serving',
        rows: [
          listRow({ title: 'Calories', accessory: Math.round(m.cal) + ' kcal' }),
          listRow({ title: 'Protein',  accessory: m.p.toFixed(1) + ' g' }),
          listRow({ title: 'Carbs',    accessory: m.c.toFixed(1) + ' g' }),
          listRow({ title: 'Fat',      accessory: m.f.toFixed(1) + ' g' })
        ]
      }));
      body.appendChild(h('div', { style: { padding: '0 16px', marginTop: '8px' } },
        h('button', { class: 'btn-primary', onClick: () => {
          if (!r.name) return toast('Name required');
          if (r.ingredients.length === 0) return toast('Add an ingredient');
          if (editing) {
            const i = state.recipes.findIndex(x => x.id === r.id);
            state.recipes[i] = r;
          } else {
            state.recipes.push(r);
          }
          save(); closeSheet();
          openRecipesSheet(returnSlot);
        } }, editing ? 'Save changes' : 'Save recipe')
      ));
      if (editing) {
        body.appendChild(h('div', { style: { padding: '8px 16px 0' } },
          h('button', { class: 'btn-destructive', onClick: () => {
            if (!confirm('Delete this recipe?')) return;
            state.recipes = state.recipes.filter(x => x.id !== r.id);
            save(); closeSheet();
            openRecipesSheet(returnSlot);
          } }, 'Delete recipe')
        ));
      }
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: editing ? 'Edit recipe' : 'New recipe',
      leading: h('button', { class: 'btn-link', onClick: () => { closeSheet(); openRecipesSheet(returnSlot); } }, 'Cancel'),
      body: build()
    });
  }
  function openIngredientPicker(recipe, onDone) {
    let q = '';
    function build() {
      const body = h('div');
      body.appendChild(searchField({ placeholder: 'Search foods', value: q, onInput: v => { q = v; replace(); } }));
      const all = [...FOODS, ...state.customFoods];
      const filtered = q
        ? all.filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
        : all.slice(0, 30);
      body.appendChild(listSection({
        rows: filtered.map(f => listRow({
          title: f.name,
          subtitle: Math.round(f.cal) + ' kcal/100g',
          accessory: 'chevron',
          onClick: () => {
            const grams = parseFloat(prompt('Grams of ' + f.name + '?', String(f.servingSize || 100)) || '0');
            if (grams > 0) {
              recipe.ingredients.push({ foodId: f.id, grams });
              closeSheet();
              if (onDone) onDone();
            }
          }
        }))
      }));
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Pick ingredient',
      leading: h('button', { class: 'btn-link', onClick: () => { closeSheet(); if (onDone) onDone(); } }, 'Cancel'),
      body: build()
    });
  }
  function foodById(id) {
    if (!id) return null;
    if (id.startsWith && id.startsWith('recipe:')) {
      const rid = id.slice(7);
      const r = state.recipes.find(x => x.id === rid);
      if (!r) return null;
      const m = LOGIC.recipePerServing(r, foodById);
      return { id, name: r.name, cal: m.cal, p: m.p, c: m.c, f: m.f, fiber: m.fiber,
               servingSize: 0, servingDesc: '1 serving' };
    }
    return [...FOODS, ...state.customFoods].find(f => f.id === id);
  }

  // ----- Saved meals -----
  function openSavedMealsSheet(slot) {
    function build() {
      const body = h('div');
      if (state.savedMeals.length === 0) {
        body.appendChild(emptyState('fork.knife', 'No saved meals yet',
          'Save a meal you eat often by tapping the bookmark on its meal card.'));
      } else {
        body.appendChild(listSection({
          header: 'Your saved meals',
          rows: state.savedMeals.map(m => {
            const totals = (m.items || []).reduce((s, it) => {
              const food = foodById(it.foodId);
              if (!food) return s;
              const f = it.grams / 100;
              return { cal: s.cal + food.cal * f, items: s.items + 1 };
            }, { cal: 0, items: 0 });
            return listRow({
              title: m.name,
              subtitle: totals.items + ' items · ' + Math.round(totals.cal) + ' kcal',
              accessory: 'chevron',
              onClick: () => { closeSheet(); logSavedMeal(m, slot); }
            });
          })
        }));
        body.appendChild(listSection({
          rows: state.savedMeals.map(m => listRow({
            icon: 'trash', iconBg: 'bg-red',
            title: 'Delete: ' + m.name,
            onClick: () => {
              if (!confirm('Delete \'' + m.name + '\'?')) return;
              state.savedMeals = state.savedMeals.filter(x => x.id !== m.id);
              save(); replace();
            }
          }))
        }));
      }
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: slot ? 'Add saved meal to ' + capitalize(slot) : 'Saved meals',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: build()
    });
  }
  function logSavedMeal(meal, slot) {
    const key = LOGIC.dateKey(viewDate);
    state.meals[key] = state.meals[key] || { breakfast: [], lunch: [], dinner: [], snack: [] };
    let added = 0;
    for (const it of (meal.items || [])) {
      const food = foodById(it.foodId);
      if (!food) continue;
      const f = it.grams / 100;
      state.meals[key][slot].push({
        foodId: food.id, foodName: food.name,
        grams: it.grams,
        cal: food.cal * f, p: food.p * f, c: food.c * f, fat: food.f * f, fiber: (food.fiber || 0) * f,
        consumedAt: new Date().toISOString()
      });
      added++;
    }
    save(); rerender();
    toast('Added ' + added + ' items');
  }
  function saveMealAsTemplate(slot, dateKey) {
    const items = (state.meals[dateKey] || {})[slot] || [];
    if (items.length === 0) return toast('Meal is empty');
    const name = prompt('Save \'' + capitalize(slot) + '\' as…', 'My ' + slot);
    if (!name) return;
    state.savedMeals.push({
      id: 'sm-' + Date.now(),
      name,
      items: items.filter(e => e.foodId && e.foodId !== 'quickadd' && e.grams).map(e => ({
        foodId: e.foodId, grams: e.grams
      }))
    });
    save();
    toast('Saved meal');
  }

  function openQuickAdd(slot) {
    let kcal = 0, p = 0, c = 0, f = 0;
    function build() {
      const body = h('div');
      body.appendChild(listSection({
        header: 'Quick add to ' + capitalize(slot),
        rows: [
          listRow({ title: 'Calories', rightInput: numericInput(kcal, v => { kcal = v; }, 'kcal') }),
          listRow({ title: 'Protein',  rightInput: numericInput(p,    v => { p    = v; }, 'g') }),
          listRow({ title: 'Carbs',    rightInput: numericInput(c,    v => { c    = v; }, 'g') }),
          listRow({ title: 'Fat',      rightInput: numericInput(f,    v => { f    = v; }, 'g') })
        ],
        footer: 'Use this when you don\'t want to log a specific food — eating out, custom snack, etc.'
      }));
      body.appendChild(h('div', { style: { padding: '0 16px', marginTop: '8px' } },
        h('button', { class: 'btn-primary', onClick: () => {
          if (kcal <= 0) return toast('Enter calories');
          const key = LOGIC.dateKey(viewDate);
          state.meals[key] = state.meals[key] || { breakfast: [], lunch: [], dinner: [], snack: [] };
          state.meals[key][slot].push({
            foodId: 'quickadd',
            foodName: 'Quick add',
            grams: 0,
            cal: kcal, p, c, fat: f, fiber: 0,
            consumedAt: new Date().toISOString()
          });
          save(); closeSheet(); rerender(); toast('+' + Math.round(kcal) + ' kcal');
        } }, 'Add ' + Math.round(kcal) + ' kcal')
      ));
      return body;
    }
    openSheet({
      title: 'Quick add',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: build()
    });
  }

  function openFoodPortion(food, slot) {
    let grams = food.servingSize || 100;
    function build() {
      const m = LOGIC.macrosFor(food, grams);
      const body = h('div');
      body.appendChild(listSection({
        header: food.brand ? food.brand + ' · ' + (food.servingDesc || '') : (food.servingDesc || ''),
        rows: [
          listRow({
            title: 'Grams',
            rightInput: numericInput(grams, v => { grams = v; replace(); }, 'g')
          })
        ]
      }));
      body.appendChild(listSection({
        header: 'This portion',
        rows: [
          listRow({ title: 'Calories', accessory: Math.round(m.cal) + ' kcal' }),
          listRow({ title: 'Protein', accessory: m.p.toFixed(1) + ' g' }),
          listRow({ title: 'Carbs', accessory: m.c.toFixed(1) + ' g' }),
          listRow({ title: 'Fat', accessory: m.f.toFixed(1) + ' g' }),
          food.fiber ? listRow({ title: 'Fiber', accessory: m.fiber.toFixed(1) + ' g' }) : null
        ].filter(Boolean)
      }));
      body.appendChild(h('div', { style: { padding: '0 16px', marginTop: '8px' } },
        h('button', { class: 'btn-primary', onClick: () => addEntry(food, grams, slot) }, 'Add to ' + capitalize(slot))
      ));
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: food.name,
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: build()
    });
  }

  function addEntry(food, grams, slot) {
    const m = LOGIC.macrosFor(food, grams);
    const key = LOGIC.dateKey(viewDate);
    state.meals[key] = state.meals[key] || { breakfast: [], lunch: [], dinner: [], snack: [] };
    state.meals[key][slot].push({
      foodId: food.id, foodName: food.name,
      grams,
      cal: m.cal, p: m.p, c: m.c, fat: m.f, fiber: m.fiber,
      consumedAt: new Date().toISOString()
    });
    save();
    closeSheet();
    rerender();
    toast('+' + Math.round(m.cal) + ' kcal');
  }

  function openCustomFood(slot) {
    const f = { name: '', cal: 0, p: 0, c: 0, f: 0 };
    function build() {
      const body = h('div');
      body.appendChild(listSection({
        header: 'Food',
        rows: [
          listRow({
            title: 'Name',
            rightInput: (() => {
              const i = h('input', { type: 'text', class: 'row-input', placeholder: 'e.g., Protein bar' });
              i.style.textAlign = 'right';
              i.addEventListener('input', () => f.name = i.value);
              return i;
            })()
          })
        ]
      }));
      body.appendChild(listSection({
        header: 'Per 100 g',
        rows: [
          listRow({ title: 'Calories', rightInput: numericInput(f.cal, v => f.cal = v, 'kcal') }),
          listRow({ title: 'Protein',  rightInput: numericInput(f.p, v => f.p = v, 'g') }),
          listRow({ title: 'Carbs',    rightInput: numericInput(f.c, v => f.c = v, 'g') }),
          listRow({ title: 'Fat',      rightInput: numericInput(f.f, v => f.f = v, 'g') })
        ]
      }));
      body.appendChild(h('div', { style: { padding: '0 16px', marginTop: '8px' } },
        h('button', { class: 'btn-primary', onClick: () => {
          if (!f.name) return toast('Name required');
          const food = {
            id: 'custom-' + Date.now(), source: 'custom',
            name: f.name, cal: f.cal, p: f.p, c: f.c, f: f.f, fiber: 0,
            servingSize: 100, servingDesc: '100 g'
          };
          state.customFoods.push(food); save();
          closeSheet();
          openFoodPortion(food, slot);
        } }, 'Save & continue')
      ));
      return body;
    }
    openSheet({
      title: 'Custom food',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: build()
    });
  }

  // ----- Scanner simulator -----
  function openScanner(slot) {
    closeSheet();
    const overlay = h('div', { class: 'scanner', id: 'scanner-overlay' });
    const closeBtn = h('button', { onClick: () => overlay.remove() }, svg('xmark', { size: 14, strokeWidth: 3 }));
    overlay.appendChild(h('div', { class: 'scanner-header' },
      closeBtn,
      h('div', { class: 'scanner-title' }, 'Scan barcode'),
      h('div', { style: { width: '30px' } })
    ));
    overlay.appendChild(h('div', { class: 'scanner-viewport' },
      h('div', { class: 'scanner-reticle' },
        h('div', { class: 'corner tl' }),
        h('div', { class: 'corner tr' }),
        h('div', { class: 'corner bl' }),
        h('div', { class: 'corner br' }),
        h('div', { class: 'scan-line' })
      ),
      h('div', { class: 'scanner-hint' }, 'Point at the barcode on a packaged food. Or tap a fixture below to simulate a scan.')
    ));

    const fixturesEl = h('div', { class: 'scanner-fixtures' });
    fixturesEl.appendChild(h('div', { class: 'scanner-fixtures-title' }, 'Test products'));
    for (const fx of BARCODE_FIXTURES) {
      fixturesEl.appendChild(h('div', { class: 'scanner-row', onClick: () => simulateScan(fx.barcode, slot) },
        h('div', { class: 'barcode-img', html: icon('barcode', { size: 28, strokeWidth: 2 }) }),
        h('div', { class: 'text' },
          h('div', { class: 'name' }, fx.productName + (fx.brand ? ' · ' + fx.brand : '')),
          h('div', { class: 'ean' }, fx.barcode + ' · ' + fx.cal + ' kcal/100g')
        )
      ));
    }
    const inputEl = h('input', { type: 'text', placeholder: 'Or type any EAN-13', inputmode: 'numeric' });
    fixturesEl.appendChild(h('div', { class: 'scanner-input' },
      inputEl,
      h('button', { onClick: () => simulateScan(inputEl.value, slot) }, 'Look up')
    ));
    overlay.appendChild(fixturesEl);
    $('#phone').appendChild(overlay);

    function simulateScan(code, slot) {
      const fx = LOGIC.lookupBarcode(code, BARCODE_FIXTURES);
      overlay.remove();
      if (!fx) {
        toast('Unknown barcode: ' + code);
        return;
      }
      const food = barcodeToFood(fx);
      // Save to customFoods so it shows up in search later
      if (!state.customFoods.find(f => f.id === food.id)) {
        state.customFoods.push(food); save();
      }
      openFoodPortion(food, slot);
    }
  }

  function barcodeToFood(fx) {
    return {
      id: 'off-' + fx.barcode,
      source: 'off',
      barcode: fx.barcode,
      brand: fx.brand,
      name: fx.productName,
      cal: fx.cal, p: fx.p, c: fx.c, f: fx.f, fiber: fx.fiber || 0,
      servingSize: fx.servingSize, servingDesc: fx.servingDesc
    };
  }

  // ----- Profile -----
  function viewProfile() {
    const wrap = h('div');
    wrap.appendChild(h('div', { class: 'nav-bar' },
      h('h1', { class: 'nav-large-title' }, 'You')
    ));

    // User
    wrap.appendChild(listSection({
      header: 'Profile',
      rows: [
        listRow({
          title: 'Display name',
          rightInput: (() => {
            const i = h('input', { type: 'text', class: 'row-input', placeholder: 'Your name', value: state.user.displayName });
            i.style.textAlign = 'right';
            i.addEventListener('input', () => { state.user.displayName = i.value; save(); });
            return i;
          })()
        })
      ]
    }));

    // Goals
    function gRow(title, key, unit, isInt) {
      return listRow({
        title,
        rightInput: numericInput(state.goals[key], v => { state.goals[key] = isInt ? Math.round(v) : v; save(); }, unit)
      });
    }
    wrap.appendChild(listSection({
      header: 'Daily goals',
      rows: [
        gRow('Calories', 'calories', 'kcal', true),
        gRow('Protein',  'protein', 'g', true),
        gRow('Carbs',    'carbs',   'g', true),
        gRow('Fat',      'fat',     'g', true),
        gRow('Water',    'waterMl', 'ml', true)
      ]
    }));
    wrap.appendChild(listSection({
      header: 'Body',
      rows: [
        gRow('Height',      'height', 'cm'),
        gRow('Weight goal', 'weight', 'kg')
      ]
    }));

    // Theme
    wrap.appendChild(listSection({
      header: 'Appearance',
      rows: [
        listRow({
          icon: 'sun.max.fill', iconBg: 'bg-yellow',
          title: 'Light',
          accessory: state.theme === 'light' ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
          onClick: () => setTheme('light')
        }),
        listRow({
          icon: 'moon.fill', iconBg: 'bg-indigo',
          title: 'Dark',
          accessory: state.theme === 'dark' ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
          onClick: () => setTheme('dark')
        }),
        listRow({
          icon: 'gear', iconBg: 'bg-gray',
          title: 'Match system',
          accessory: state.theme == null ? svg('checkmark', { size: 16, strokeWidth: 3 }) : null,
          onClick: () => setTheme(null)
        })
      ]
    }));

    // Library section
    wrap.appendChild(listSection({
      header: 'Library',
      rows: [
        listRow({
          icon: 'fork.knife.fill', iconBg: 'bg-orange',
          title: 'Recipes',
          subtitle: state.recipes.length + ' saved',
          accessory: 'chevron',
          onClick: () => openRecipesSheet(null)
        }),
        listRow({
          icon: 'list.bullet.rectangle.fill', iconBg: 'bg-teal',
          title: 'Saved meals',
          subtitle: state.savedMeals.length + ' saved',
          accessory: 'chevron',
          onClick: () => openSavedMealsSheet(null)
        }),
        listRow({
          icon: 'scalemass', iconBg: 'bg-blue',
          title: 'Body measurements',
          subtitle: state.bodyMeasurements.length + ' entries',
          accessory: 'chevron',
          onClick: openBodyMeasurements
        }),
        listRow({
          icon: 'list.bullet.rectangle.fill', iconBg: 'bg-indigo',
          title: 'Routines',
          subtitle: state.routines.length + ' saved',
          accessory: 'chevron',
          onClick: openRoutinesPicker
        })
      ]
    }));

    // Sync / health (display-only here)
    wrap.appendChild(listSection({
      header: 'Integrations',
      rows: [
        listRow({
          icon: 'heart.fill', iconBg: 'bg-red',
          title: 'Apple Health', subtitle: 'Mocked in prototype'
        }),
        listRow({
          icon: 'icloud.fill', iconBg: 'bg-blue',
          title: 'iCloud sync', subtitle: 'Native app only'
        })
      ]
    }));

    // Demo data + tests + reset
    wrap.appendChild(listSection({
      header: 'Test tools',
      rows: [
        listRow({
          icon: 'arrow.clockwise', iconBg: 'bg-green',
          title: 'Load demo data',
          subtitle: '4 weeks workouts · 14 days meals · 30 days weight',
          accessory: 'chevron',
          onClick: loadDemoData
        }),
        listRow({
          icon: 'testtube.2.fill', iconBg: 'bg-purple',
          title: 'Run tests',
          subtitle: 'Logic & barcode-lookup assertions',
          accessory: 'chevron',
          onClick: () => navigate('tests')
        }),
        listRow({
          icon: 'trash', iconBg: 'bg-red',
          title: 'Reset all data',
          accessory: 'chevron',
          onClick: () => {
            if (confirm('Wipe all prototype data?')) {
              reset(); rerender(); toast('Reset');
            }
          }
        })
      ]
    }));

    // About
    wrap.appendChild(listSection({
      header: 'About',
      rows: [
        listRow({ title: 'Version', accessory: '0.1.0 · web prototype' }),
        listRow({ title: 'Storage', accessory: localStorageSize() })
      ]
    }));
    return wrap;
  }

  function localStorageSize() {
    try {
      const bytes = (localStorage.getItem(STORAGE_KEY) || '').length;
      return (bytes / 1024).toFixed(1) + ' KB';
    } catch { return '—'; }
  }

  function openBodyMeasurements() {
    const kinds = [
      { key: 'chest',   label: 'Chest',     unit: 'cm' },
      { key: 'waist',   label: 'Waist',     unit: 'cm' },
      { key: 'hips',    label: 'Hips',      unit: 'cm' },
      { key: 'arm',     label: 'Arm',       unit: 'cm' },
      { key: 'thigh',   label: 'Thigh',     unit: 'cm' },
      { key: 'neck',    label: 'Neck',      unit: 'cm' },
      { key: 'bodyFat', label: 'Body fat',  unit: '%'  }
    ];
    function build() {
      const body = h('div');
      for (const k of kinds) {
        const entries = state.bodyMeasurements.filter(m => m.kind === k.key)
          .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
        const latest = entries[0];
        body.appendChild(listSection({
          header: k.label,
          rows: [
            listRow({
              title: 'Log new',
              icon: 'plus', iconBg: 'bg-green',
              accessory: 'chevron',
              onClick: () => {
                const v = parseFloat(prompt(k.label + ' (' + k.unit + ')', latest ? String(latest.value) : '') || '');
                if (!isFinite(v) || v <= 0) return;
                state.bodyMeasurements.push({
                  id: 'bm-' + Date.now(),
                  kind: k.key, value: v,
                  recordedAt: new Date().toISOString()
                });
                save(); replace();
              }
            }),
            ...(latest ? [listRow({
              title: 'Latest',
              accessory: latest.value + ' ' + k.unit + '  ·  ' + relativeDate(new Date(latest.recordedAt))
            })] : []),
            ...(entries.length > 1 ? [listRow({
              title: 'History (' + entries.length + ')',
              accessory: 'chevron',
              onClick: () => openMeasurementHistory(k)
            })] : [])
          ]
        }));
      }
      return body;
    }
    function replace() {
      const c = $('.sheet-content');
      if (c) { c.innerHTML = ''; c.appendChild(build()); }
    }
    openSheet({
      title: 'Body measurements',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Close'),
      body: build()
    });
  }
  function openMeasurementHistory(kind) {
    const entries = state.bodyMeasurements.filter(m => m.kind === kind.key)
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    const points = [...entries].reverse().map(m => ({ x: new Date(m.recordedAt).getTime(), y: m.value }));
    const body = h('div');
    if (points.length >= 2) body.appendChild(progressChart(kind.label + ' (' + kind.unit + ')', points, kind.unit, 'var(--blue)'));
    body.appendChild(listSection({
      header: 'History',
      rows: entries.map((e, idx) => listRow({
        title: e.value + ' ' + kind.unit,
        subtitle: new Date(e.recordedAt).toLocaleString(),
        accessory: h('button', { class: 'icon-btn', style: { color: 'var(--red)' }, onClick: () => {
          state.bodyMeasurements = state.bodyMeasurements.filter(x => x.id !== e.id);
          save(); closeSheet(); openMeasurementHistory(kind);
        } }, svg('xmark', { size: 16, strokeWidth: 2.5 }))
      }))
    }));
    openSheet({
      title: kind.label,
      leading: h('button', { class: 'btn-link', onClick: () => { closeSheet(); openBodyMeasurements(); } }, '‹ Back'),
      body
    });
  }

  function loadDemoData() {
    const demo = generateDemoData();
    state.workouts = [...state.workouts, ...demo.workouts];
    Object.assign(state.meals, demo.meals);
    state.weights = demo.weights;
    save();
    rerender();
    toast('Demo data loaded');
  }

  // ----- Tests -----
  const TESTS = [
    {
      name: 'macrosFor scales linearly per gram',
      run: () => {
        const f = { cal: 200, p: 20, c: 30, f: 5 };
        const m = LOGIC.macrosFor(f, 50);
        assertClose(m.cal, 100); assertClose(m.p, 10);
        assertClose(m.c, 15); assertClose(m.f, 2.5);
      }
    },
    {
      name: 'macrosFor returns zeros for 0 grams',
      run: () => {
        const f = { cal: 200, p: 20, c: 30, f: 5 };
        const m = LOGIC.macrosFor(f, 0);
        assertClose(m.cal, 0); assertClose(m.p, 0);
      }
    },
    {
      name: 'totalsForDate sums across all meal slots',
      run: () => {
        const meals = {
          '2026-05-09': {
            breakfast: [{ cal: 300, p: 20, c: 50, fat: 5 }],
            lunch:     [{ cal: 600, p: 40, c: 70, fat: 15 }],
            dinner:    [{ cal: 800, p: 50, c: 80, fat: 25 }],
            snack:     [{ cal: 200, p: 10, c: 20, fat: 8 }]
          }
        };
        const t = LOGIC.totalsForDate(meals, '2026-05-09');
        assertClose(t.cal, 1900); assertClose(t.p, 120);
        assertClose(t.c, 220); assertClose(t.f, 53);
      }
    },
    {
      name: 'totalsForDate empty for unknown date',
      run: () => {
        const t = LOGIC.totalsForDate({}, '1999-01-01');
        assertClose(t.cal, 0); assertClose(t.p, 0); assertClose(t.c, 0); assertClose(t.f, 0);
      }
    },
    {
      name: 'platesPerSide for 100kg with 20kg bar (kg)',
      run: () => {
        const r = LOGIC.platesPerSide(100, 20);
        // Per side = 40 kg → 25 + 15
        assertEqual(JSON.stringify(r), JSON.stringify([{ plate: 25, count: 1 }, { plate: 15, count: 1 }]));
      }
    },
    {
      name: 'platesPerSide for 142.5kg with 20kg bar',
      run: () => {
        const r = LOGIC.platesPerSide(142.5, 20);
        // Per side = 61.25 → 25 + 25 + 10 + 1.25
        assertEqual(JSON.stringify(r), JSON.stringify([{ plate: 25, count: 2 }, { plate: 10, count: 1 }, { plate: 1.25, count: 1 }]));
      }
    },
    {
      name: 'platesPerSide returns empty when target ≤ bar',
      run: () => {
        const r = LOGIC.platesPerSide(20, 20);
        assertEqual(r.length, 0);
      }
    },
    {
      name: 'estimate1RM via Epley (100kg × 5 ≈ 116.67)',
      run: () => {
        assertClose(LOGIC.estimate1RM(100, 5), 116.6667, 0.01);
      }
    },
    {
      name: 'estimate1RM zero on zero inputs',
      run: () => {
        assertEqual(LOGIC.estimate1RM(0, 5), 0);
        assertEqual(LOGIC.estimate1RM(100, 0), 0);
      }
    },
    {
      name: 'groupSets preserves order, dedupes by exerciseId',
      run: () => {
        const sets = [
          { exerciseId: 'a', exerciseName: 'A', weight: 50, reps: 5 },
          { exerciseId: 'b', exerciseName: 'B', weight: 30, reps: 8 },
          { exerciseId: 'a', exerciseName: 'A', weight: 55, reps: 5 }
        ];
        const g = LOGIC.groupSets(sets);
        assertEqual(g.length, 2);
        assertEqual(g[0].id, 'a'); assertEqual(g[0].sets.length, 2);
        assertEqual(g[1].id, 'b'); assertEqual(g[1].sets.length, 1);
      }
    },
    {
      name: 'totalVolume sums weight × reps',
      run: () => {
        const v = LOGIC.totalVolume([
          { weight: 100, reps: 5 },
          { weight: 80, reps: 8 },
          { weight: 60, reps: 12 }
        ]);
        assertClose(v, 500 + 640 + 720);  // 1860
      }
    },
    {
      name: 'dateKey returns YYYY-MM-DD',
      run: () => {
        const d = new Date(2026, 4, 9);
        assertEqual(LOGIC.dateKey(d), '2026-05-09');
      }
    },
    {
      name: 'daysBetween counts whole days',
      run: () => {
        const a = new Date(2026, 4, 9);
        const b = new Date(2026, 4, 12);
        assertEqual(LOGIC.daysBetween(a, b), 3);
        assertEqual(LOGIC.daysBetween(b, a), -3);
      }
    },
    {
      name: 'goalProgress is capped at 100%',
      run: () => {
        assertClose(LOGIC.goalProgress(50, 100), 0.5);
        assertClose(LOGIC.goalProgress(150, 100), 1);
        assertClose(LOGIC.goalProgress(0, 100), 0);
      }
    },
    {
      name: 'goalProgress is 0 for nonpositive goal',
      run: () => {
        assertClose(LOGIC.goalProgress(50, 0), 0);
        assertClose(LOGIC.goalProgress(50, -1), 0);
      }
    },
    {
      name: 'lookupBarcode finds Nutella in fixtures',
      run: () => {
        const r = LOGIC.lookupBarcode('3017624010701', BARCODE_FIXTURES);
        assertEqual(r && r.productName, 'Nutella');
        assertClose(r.cal, 539);
      }
    },
    {
      name: 'lookupBarcode finds Coca-Cola',
      run: () => {
        const r = LOGIC.lookupBarcode('5449000000996', BARCODE_FIXTURES);
        assertEqual(r && r.productName, 'Coca-Cola Classic');
      }
    },
    {
      name: 'lookupBarcode returns null on unknown',
      run: () => {
        const r = LOGIC.lookupBarcode('0000000000000', BARCODE_FIXTURES);
        assertEqual(r, null);
      }
    },
    {
      name: 'lookupBarcode trims whitespace',
      run: () => {
        const r = LOGIC.lookupBarcode('  3017624010701  ', BARCODE_FIXTURES);
        assertEqual(r && r.productName, 'Nutella');
      }
    },
    {
      name: 'all curated foods have positive calories',
      run: () => {
        const broken = FOODS.filter(f => f.cal <= 0 && f.name !== 'Coffee, black' && f.name !== 'Cucumber');
        assertEqual(broken.length, 0, 'foods missing kcal: ' + broken.map(f => f.name).join(', '));
      }
    },
    {
      name: 'all exercises have a primary muscle',
      run: () => {
        const broken = EXERCISES.filter(e => !e.muscle);
        assertEqual(broken.length, 0);
      }
    },
    {
      name: 'all barcode fixtures are 12 or 13 digits',
      run: () => {
        for (const fx of BARCODE_FIXTURES) {
          if (!/^\d{12,13}$/.test(fx.barcode)) {
            throw new Error('Bad EAN: ' + fx.barcode);
          }
        }
      }
    },
    {
      name: 'waterTotalForDate sums entries',
      run: () => {
        const log = { '2026-05-09': [{ ml: 250 }, { ml: 250 }, { ml: 500 }] };
        assertClose(LOGIC.waterTotalForDate(log, '2026-05-09'), 1000);
      }
    },
    {
      name: 'waterTotalForDate is 0 for missing date',
      run: () => {
        assertClose(LOGIC.waterTotalForDate({}, '2026-05-09'), 0);
        assertClose(LOGIC.waterTotalForDate(null, '2026-05-09'), 0);
      }
    },
    {
      name: 'cardioTotalForDate sums kcal',
      run: () => {
        const c = { '2026-05-09': [{ kcal: 200 }, { kcal: 150 }] };
        assertClose(LOGIC.cardioTotalForDate(c, '2026-05-09'), 350);
      }
    },
    {
      name: 'recentFoodIds dedupes and orders by recency',
      run: () => {
        const meals = {
          '2026-05-09': { breakfast: [{ foodId: 'a', consumedAt: 'x' }, { foodId: 'b', consumedAt: 'y' }], lunch: [], dinner: [], snack: [] },
          '2026-05-08': { breakfast: [{ foodId: 'c' }], lunch: [{ foodId: 'a' }], dinner: [], snack: [] }
        };
        const ids = LOGIC.recentFoodIds(meals, 10);
        assertEqual(ids[0], 'b');
        assertEqual(ids[1], 'a');
        assertEqual(ids[2], 'c');
        assertEqual(ids.length, 3);
      }
    },
    {
      name: 'recentFoodIds drops quickadd / custom',
      run: () => {
        const meals = {
          '2026-05-09': {
            breakfast: [{ foodId: 'quickadd' }, { foodId: 'real-1' }, { foodId: 'custom' }],
            lunch: [], dinner: [], snack: []
          }
        };
        const ids = LOGIC.recentFoodIds(meals, 10);
        assertEqual(ids.length, 1);
        assertEqual(ids[0], 'real-1');
      }
    },
    {
      name: 'detectPRs flags only new bests',
      run: () => {
        const sets = [
          { id: 's1', exerciseId: 'a', performedAt: '2026-05-01', completed: true, weight: 80, reps: 5 },
          { id: 's2', exerciseId: 'a', performedAt: '2026-05-02', completed: true, weight: 80, reps: 5 }, // tie, NOT PR
          { id: 's3', exerciseId: 'a', performedAt: '2026-05-03', completed: true, weight: 82.5, reps: 5 } // PR
        ];
        const prs = LOGIC.detectPRs(sets);
        assertEqual(prs.has('s1'), true);
        assertEqual(prs.has('s2'), false);
        assertEqual(prs.has('s3'), true);
      }
    },
    {
      name: 'recipePerServing divides totals by servings',
      run: () => {
        const recipe = {
          servings: 2,
          ingredients: [
            { foodId: 'rice', grams: 200 },
            { foodId: 'chicken', grams: 200 }
          ]
        };
        const lookup = id => id === 'rice'
          ? { cal: 130, p: 2.7, c: 28, f: 0.3 }
          : { cal: 165, p: 31, c: 0, f: 3.6 };
        const m = LOGIC.recipePerServing(recipe, lookup);
        // Per ingredient totals: rice = 260 kcal, chicken = 330 kcal → 590 / 2 = 295
        assertClose(m.cal, 295);
        assertClose(m.p, (2.7*2 + 31*2) / 2);
      }
    },
    {
      name: 'mealStreak counts consecutive days back',
      run: () => {
        const today = new Date(2026, 4, 9);
        const meals = {
          '2026-05-09': { breakfast: [{ cal: 100 }] },
          '2026-05-08': { lunch: [{ cal: 200 }] },
          '2026-05-07': { dinner: [{ cal: 300 }] },
          // gap on 5-06
          '2026-05-05': { breakfast: [{ cal: 100 }] }
        };
        assertEqual(LOGIC.mealStreak(meals, today), 3);
      }
    },
    {
      name: 'mealStreak is 0 with no meals today',
      run: () => {
        const today = new Date(2026, 4, 9);
        assertEqual(LOGIC.mealStreak({}, today), 0);
      }
    },
    {
      name: 'bestPerSession picks max 1RM per day',
      run: () => {
        const sets = [
          { performedAt: '2026-05-01T10:00', completed: true, weight: 100, reps: 5 },
          { performedAt: '2026-05-01T11:00', completed: true, weight: 110, reps: 3 },
          { performedAt: '2026-05-08T10:00', completed: true, weight: 105, reps: 5 },
          { performedAt: '2026-05-08T11:00', completed: false, weight: 999, reps: 1 }   // dropped (incomplete)
        ];
        const out = LOGIC.bestPerSession(sets);
        assertEqual(out.length, 2);
        // 110 × 3 = 110 × (1+3/30) = 121
        assertClose(out[0].oneRm, 121);
        // 105 × 5 = 105 × (1+5/30) = 122.5
        assertClose(out[1].oneRm, 122.5);
      }
    }
  ];

  function assertClose(a, b, eps) {
    if (eps == null) eps = 1e-3;
    if (Math.abs(a - b) > eps) throw new Error(`expected ≈ ${b}, got ${a}`);
  }
  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error((msg ? msg + ' — ' : '') + `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }

  function viewTests() {
    const wrap = h('div');
    wrap.appendChild(h('div', { class: 'nav-bar' },
      h('div', { class: 'nav-titlebar' },
        h('div', { class: 'leading' },
          h('button', { class: 'btn-link', onClick: () => navigate('profile') },
            svg('chevron.left', { size: 17, strokeWidth: 2.5 }), 'Back'
          )
        )
      ),
      h('h1', { class: 'nav-large-title' }, 'Tests')
    ));

    // Run all tests
    let pass = 0, fail = 0;
    const results = TESTS.map(t => {
      const start = performance.now();
      try {
        t.run();
        pass++;
        return { ...t, status: 'pass', ms: performance.now() - start };
      } catch (err) {
        fail++;
        return { ...t, status: 'fail', err: String(err && err.message || err), ms: performance.now() - start };
      }
    });

    wrap.appendChild(h('div', { class: 'test-summary' },
      h('div', { class: 'stat pass' },
        h('div', { class: 'num' }, pass),
        h('div', { class: 'lbl' }, 'passed')
      ),
      h('div', { class: 'stat fail' },
        h('div', { class: 'num' }, fail),
        h('div', { class: 'lbl' }, 'failed')
      ),
      h('div', { class: 'stat' },
        h('div', { class: 'num' }, TESTS.length),
        h('div', { class: 'lbl' }, 'total')
      ),
      h('div', { style: { marginLeft: 'auto' } },
        h('button', { class: 'btn-link bold', onClick: () => navigate('tests') }, 'Re-run')
      )
    ));

    const list = h('div', { class: 'list-rows', style: { margin: '0 16px' } });
    for (const r of results) {
      list.appendChild(h('div', { class: 'test-row ' + r.status },
        h('div', { class: 'test-icon' }, svg(r.status === 'pass' ? 'checkmark.circle.fill' : 'xmark.circle.fill', { size: 22, strokeWidth: 2 })),
        h('div', { class: 'test-text' },
          h('div', { class: 'test-name' }, r.name),
          r.err ? h('div', { class: 'test-detail' }, r.err) : null
        ),
        h('div', { class: 'test-time' }, r.ms.toFixed(1) + 'ms')
      ));
    }
    wrap.appendChild(list);
    return wrap;
  }

  // ============================================================
  // Misc
  // ============================================================
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function relativeDate(d) {
    const days = LOGIC.daysBetween(d, new Date());
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 30) return Math.floor(days / 7) + ' weeks ago';
    return d.toLocaleDateString();
  }

  // ----- Weight sheet -----
  function openWeightSheet() {
    let kg = state.weights.length ? state.weights[state.weights.length - 1].kg : 80;
    function build() {
      const body = h('div');
      body.appendChild(listSection({
        header: 'Weight',
        rows: [
          listRow({
            title: 'Today',
            rightInput: numericInput(kg, v => kg = v, 'kg')
          })
        ]
      }));
      body.appendChild(h('div', { style: { padding: '0 16px' } },
        h('button', { class: 'btn-primary', onClick: () => {
          if (kg <= 0) return toast('Enter a valid weight');
          state.weights.push({ kg, recordedAt: new Date().toISOString() });
          save(); closeSheet(); rerender();
          toast('Logged ' + kg.toFixed(1) + ' kg');
        } }, 'Log')
      ));
      return body;
    }
    openSheet({
      title: 'Log weight',
      leading: h('button', { class: 'btn-link', onClick: closeSheet }, 'Cancel'),
      body: build()
    });
  }

  // ----- Rest timer -----
  let restTimer = null;
  function startRestTimer(sec) {
    stopRestTimer();
    let remaining = sec;
    const span = h('span', { class: 'numeric' }, formatTime(remaining));
    const skip = h('button', { onClick: stopRestTimer }, 'Skip');
    const pill = h('div', {
      id: 'rest-pill',
      style: {
        position: 'absolute', bottom: '100px', left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(28,28,30,0.92)', color: '#fff',
        padding: '10px 18px', borderRadius: '999px',
        display: 'flex', alignItems: 'center', gap: '12px',
        font: '600 16px var(--font)', zIndex: '5'
      }
    },
      svg('timer', { size: 18, strokeWidth: 2 }),
      'Rest', span, skip
    );
    skip.style.cssText = 'background: rgba(255,255,255,0.16); color: #fff; border: 0; padding: 4px 10px; border-radius: 12px; font-size: 12px; cursor: pointer;';
    $('#phone').appendChild(pill);
    restTimer = setInterval(() => {
      remaining--;
      span.textContent = formatTime(Math.max(0, remaining));
      if (remaining <= 0) stopRestTimer();
    }, 1000);
  }
  function stopRestTimer() {
    if (restTimer) { clearInterval(restTimer); restTimer = null; }
    const p = document.getElementById('rest-pill');
    if (p) p.remove();
  }
  function formatTime(s) {
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // ============================================================
  // Status bar (clock)
  // ============================================================
  function tickStatusBar() {
    const t = $('#status-time');
    if (t) {
      const d = new Date();
      const h12 = d.getHours();
      t.textContent = h12 + ':' + String(d.getMinutes()).padStart(2, '0');
    }
  }

  // ============================================================
  // Boot
  // ============================================================
  function boot() {
    // Status bar fill
    $('.status-bar .right').innerHTML = icon('cellularbars', { size: 17, strokeWidth: 0 }) +
      icon('wifi', { size: 17, strokeWidth: 1.6 }) +
      '<span class="battery"></span>';
    applyTheme();
    tickStatusBar();
    setInterval(tickStatusBar, 30000);
    rerender();
    if (!state.onboarded) {
      // Defer slightly so initial paint settles first.
      setTimeout(showOnboarding, 200);
    }
  }

  // ----- Onboarding -----
  function showOnboarding() {
    let page = 0;
    const pages = [
      {
        emoji: '👋', icon: 'house.fill', tint: 'var(--blue)',
        title: 'Welcome to Fit Buddy',
        body: 'One app for your workouts and your nutrition. No subscription, no account, no nonsense.'
      },
      {
        emoji: '🎯', icon: 'flame.fill', tint: 'var(--orange)',
        title: 'Track what matters',
        body: 'Calories and macros, water, body weight, every set you lift, every PR. Personal records auto-detected.'
      },
      {
        emoji: '🚀', icon: 'play.fill', tint: 'var(--green)',
        title: 'Get started',
        body: 'Tap "Load demo data" in You → Test tools to fill the app with realistic sample data, or jump right in and log your first workout.'
      }
    ];
    function render() {
      const p = pages[page];
      const overlay = document.getElementById('onboarding-overlay');
      const target = overlay || h('div', { id: 'onboarding-overlay' });
      target.innerHTML = '';
      target.style.cssText = `
        position: absolute; inset: 0; z-index: 300;
        background: var(--bg-system);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 64px 32px;
        animation: fadeIn 0.3s ease;
      `;
      target.appendChild(h('div', {
        style: {
          width: '120px', height: '120px', borderRadius: '32px',
          background: p.tint, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '64px var(--font)',
          marginBottom: '32px'
        }
      }, p.emoji));
      target.appendChild(h('h1', {
        style: {
          font: '700 28px var(--font)', textAlign: 'center', margin: '0 0 12px',
          letterSpacing: '0.37px'
        }
      }, p.title));
      target.appendChild(h('p', {
        style: {
          font: '400 17px/1.4 var(--font)', textAlign: 'center',
          color: 'var(--label-secondary)', margin: '0 0 32px', maxWidth: '320px'
        }
      }, p.body));
      // Page dots
      const dots = h('div', { style: { display: 'flex', gap: '6px', marginBottom: '40px' } });
      pages.forEach((_, i) => dots.appendChild(h('span', {
        style: {
          width: i === page ? '20px' : '6px', height: '6px',
          borderRadius: '3px',
          background: i === page ? 'var(--tint)' : 'var(--label-tertiary)',
          transition: 'width 0.2s'
        }
      })));
      target.appendChild(dots);
      // Buttons
      const btnRow = h('div', { style: { display: 'flex', gap: '12px', width: '100%' } });
      if (page > 0) {
        btnRow.appendChild(h('button', {
          class: 'btn-secondary', style: { flex: '1' },
          onClick: () => { page--; render(); }
        }, 'Back'));
      } else {
        btnRow.appendChild(h('button', {
          class: 'btn-secondary', style: { flex: '1' },
          onClick: dismissOnboarding
        }, 'Skip'));
      }
      btnRow.appendChild(h('button', {
        class: 'btn-primary', style: { flex: '2' },
        onClick: () => {
          if (page < pages.length - 1) { page++; render(); }
          else dismissOnboarding();
        }
      }, page < pages.length - 1 ? 'Next' : 'Get started'));
      target.appendChild(btnRow);
      if (!overlay) $('#phone').appendChild(target);
    }
    function dismissOnboarding() {
      state.onboarded = true; save();
      const overlay = document.getElementById('onboarding-overlay');
      if (overlay) overlay.remove();
    }
    render();
  }

  global.UFB_LOGIC = LOGIC;  // for any external test harness
  global.UFB_BOOT = boot;
})(window);
