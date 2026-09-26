export const MEAL_SLOTS = Object.freeze(['breakfast', 'lunch', 'dinner', 'snack']);
export const DIET_OPTIONS = Object.freeze([
  { id: 'vegetarian', label: 'Vegetarian', detail: 'Includes dairy and eggs' },
  { id: 'vegan', label: 'Vegan', detail: 'Plant foods only' },
  { id: 'omnivore', label: 'Omnivore', detail: 'Plant foods, meat and fish' },
]);
export const NUTRITION_GOALS = Object.freeze([
  { id: 'balanced', label: 'Build a balanced routine' },
  { id: 'build-muscle', label: 'Support muscle building' },
  { id: 'fat-loss', label: 'Support my fat-loss goal' },
  { id: 'body-recomposition', label: 'Support recomposition' },
]);
export const ALLERGENS = Object.freeze([
  { id: 'milk', label: 'Milk / dairy' }, { id: 'egg', label: 'Eggs' },
  { id: 'fish', label: 'Fish' }, { id: 'shellfish', label: 'Shellfish' },
  { id: 'peanut', label: 'Peanuts' }, { id: 'tree-nut', label: 'Tree nuts' },
  { id: 'wheat', label: 'Wheat' }, { id: 'soy', label: 'Soy' }, { id: 'sesame', label: 'Sesame' },
]);
export const NUTRITION_SOURCES = Object.freeze([
  { label: 'USDA FoodData Central', url: 'https://fdc.nal.usda.gov/' },
  { label: 'Health Canada: common food nutrient values', url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html' },
]);

// Rounded recipe estimates for the listed portions, informed by generic food
// composition references above. They are not product-label values or a calorie
// prescription. Actual brands, portions, preparation and added oil vary.
const meal = (id, name, slots, diet, ingredients, allergens, portion, calories, protein, carbs, fat) => Object.freeze({
  id, name, slots, diet, ingredients, allergens, portion,
  nutrients: Object.freeze({ calories, protein, carbs, fat }), custom: false,
});
export const MEAL_CATALOG = Object.freeze([
  meal('banana-oats', 'Banana oat bowl', ['breakfast'], 'vegan', ['oats', 'banana', 'cinnamon', 'water'], [], '50 g dry oats, 1 banana, cooked with water', 295, 8, 61, 4),
  meal('yogurt-berry-oats', 'Yogurt, berries & oats', ['breakfast'], 'vegetarian', ['plain yogurt', 'milk', 'oats', 'berries'], ['milk'], '200 g plain yogurt, 40 g oats, 100 g berries', 330, 17, 47, 9),
  meal('eggs-toast', 'Eggs & wholegrain toast', ['breakfast'], 'vegetarian', ['eggs', 'wholegrain wheat bread', 'tomato', 'olive oil'], ['egg', 'wheat'], '2 eggs, 2 slices toast, tomato, 1 tsp oil', 385, 21, 35, 17),
  meal('tofu-toast', 'Tofu scramble on toast', ['breakfast'], 'vegan', ['tofu', 'soy', 'wholegrain wheat bread', 'tomato', 'spinach', 'olive oil'], ['soy', 'wheat'], '150 g tofu, 2 slices toast, vegetables, 1 tsp oil', 390, 24, 39, 15),
  meal('peanut-oats', 'Peanut butter oatmeal', ['breakfast'], 'vegan', ['oats', 'peanut butter', 'banana', 'water'], ['peanut'], '50 g dry oats, 1 tbsp peanut butter, ½ banana', 335, 12, 48, 12),
  meal('cottage-fruit', 'Cottage cheese & fruit', ['breakfast', 'snack'], 'vegetarian', ['cottage cheese', 'milk', 'apple'], ['milk'], '200 g cottage cheese and 1 apple', 275, 24, 32, 6),
  meal('lentil-rice', 'Lentil & rice bowl', ['lunch', 'dinner'], 'vegan', ['lentils', 'brown rice', 'carrot', 'spinach', 'olive oil'], [], '200 g cooked lentils, 150 g cooked rice, vegetables, 1 tsp oil', 485, 23, 79, 8),
  meal('chickpea-rice', 'Chickpea rice salad', ['lunch', 'dinner'], 'vegan', ['chickpeas', 'brown rice', 'cucumber', 'tomato', 'lemon', 'olive oil'], [], '180 g cooked chickpeas, 100 g cooked rice, salad, 1 tsp oil', 485, 19, 79, 11),
  meal('bean-potato', 'Bean & baked potato bowl', ['lunch', 'dinner'], 'vegan', ['kidney beans', 'potato', 'tomato', 'spinach', 'olive oil'], [], '180 g cooked beans, 200 g potato, vegetables, 1 tsp oil', 465, 21, 80, 7),
  meal('tofu-rice', 'Tofu, broccoli & rice', ['lunch', 'dinner'], 'vegan', ['tofu', 'soy', 'broccoli', 'brown rice', 'olive oil'], ['soy'], '180 g tofu, 150 g cooked rice, 150 g broccoli, 1 tsp oil', 480, 29, 53, 19),
  meal('chickpea-pasta', 'Chickpea tomato pasta', ['lunch', 'dinner'], 'vegan', ['chickpeas', 'wholewheat pasta', 'tomato', 'spinach', 'olive oil'], ['wheat'], '150 g cooked pasta, 100 g chickpeas, tomato sauce, 1 tsp oil', 475, 19, 78, 10),
  meal('paneer-rice', 'Paneer & vegetable rice', ['lunch', 'dinner'], 'vegetarian', ['paneer', 'milk', 'brown rice', 'bell pepper', 'spinach', 'olive oil'], ['milk'], '100 g paneer, 150 g cooked rice, vegetables, 1 tsp oil', 535, 25, 49, 27),
  meal('egg-rice', 'Egg & vegetable rice', ['lunch', 'dinner'], 'vegetarian', ['eggs', 'brown rice', 'peas', 'carrot', 'olive oil'], ['egg'], '2 eggs, 180 g cooked rice, mixed vegetables, 1 tsp oil', 475, 22, 57, 17),
  meal('chicken-rice', 'Chicken, rice & greens', ['lunch', 'dinner'], 'omnivore', ['chicken', 'brown rice', 'broccoli', 'olive oil'], [], '120 g cooked chicken breast, 150 g cooked rice, greens, 1 tsp oil', 470, 43, 45, 12),
  meal('tuna-potato', 'Tuna & potato salad', ['lunch', 'dinner'], 'omnivore', ['tuna', 'potato', 'cucumber', 'tomato', 'olive oil', 'lemon'], ['fish'], '120 g drained tuna, 250 g potato, salad, 2 tsp oil', 440, 36, 52, 10),
  meal('salmon-rice', 'Salmon & rice plate', ['lunch', 'dinner'], 'omnivore', ['salmon', 'brown rice', 'broccoli'], ['fish'], '120 g cooked salmon, 150 g cooked rice, 150 g broccoli', 470, 33, 45, 18),
  meal('fruit-almonds', 'Apple & almonds', ['snack'], 'vegan', ['apple', 'almonds'], ['tree-nut'], '1 apple and 25 g almonds', 240, 5, 31, 13),
  meal('hummus-carrot', 'Hummus & carrot sticks', ['snack'], 'vegan', ['chickpeas', 'sesame tahini', 'carrot', 'olive oil', 'lemon'], ['sesame'], '60 g hummus and 150 g carrots', 160, 5, 22, 7),
  meal('plain-yogurt', 'Plain yogurt & berries', ['snack'], 'vegetarian', ['plain yogurt', 'milk', 'berries'], ['milk'], '170 g plain yogurt and 100 g berries', 170, 9, 23, 5),
  meal('edamame', 'Steamed edamame', ['snack'], 'vegan', ['edamame', 'soy'], ['soy'], '150 g cooked, shelled edamame', 185, 18, 14, 8),
  meal('banana-peanut', 'Banana & peanut butter', ['snack'], 'vegan', ['banana', 'peanut butter'], ['peanut'], '1 banana and 1 tbsp peanut butter', 200, 5, 30, 8),
  meal('fruit-bowl', 'Fresh fruit bowl', ['snack'], 'vegan', ['apple', 'banana', 'berries'], [], '½ apple, ½ banana and 100 g berries', 150, 2, 37, 1),
]);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const round = value => Math.round(value * 10) / 10;
const portion = value => Math.round(value * 100) / 100;
const number = (value, maximum = 10000) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
const validServings = value => number(value, 20) && value >= 0.1;
const text = (value, maximum) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const known = (items, value) => items.some(item => item.id === value);
const allergenIds = new Set(ALLERGENS.map(item => item.id));
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && nutritionDateKey(date) === value;
};
const emptyDay = () => Object.fromEntries(MEAL_SLOTS.map(slot => [slot, null]));
const nutrients = (value, maximum = 10000) => isObject(value) && ['calories', 'protein', 'carbs', 'fat'].every(key => number(value[key], maximum))
  ? Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map(key => [key, round(value[key])])) : null;

