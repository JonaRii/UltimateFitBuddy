/* Validated test fixtures for the prototype.
 *
 * BARCODE_FIXTURES — real EAN-13 codes mapped to OFF-shaped responses with
 * realistic macros. Used by the scanner simulator and asserted by the test
 * suite. Numbers are per 100 g (or per 100 ml for liquids).
 *
 * generateDemoData() — produces 4 weeks of progressing workouts, 14 days of
 * varied meals, 30 days of body weight. Triggered from Profile › "Load demo
 * data" so empty-state and fully-populated states are both reachable.
 */
(function (global) {
  'use strict';

  // ===== Barcode fixtures (10 real products) =====
  const BARCODE_FIXTURES = [
    {
      barcode: '3017624010701',
      productName: 'Nutella',
      brand: 'Ferrero',
      categoryEmoji: 'spread',
      cal: 539, p: 6.3, c: 57.5, f: 30.9, fiber: 0,
      sugar: 56.3, sodium: 41,
      servingSize: 15, servingDesc: '1 tbsp (15 g)'
    },
    {
      barcode: '5449000000996',
      productName: 'Coca-Cola Classic',
      brand: 'Coca-Cola',
      categoryEmoji: 'beverage',
      cal: 42, p: 0, c: 10.6, f: 0, fiber: 0,
      sugar: 10.6, sodium: 4,
      servingSize: 330, servingDesc: '1 can (330 ml)'
    },
    {
      barcode: '7622210449283',
      productName: 'Oreo Original',
      brand: 'Mondelez',
      categoryEmoji: 'cookie',
      cal: 481, p: 5.1, c: 70.0, f: 20.0, fiber: 2.5,
      sugar: 38.0, sodium: 393,
      servingSize: 33, servingDesc: '3 cookies (33 g)'
    },
    {
      barcode: '0050000281015',
      productName: 'Heinz Tomato Ketchup',
      brand: 'Heinz',
      categoryEmoji: 'condiment',
      cal: 100, p: 1.2, c: 23.0, f: 0.1, fiber: 0.4,
      sugar: 22.0, sodium: 1110,
      servingSize: 17, servingDesc: '1 tbsp (17 g)'
    },
    {
      barcode: '0030000010013',
      productName: 'Quaker Old Fashioned Oats',
      brand: 'Quaker',
      categoryEmoji: 'grain',
      cal: 379, p: 13.0, c: 67.0, f: 6.5, fiber: 10.0,
      sugar: 1.0, sodium: 0,
      servingSize: 40, servingDesc: '1/2 cup dry (40 g)'
    },
    {
      barcode: '0028400064057',
      productName: "Lay's Classic Potato Chips",
      brand: "Lay's",
      categoryEmoji: 'snack',
      cal: 535, p: 6.0, c: 53.0, f: 33.0, fiber: 4.0,
      sugar: 0.5, sodium: 595,
      servingSize: 28, servingDesc: '1 oz (28 g)'
    },
    {
      barcode: '5000159484695',
      productName: 'Mars Bar',
      brand: 'Mars',
      categoryEmoji: 'candy',
      cal: 449, p: 4.1, c: 70.0, f: 17.0, fiber: 1.0,
      sugar: 60.0, sodium: 159,
      servingSize: 51, servingDesc: '1 bar (51 g)'
    },
    {
      barcode: '5000159456876',
      productName: 'Snickers',
      brand: 'Mars',
      categoryEmoji: 'candy',
      cal: 488, p: 8.5, c: 56.0, f: 24.0, fiber: 2.5,
      sugar: 47.0, sodium: 224,
      servingSize: 50, servingDesc: '1 bar (50 g)'
    },
    {
      barcode: '0894700010014',
      productName: 'Chobani Plain Non-Fat Greek Yogurt',
      brand: 'Chobani',
      categoryEmoji: 'dairy',
      cal: 59, p: 10.0, c: 3.6, f: 0.4, fiber: 0,
      sugar: 3.2, sodium: 36,
      servingSize: 170, servingDesc: '1 container (170 g)'
    },
    {
      barcode: '8076809513753',
      productName: 'Barilla Spaghetti N.5',
      brand: 'Barilla',
      categoryEmoji: 'grain',
      cal: 359, p: 12.0, c: 72.0, f: 1.5, fiber: 3.0,
      sugar: 3.5, sodium: 4,
      servingSize: 85, servingDesc: '85 g dry (1 portion)'
    }
  ];

  // ===== Demo data generator =====
  function generateDemoData() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d;
    };
    // IMPORTANT: must match the app's local-time dateKey, not UTC, otherwise
    // demo entries land under the wrong day when the local zone is offset
    // from UTC (we hit this when running near midnight in a non-UTC zone).
    const dateKey = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    // ---- 4 weeks of workouts with light progression ----
    const workouts = [];
    const exData = global.UFB_DATA.EXERCISES;
    const find = (name) => exData.find(e => e.name === name);

    function pushWorkout(daysAgo, name, sets) {
      const start = new Date(day(-daysAgo));
      start.setHours(17, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      workouts.push({
        id: 'wk-demo-' + daysAgo,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        name,
        sets: sets.map((s, i) => ({
          exerciseId: find(s.exercise) ? find(s.exercise).id : 'ex-001',
          exerciseName: s.exercise,
          weight: s.weight,
          reps: s.reps,
          completed: true,
          ordinal: i,
          performedAt: start.toISOString()
        }))
      });
    }

    // Linear progression on the big lifts. ~1.25 kg per week per major lift.
    function setsFor(exercise, baseWeight, weekDelta, reps) {
      const w = baseWeight + weekDelta * 1.25;
      return [
        { exercise, weight: Math.round(w * 0.6 * 2) / 2, reps: 8 },   // warm-up
        { exercise, weight: Math.round(w * 0.8 * 2) / 2, reps: 5 },
        { exercise, weight: w, reps },
        { exercise, weight: w, reps },
        { exercise, weight: w, reps }
      ];
    }

    // Week -3 (oldest)
    pushWorkout(24, 'Push A', [
      ...setsFor('Bench Press', 80, 0, 5),
      ...setsFor('Overhead Press', 50, 0, 5),
      { exercise: 'Triceps Pushdown', weight: 30, reps: 12 },
      { exercise: 'Triceps Pushdown', weight: 30, reps: 12 },
      { exercise: 'Triceps Pushdown', weight: 32.5, reps: 10 }
    ]);
    pushWorkout(22, 'Pull A', [
      ...setsFor('Conventional Deadlift', 120, 0, 5),
      { exercise: 'Pull-up', weight: 0, reps: 8 },
      { exercise: 'Pull-up', weight: 0, reps: 7 },
      { exercise: 'Pull-up', weight: 0, reps: 6 },
      { exercise: 'Barbell Curl', weight: 30, reps: 10 },
      { exercise: 'Barbell Curl', weight: 30, reps: 10 }
    ]);
    pushWorkout(20, 'Legs A', [
      ...setsFor('Back Squat', 100, 0, 5),
      ...setsFor('Romanian Deadlift', 80, 0, 8),
      { exercise: 'Standing Calf Raise', weight: 60, reps: 15 },
      { exercise: 'Standing Calf Raise', weight: 60, reps: 15 }
    ]);
    // Week -2
    pushWorkout(17, 'Push A', [
      ...setsFor('Bench Press', 80, 1, 5),
      ...setsFor('Overhead Press', 50, 1, 5),
      { exercise: 'Triceps Pushdown', weight: 32.5, reps: 12 },
      { exercise: 'Triceps Pushdown', weight: 32.5, reps: 12 }
    ]);
    pushWorkout(15, 'Pull A', [
      ...setsFor('Conventional Deadlift', 120, 1, 5),
      { exercise: 'Pull-up', weight: 0, reps: 9 },
      { exercise: 'Pull-up', weight: 0, reps: 7 },
      { exercise: 'Barbell Curl', weight: 32.5, reps: 10 }
    ]);
    pushWorkout(13, 'Legs A', [
      ...setsFor('Back Squat', 100, 1, 5),
      ...setsFor('Romanian Deadlift', 80, 1, 8)
    ]);
    // Week -1
    pushWorkout(10, 'Push A', [
      ...setsFor('Bench Press', 80, 2, 5),
      ...setsFor('Incline Dumbbell Press', 24, 2, 8),
      { exercise: 'Lateral Raise', weight: 10, reps: 12 },
      { exercise: 'Lateral Raise', weight: 10, reps: 12 }
    ]);
    pushWorkout(8, 'Pull A', [
      ...setsFor('Conventional Deadlift', 120, 2, 5),
      { exercise: 'Pull-up', weight: 0, reps: 10 },
      { exercise: 'Pull-up', weight: 0, reps: 8 },
      { exercise: 'Hammer Curl', weight: 14, reps: 12 }
    ]);
    pushWorkout(6, 'Legs A', [
      ...setsFor('Back Squat', 100, 2, 5),
      ...setsFor('Bulgarian Split Squat', 16, 0, 10)
    ]);
    // This week
    pushWorkout(3, 'Push A', [
      ...setsFor('Bench Press', 80, 3, 5),
      ...setsFor('Overhead Press', 50, 3, 5)
    ]);
    pushWorkout(1, 'Pull A', [
      ...setsFor('Conventional Deadlift', 120, 3, 5),
      { exercise: 'Pull-up', weight: 0, reps: 10 },
      { exercise: 'Pull-up', weight: 0, reps: 9 }
    ]);

    // ---- 14 days of meals (varied — some empty, some full) ----
    const meals = {};
    const FOODS = global.UFB_DATA.FOODS;
    const findFood = (name) => FOODS.find(f => f.name === name);
    function pushEntry(daysAgo, slot, foodName, grams) {
      const food = findFood(foodName);
      if (!food) return;
      const key = dateKey(day(-daysAgo));
      meals[key] = meals[key] || { breakfast: [], lunch: [], dinner: [], snack: [] };
      const factor = grams / 100;
      const consumedAt = new Date(day(-daysAgo));
      consumedAt.setHours(slot === 'breakfast' ? 8 : slot === 'lunch' ? 12 : slot === 'dinner' ? 19 : 15);
      meals[key][slot].push({
        foodId: food.id, foodName: food.name,
        grams,
        cal: food.cal * factor, p: food.p * factor, c: food.c * factor, fat: food.f * factor, fiber: (food.fiber||0) * factor,
        consumedAt: consumedAt.toISOString()
      });
    }

    // Varied template — full days, lighter days, one empty
    for (let d = 0; d < 14; d++) {
      if (d === 7) continue; // empty day
      const heavy = (d % 3 === 0);
      pushEntry(d, 'breakfast', 'Oats, rolled, dry', 50);
      pushEntry(d, 'breakfast', 'Banana', heavy ? 130 : 100);
      pushEntry(d, 'breakfast', 'Whey protein isolate', 30);
      pushEntry(d, 'lunch', 'Chicken breast, cooked', heavy ? 200 : 150);
      pushEntry(d, 'lunch', 'White rice, cooked', heavy ? 250 : 180);
      pushEntry(d, 'lunch', 'Broccoli, cooked', 150);
      if (d % 2 === 0) pushEntry(d, 'snack', 'Greek yogurt, plain non-fat', 170);
      if (d % 4 === 0) pushEntry(d, 'snack', 'Almonds', 28);
      pushEntry(d, 'dinner', d % 2 === 0 ? 'Salmon, Atlantic, cooked' : 'Ground beef 90/10, cooked', 180);
      pushEntry(d, 'dinner', 'Sweet potato, baked', 200);
      pushEntry(d, 'dinner', 'Spinach, raw', 60);
      if (d === 2) pushEntry(d, 'snack', 'Pizza, cheese', 214);  // cheat day
    }

    // ---- 30 days of body weight (slight downward trend with noise) ----
    const weights = [];
    let baseKg = 82.4;
    for (let d = 30; d >= 0; d--) {
      const kg = +(baseKg + (Math.sin(d / 4) * 0.6) - (d * 0.025)).toFixed(1);
      const recordedAt = new Date(day(-d));
      recordedAt.setHours(7, 30);
      weights.push({ kg, recordedAt: recordedAt.toISOString() });
    }

    return { workouts, meals, weights };
  }

  global.UFB_FIXTURES = { BARCODE_FIXTURES, generateDemoData };
})(window);
