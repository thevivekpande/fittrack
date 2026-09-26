import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLERGENS, DIET_OPTIONS, MEAL_CATALOG, MEAL_SLOTS, NUTRITION_GOALS, createEmptyNutrition, getMealChoices, logNutritionMeal, mealCatalog, mealMatchesPreferences, normalizeCustomMeal, normalizeNutrition, normalizeNutritionPreferences, nutritionDateKey, nutritionDayIndex, nutritionTotals, removeNutritionLog, scaleNutrients, setNutritionMeal, suggestNutritionWeek } from '../src/nutrition.js';

const preferences = overrides => ({ diet: 'omnivore', goal: 'balanced', allergies: [], allergyConfirmed: true, exclusions: '', calorieGoal: null, proteinGoal: null, ...overrides });
const workspace = overrides => ({ ...createEmptyNutrition(), preferences: preferences(overrides) });
const findMeal = id => MEAL_CATALOG.find(item => item.id === id);
const customFood = overrides => ({ id: 'custom-my-soup', name: 'My soup', portion: 'One 250 g bowl', ingredients: ['lentils', 'tomato', 'water'], diet: 'vegan', allergens: [], allergyConfirmed: true, nutrients: { calories: 250, protein: 15, carbs: 38, fat: 5 }, ...overrides });

test('nutrition starts without assumed preferences, targets, food choices or consumption', () => {
  const empty = createEmptyNutrition();
  assert.equal(empty.preferences, null);
  assert.deepEqual(empty.customMeals, []);
  assert.deepEqual(empty.logs, {});
  assert.equal(empty.week.length, 7);
  assert.ok(empty.week.every(day => MEAL_SLOTS.every(slot => day[slot] === null)));
  empty.week[0].breakfast = { mealId: 'banana-oats', servings: 1 };
  assert.equal(createEmptyNutrition().week[0].breakfast, null);
  assert.equal(empty.week[1].breakfast, null);
});

test('preferences require an explicit eating style, goal, and allergy review', () => {
  for (const value of [null, {}, preferences({ diet: '' }), preferences({ goal: '' }), preferences({ allergyConfirmed: false }), preferences({ allergies: ['unknown'] })]) {
    assert.equal(normalizeNutritionPreferences(value), null);
  }
  const chosen = normalizeNutritionPreferences(preferences({ allergies: ['milk', 'milk'], calorieGoal: 2250, proteinGoal: 125.5 }));
  assert.deepEqual(chosen.allergies, ['milk']);
  assert.equal(chosen.calorieGoal, 2250);
  assert.equal(chosen.proteinGoal, 125.5);
  assert.equal(normalizeNutritionPreferences(preferences()).calorieGoal, null);
  assert.equal(normalizeNutritionPreferences(preferences()).proteinGoal, null);
  assert.equal(normalizeNutritionPreferences(preferences({ calorieGoal: -20, proteinGoal: Infinity })).calorieGoal, null);
});

test('catalog records have explicit portions, ingredients, allergens and finite estimated nutrition', () => {
  assert.equal(MEAL_CATALOG.length, 22);
  assert.equal(new Set(MEAL_CATALOG.map(item => item.id)).size, MEAL_CATALOG.length);
  for (const meal of MEAL_CATALOG) {
    assert.ok(meal.name && meal.portion && meal.ingredients.length);
    assert.ok(DIET_OPTIONS.some(item => item.id === meal.diet));
    assert.ok(meal.slots.every(slot => MEAL_SLOTS.includes(slot)));
    assert.ok(meal.allergens.every(id => ALLERGENS.some(item => item.id === id)));
    assert.ok(Object.values(meal.nutrients).every(value => Number.isFinite(value) && value >= 0));
  }
  for (const slot of MEAL_SLOTS) assert.ok(MEAL_CATALOG.some(item => item.slots.includes(slot)));
});

test('vegan and vegetarian matching excludes incompatible foods and respects all allergens', () => {
  assert.equal(mealMatchesPreferences(findMeal('paneer-rice'), preferences({ diet: 'vegan' })), false);
  assert.equal(mealMatchesPreferences(findMeal('egg-rice'), preferences({ diet: 'vegetarian' })), true);
  assert.equal(mealMatchesPreferences(findMeal('chicken-rice'), preferences({ diet: 'vegetarian' })), false);
  for (const food of MEAL_CATALOG) {
    for (const allergen of food.allergens) assert.equal(mealMatchesPreferences(food, preferences({ allergies: [allergen] })), false, `${food.id}/${allergen}`);
  }
  assert.equal(mealMatchesPreferences(findMeal('lentil-rice'), preferences({ diet: 'vegan', allergies: ALLERGENS.map(item => item.id) })), true);
  assert.equal(mealMatchesPreferences({}, preferences()), false);
  assert.equal(mealMatchesPreferences(findMeal('lentil-rice'), null), false);
});