export function createEmptyNutrition() {
  return { version: 1, preferences: null, week: Array.from({ length: 7 }, emptyDay), customMeals: [], logs: {} };
}

export function normalizeNutritionPreferences(value) {
  if (!isObject(value) || !known(DIET_OPTIONS, value.diet) || !known(NUTRITION_GOALS, value.goal)
    || value.allergyConfirmed !== true || !Array.isArray(value.allergies)
    || value.allergies.some(id => !allergenIds.has(id))) return null;
  return {
    diet: value.diet, goal: value.goal, allergyConfirmed: true,
    allergies: [...new Set(value.allergies)], exclusions: text(value.exclusions, 500),
    calorieGoal: number(value.calorieGoal) && value.calorieGoal > 0 ? value.calorieGoal : null,
    proteinGoal: number(value.proteinGoal, 1000) && value.proteinGoal > 0 ? value.proteinGoal : null,
  };
}

export function normalizeCustomMeal(value) {
  const facts = nutrients(value?.nutrients);
  if (!isObject(value) || !/^custom-[a-zA-Z0-9-]{1,80}$/.test(value.id) || !text(value.name, 90)
    || !text(value.portion, 180) || !known(DIET_OPTIONS, value.diet) || !facts
    || !Array.isArray(value.ingredients) || !value.ingredients.length
    || !value.ingredients.every(item => typeof item === 'string' && item.trim())
    || !Array.isArray(value.allergens) || value.allergens.some(id => !allergenIds.has(id))
    || value.allergyConfirmed !== true) return null;
  return {
    id: value.id, name: text(value.name, 90), portion: text(value.portion, 180), diet: value.diet,
    ingredients: value.ingredients.slice(0, 50).map(item => text(item, 80)), allergens: [...new Set(value.allergens)],
    allergyConfirmed: true, slots: [...MEAL_SLOTS], nutrients: facts, custom: true,
  };
}

export function normalizeNutrition(value) {
  const result = createEmptyNutrition();
  if (!isObject(value)) return result;
  result.preferences = normalizeNutritionPreferences(value.preferences);
  const ids = new Set();
  result.customMeals = (Array.isArray(value.customMeals) ? value.customMeals : []).flatMap(item => {
    const normalized = normalizeCustomMeal(item);
    if (!normalized || ids.has(normalized.id)) return [];
    ids.add(normalized.id);
    return [normalized];
  }).slice(0, 300);
  const catalog = new Map([...MEAL_CATALOG, ...result.customMeals].map(item => [item.id, item]));
  result.week = result.week.map((day, index) => Object.fromEntries(MEAL_SLOTS.map(slot => {
    const entry = value.week?.[index]?.[slot];
    return [slot, isObject(entry) && catalog.get(entry.mealId)?.slots.includes(slot) && validServings(entry.servings)
      ? { mealId: entry.mealId, servings: portion(entry.servings) } : null];
  })));
  if (isObject(value.logs)) for (const [date, entries] of Object.entries(value.logs)) {
    if (!validDate(date) || !isObject(entries)) continue;
    const saved = {};
    for (const slot of MEAL_SLOTS) {
      const entry = entries[slot];
      const facts = nutrients(entry?.nutrients, 200000);
      if (!isObject(entry) || !text(entry.name, 90) || !text(entry.mealId, 90) || !facts || !validServings(entry.servings)) continue;
      saved[slot] = { mealId: text(entry.mealId, 90), name: text(entry.name, 90), servings: portion(entry.servings), nutrients: facts };
    }
    if (Object.keys(saved).length) result.logs[date] = saved;
  }
  return result;
}

export function nutritionDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const nutritionDayIndex = date => (date.getDay() + 6) % 7;
export const mealCatalog = nutrition => [
  ...MEAL_CATALOG,
  ...(Array.isArray(nutrition?.customMeals) ? nutrition.customMeals.map(normalizeCustomMeal).filter(Boolean) : []),
];
export const scaleNutrients = (facts, servings = 1) => Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map(key => [key, round((facts?.[key] || 0) * servings)]));

export function mealMatchesPreferences(mealValue, preferences) {
  const prefs = normalizeNutritionPreferences(preferences);
  if (!prefs || !mealValue || !Array.isArray(mealValue.allergens) || !Array.isArray(mealValue.ingredients) || !known(DIET_OPTIONS, mealValue.diet)) return false;
  if (prefs.diet === 'vegan' && mealValue.diet !== 'vegan') return false;
  if (prefs.diet === 'vegetarian' && mealValue.diet === 'omnivore') return false;
  if (prefs.allergies.some(id => mealValue.allergens.includes(id))) return false;
  const searchable = `${mealValue.name} ${mealValue.ingredients.join(' ')} ${mealValue.allergens.map(id => ALLERGENS.find(item => item.id === id)?.label || id).join(' ')}`.toLocaleLowerCase();
  const excluded = prefs.exclusions.toLocaleLowerCase().split(/[,;\n]/).map(item => item.trim().replace(/s$/, '')).filter(Boolean);
  const aliases = { dairy: ['milk', 'yogurt', 'paneer', 'cheese'], gluten: ['wheat', 'oat', 'barley', 'rye'], seafood: ['fish', 'shellfish', 'tuna', 'salmon'], soybean: ['soy'], strawberry: ['berries'], blueberry: ['berries'], berrie: ['berries'] };
  return !excluded.some(item => (aliases[item] || [item]).some(term => searchable.includes(term)));
}