test('exclusions are case-insensitive, support separated ingredients and common food aliases', () => {
  for (const [food, exclusions] of [['lentil-rice', 'LENTILS'], ['paneer-rice', 'dairy'], ['eggs-toast', 'gluten'], ['banana-oats', 'gluten'], ['chicken-rice', 'tomato, broccoli'], ['tofu-rice', 'soybeans'], ['salmon-rice', 'seafood'], ['fruit-bowl', 'strawberry']]) {
    assert.equal(mealMatchesPreferences(findMeal(food), preferences({ exclusions })), false, exclusions);
  }
  assert.equal(mealMatchesPreferences(findMeal('lentil-rice'), preferences({ exclusions: 'mushroom; peanut\nalmond' })), true);
});

test('suggestions require saved preferences and never fall back to excluded meals', () => {
  assert.deepEqual(suggestNutritionWeek(createEmptyNutrition()), createEmptyNutrition().week);
  const blocked = workspace({ diet: 'vegan', allergies: ALLERGENS.map(item => item.id), exclusions: 'oats, lentil, chickpea, bean, fruit, apple, banana, potato, rice, pasta, tofu' });
  for (const slot of MEAL_SLOTS) assert.deepEqual(getMealChoices(blocked, slot), []);
  assert.ok(suggestNutritionWeek(blocked).every(day => Object.values(day).every(entry => entry === null)));
  assert.deepEqual(blocked.logs, {});
});

test('all suggested slots match the selected diet and allergies without prescribing targets', () => {
  for (const diet of DIET_OPTIONS) for (const goal of NUTRITION_GOALS) {
    const value = workspace({ diet: diet.id, goal: goal.id, allergies: ['peanut', 'milk'] });
    const original = structuredClone(value);
    const week = suggestNutritionWeek(value);
    assert.equal(week.length, 7);
    for (const day of week) for (const [slot, entry] of Object.entries(day)) {
      if (!entry) continue;
      const food = findMeal(entry.mealId);
      assert.ok(food.slots.includes(slot));
      assert.equal(mealMatchesPreferences(food, value.preferences), true);
      assert.equal(entry.servings, 1);
    }
    assert.deepEqual(value, original, 'suggestions are pure and do not invent logged activity');
    assert.equal(value.preferences.calorieGoal, null);
  }
});

test('recurring meal edits affect one weekday and preserve independent days', () => {
  const empty = workspace();
  const planned = setNutritionMeal(empty, 0, 'breakfast', { mealId: 'banana-oats', servings: 1.5 });
  assert.deepEqual(planned.week[0].breakfast, { mealId: 'banana-oats', servings: 1.5 });
  assert.equal(planned.week[1].breakfast, null);
  assert.equal(empty.week[0].breakfast, null);
  assert.equal(nutritionTotals(planned, '2020-01-06').planned.calories, 442.5);
  assert.equal(nutritionTotals(planned, '2020-01-13').planned.calories, 442.5);
  assert.deepEqual(setNutritionMeal(planned, 0, 'breakfast', null).week[0].breakfast, null);
  assert.deepEqual(setNutritionMeal(planned, 0, 'breakfast', { mealId: 'salmon-rice', servings: 1 }), planned, 'slot type is respected');
  assert.deepEqual(setNutritionMeal(planned, 0, 'breakfast', { mealId: 'banana-oats', servings: -1 }), planned);
});

test('meal logging records actual portions for one date without changing the weekly plan', () => {
  const planned = setNutritionMeal(workspace(), 0, 'breakfast', { mealId: 'banana-oats', servings: 1 });
  const logged = logNutritionMeal(planned, '2020-01-06', 'breakfast', 0.5);
  assert.equal(logged.week[0].breakfast.servings, 1);
  assert.equal(logged.logs['2020-01-06'].breakfast.servings, 0.5);
  assert.equal(nutritionTotals(logged, '2020-01-06').logged.calories, 147.5);
  assert.equal(nutritionTotals(logged, '2020-01-13').logged.calories, 0);
  assert.equal(nutritionTotals(logged, '2020-01-06').completed, 1);
  assert.deepEqual(logNutritionMeal(logged, '2020-01-06', 'breakfast', 2), logged, 'repeat taps cannot duplicate intake');
  assert.deepEqual(logNutritionMeal(planned, '2999-01-07', 'breakfast').logs, {}, 'future meals are not logged');
  assert.deepEqual(logNutritionMeal(planned, '2020-01-06', 'breakfast', 0).logs, {});
  assert.deepEqual(logNutritionMeal(planned, '2020-01-06', 'breakfast', 0.01).logs, {}, 'tiny inputs cannot round into zero-portion logs');
  const quarter = logNutritionMeal(planned, '2020-01-06', 'breakfast', 0.25);
  assert.equal(quarter.logs['2020-01-06'].breakfast.servings, 0.25);
  assert.equal(quarter.logs['2020-01-06'].breakfast.nutrients.calories, 73.8);
});