export function getMealChoices(nutrition, slot) {
  return mealCatalog(nutrition).filter(item => item.slots.includes(slot) && mealMatchesPreferences(item, nutrition?.preferences));
}

export function suggestNutritionWeek(value) {
  const nutrition = normalizeNutrition(value);
  if (!nutrition.preferences) return nutrition.week;
  const goal = nutrition.preferences.goal;
  return Array.from({ length: 7 }, (_, day) => Object.fromEntries(MEAL_SLOTS.map((slot, index) => {
    const choices = getMealChoices(nutrition, slot);
    // Goals adjust ordering, never invent an energy target or restrict portions.
    const ranked = [...choices].sort((a, b) => ['build-muscle', 'body-recomposition'].includes(goal)
      ? b.nutrients.protein - a.nutrients.protein : 0);
    const pool = ['build-muscle', 'body-recomposition'].includes(goal) ? ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.65))) : ranked;
    const selected = pool[(day + index) % (pool.length || 1)];
    return [slot, selected ? { mealId: selected.id, servings: 1 } : null];
  })));
}

export function setNutritionMeal(value, day, slot, entry) {
  const nutrition = normalizeNutrition(value);
  if (!Number.isInteger(day) || day < 0 || day > 6 || !MEAL_SLOTS.includes(slot)) return nutrition;
  if (entry !== null) {
    const candidate = mealCatalog(nutrition).find(item => item.id === entry?.mealId);
    if (!candidate || !candidate.slots.includes(slot) || !mealMatchesPreferences(candidate, nutrition.preferences) || !validServings(entry.servings)) return nutrition;
  }
  nutrition.week[day][slot] = entry ? { mealId: entry.mealId, servings: portion(entry.servings) } : null;
  return nutrition;
}

export function logNutritionMeal(value, date, slot, servings) {
  const nutrition = normalizeNutrition(value);
  if (!validDate(date) || date > nutritionDateKey() || !MEAL_SLOTS.includes(slot)) return nutrition;
  const entry = nutrition.week[nutritionDayIndex(new Date(`${date}T12:00:00`))][slot];
  const selected = entry && mealCatalog(nutrition).find(item => item.id === entry.mealId);
  if (!selected || !mealMatchesPreferences(selected, nutrition.preferences) || nutrition.logs[date]?.[slot]) return nutrition;
  const amount = servings === undefined ? entry.servings : servings;
  if (!validServings(amount)) return nutrition;
  const loggedAmount = portion(amount);
  nutrition.logs[date] = { ...nutrition.logs[date], [slot]: {
    mealId: selected.id, name: selected.name, servings: loggedAmount, nutrients: scaleNutrients(selected.nutrients, loggedAmount),
  } };
  return nutrition;
}

export function removeNutritionLog(value, date, slot) {
  const nutrition = normalizeNutrition(value);
  if (!nutrition.logs[date] || !MEAL_SLOTS.includes(slot)) return nutrition;
  delete nutrition.logs[date][slot];
  if (!Object.keys(nutrition.logs[date]).length) delete nutrition.logs[date];
  return nutrition;
}

export function nutritionTotals(value, date) {
  const nutrition = normalizeNutrition(value);
  const zero = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const sum = (total, facts) => Object.fromEntries(Object.keys(total).map(key => [key, round(total[key] + facts[key])]));
  if (!validDate(date)) return { planned: zero(), logged: zero(), completed: 0 };
  const catalog = mealCatalog(nutrition);
  const planned = Object.values(nutrition.week[nutritionDayIndex(new Date(`${date}T12:00:00`))]).reduce((total, entry) => {
    const selected = entry && catalog.find(item => item.id === entry.mealId);
    return selected ? sum(total, scaleNutrients(selected.nutrients, entry.servings)) : total;
  }, zero());
  const logs = Object.values(nutrition.logs[date] || {});
  return { planned, logged: logs.reduce((total, entry) => sum(total, entry.nutrients), zero()), completed: logs.length };
}