test('logged meal snapshots survive recurring plan edits and preference changes', () => {
  let state = setNutritionMeal(workspace(), 0, 'breakfast', { mealId: 'yogurt-berry-oats', servings: 1 });
  state = logNutritionMeal(state, '2020-01-06', 'breakfast');
  const snapshot = structuredClone(state.logs);
  state = setNutritionMeal(state, 0, 'breakfast', { mealId: 'banana-oats', servings: 2 });
  assert.deepEqual(state.logs, snapshot);
  state.preferences = preferences({ diet: 'vegan' });
  assert.deepEqual(normalizeNutrition(state).logs, snapshot);
  assert.equal(nutritionTotals(state, '2020-01-06').planned.calories, 590);
  assert.equal(nutritionTotals(state, '2020-01-06').logged.calories, 330);
  assert.deepEqual(removeNutritionLog(state, '2020-01-06', 'breakfast').logs, {});
});

test('changed allergies block stale planned meals from being logged', () => {
  const planned = setNutritionMeal(workspace(), 0, 'breakfast', { mealId: 'yogurt-berry-oats', servings: 1 });
  planned.preferences = preferences({ allergies: ['milk'] });
  assert.equal(planned.week[0].breakfast.mealId, 'yogurt-berry-oats', 'the user can review the incompatible meal');
  assert.deepEqual(logNutritionMeal(planned, '2020-01-06', 'breakfast').logs, {});
  assert.equal(getMealChoices(planned, 'breakfast').some(food => food.id === 'yogurt-berry-oats'), false);
});

test('custom foods require reviewed ingredients and finite nutrition for every field', () => {
  assert.ok(normalizeCustomMeal(customFood()));
  for (const overrides of [{ ingredients: [] }, { allergyConfirmed: false }, { diet: '' }, { portion: '' }, { nutrients: { calories: 20 } }, { nutrients: { calories: Infinity, protein: 1, carbs: 1, fat: 1 } }]) {
    assert.equal(normalizeCustomMeal(customFood(overrides)), null);
  }
  const state = { ...workspace(), customMeals: [customFood()] };
  assert.ok(getMealChoices(state, 'dinner').some(food => food.id === 'custom-my-soup'));
  assert.equal(getMealChoices({ ...state, preferences: preferences({ exclusions: 'lentil' }) }, 'dinner').some(food => food.id === 'custom-my-soup'), false);
});

test('removing a custom food clears recurring references but keeps its historical nutrition', () => {
  let state = normalizeNutrition({ ...workspace(), customMeals: [customFood()] });
  state = setNutritionMeal(state, 0, 'lunch', { mealId: 'custom-my-soup', servings: 2 });
  state = logNutritionMeal(state, '2020-01-06', 'lunch');
  const removed = normalizeNutrition({ ...state, customMeals: [] });
  assert.equal(removed.week[0].lunch, null);
  assert.equal(removed.logs['2020-01-06'].lunch.name, 'My soup');
  assert.equal(removed.logs['2020-01-06'].lunch.nutrients.calories, 500);
});

test('normalization rejects corrupt dates, records, unknown food references and non-finite values', () => {
  for (const malformed of [undefined, null, [], 'bad', 12]) assert.deepEqual(normalizeNutrition(malformed), createEmptyNutrition());
  const state = normalizeNutrition({ ...workspace(), week: [{ breakfast: { mealId: 'unknown', servings: 1 }, lunch: { mealId: 'lentil-rice', servings: Infinity } }], customMeals: [customFood(), customFood(), {}], logs: { '2020-02-30': { breakfast: { mealId: 'banana-oats', name: 'Banana oats', servings: 1, nutrients: findMeal('banana-oats').nutrients } }, '2020-01-06': { breakfast: { mealId: 'banana-oats', name: 'Banana oats', servings: 1, nutrients: { calories: NaN, protein: 1, carbs: 1, fat: 1 } } } } });
  assert.equal(state.customMeals.length, 1);
  assert.ok(state.week.every(day => Object.values(day).every(entry => entry === null)));
  assert.deepEqual(state.logs, {});
  assert.deepEqual(normalizeNutrition(state), state, 'normalization is idempotent');
});

test('portion scaling, local dates and total rounding remain stable', () => {
  assert.deepEqual(scaleNutrients({ calories: 101, protein: 10.1, carbs: 14.3, fat: 4.4 }, 1.5), { calories: 151.5, protein: 15.2, carbs: 21.5, fat: 6.6 });
  const monday = new Date(2020, 0, 6, 12);
  assert.equal(nutritionDayIndex(monday), 0);
  assert.equal(nutritionDateKey(monday), '2020-01-06');
  assert.deepEqual(nutritionTotals(workspace(), 'not-a-date'), { planned: { calories: 0, protein: 0, carbs: 0, fat: 0 }, logged: { calories: 0, protein: 0, carbs: 0, fat: 0 }, completed: 0 });
  assert.equal(mealCatalog(createEmptyNutrition()).length, 22);
});
