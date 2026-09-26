import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Apple, ArrowRight, Check, ChevronLeft, ChevronRight, Coffee, Leaf, Pencil, Plus, Repeat2, Settings2, Soup, Sparkles, Sun, Trash2, Utensils, X } from 'lucide-react';
import TouchSelect from './TouchSelect';
import { ALLERGENS, DIET_OPTIONS, MEAL_SLOTS, NUTRITION_GOALS, NUTRITION_SOURCES, getMealChoices, logNutritionMeal, mealCatalog, mealMatchesPreferences, normalizeCustomMeal, normalizeNutrition, normalizeNutritionPreferences, nutritionDateKey, nutritionDayIndex, nutritionTotals, removeNutritionLog, scaleNutrients, setNutritionMeal, suggestNutritionWeek } from '../nutrition';
import './DietPlanner.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_ICONS = { breakfast: Coffee, lunch: Sun, dinner: Soup, snack: Apple };
const titleCase = value => value[0].toUpperCase() + value.slice(1);
const blankPreferences = () => ({ diet: '', goal: '', allergies: [], allergyConfirmed: false, exclusions: '', calorieGoal: '', proteinGoal: '' });
const blankFood = () => ({ name: '', portion: '', ingredients: '', diet: '', allergens: [], allergyConfirmed: false, calories: '', protein: '', carbs: '', fat: '' });
const amountValid = value => String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0.1 && Number(value) <= 20;
const formatNumber = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

function AllergyChoices({ value, confirmed, onChange, legend = 'Foods to avoid', help }) {
  return <fieldset className="diet-allergies"><legend>{legend}</legend>{help && <p>{help}</p>}<div>{ALLERGENS.map(item => <label key={item.id}><input type="checkbox" checked={value.includes(item.id)} onChange={() => onChange(value.includes(item.id) ? value.filter(id => id !== item.id) : [...value, item.id], true)}/><span>{item.label}</span></label>)}</div><button type="button" className="diet-none" aria-pressed={confirmed && value.length === 0} onClick={() => onChange([], true)}><span>{confirmed && !value.length ? <Check size={14}/> : null}</span>None of these</button></fieldset>;
}

function NutritionFacts({ facts, compact = false }) {
  return <div className={`diet-facts${compact ? ' diet-facts--compact' : ''}`}><span><strong>{formatNumber(facts.calories)}</strong> kcal</span><span><strong>{formatNumber(facts.protein)}g</strong> protein</span><span><strong>{formatNumber(facts.carbs)}g</strong> carbs</span><span><strong>{formatNumber(facts.fat)}g</strong> fat</span></div>;
}

export default function DietPlanner({ nutrition, onChange, fitnessGoal }) {
  const data = useMemo(() => normalizeNutrition(nutrition), [nutrition]);
  const uid = useId();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => nutritionDayIndex(new Date()));
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesDraft, setPreferencesDraft] = useState(blankPreferences);
  const [preferenceError, setPreferenceError] = useState('');
  const [editor, setEditor] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState(blankFood);
  const [customError, setCustomError] = useState('');
  const [actualAmounts, setActualAmounts] = useState({});
  const [notice, setNotice] = useState('');
  const preferencesRef = useRef(null);
  const editorRef = useRef(null);
  const customRef = useRef(null);
  const dates = useMemo(() => {
    const start = new Date(); start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - nutritionDayIndex(start) + weekOffset * 7);
    return DAYS.map((_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  }, [weekOffset]);
  const date = dates[selectedDay];
  const dateKey = nutritionDateKey(date);
  const todayKey = nutritionDateKey();
  const future = dateKey > todayKey;
  const catalog = mealCatalog(data);
  const totals = nutritionTotals(data, dateKey);
  const planned = data.week[selectedDay];
  const currentGoal = typeof fitnessGoal === 'object' ? fitnessGoal?.label : typeof fitnessGoal === 'string' ? fitnessGoal.replaceAll('-', ' ') : '';
  const preferenceLabel = DIET_OPTIONS.find(item => item.id === data.preferences?.diet)?.label;

  useEffect(() => { if (preferencesOpen) preferencesRef.current?.focus({ preventScroll: true }); }, [preferencesOpen]);
  useEffect(() => { if (editor) editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }); }, [editor?.slot]);
  useEffect(() => { if (customOpen) { customRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); customRef.current?.focus({ preventScroll: true }); } }, [customOpen]);
  useEffect(() => { setActualAmounts({}); setEditor(null); }, [dateKey]);

  const update = action => onChange(previous => action(normalizeNutrition(previous)));

  function openPreferences() {
    setPreferencesDraft(data.preferences ? { ...data.preferences, calorieGoal: data.preferences.calorieGoal ?? '', proteinGoal: data.preferences.proteinGoal ?? '' } : blankPreferences());
    setPreferenceError(''); setPreferencesOpen(true); setEditor(null); setCustomOpen(false);
  }

  function savePreferences(event) {
    event.preventDefault();
    const draft = { ...preferencesDraft, calorieGoal: preferencesDraft.calorieGoal === '' ? null : Number(preferencesDraft.calorieGoal), proteinGoal: preferencesDraft.proteinGoal === '' ? null : Number(preferencesDraft.proteinGoal) };
    const valid = normalizeNutritionPreferences(draft);
    if (!valid || (draft.calorieGoal !== null && (!Number.isFinite(draft.calorieGoal) || draft.calorieGoal <= 0 || draft.calorieGoal > 10000)) || (draft.proteinGoal !== null && (!Number.isFinite(draft.proteinGoal) || draft.proteinGoal <= 0 || draft.proteinGoal > 1000))) {
      setPreferenceError('Choose your eating style and goal, review the allergy choices, and check any optional targets.'); return;
    }
    update(previous => ({ ...previous, preferences: valid }));
    setPreferencesOpen(false); setNotice('Preferences saved. You can now choose meals or generate suggestions.');
  }

  function suggest() {
    update(previous => {
      const suggestions = suggestNutritionWeek(previous);
      return { ...previous, week: previous.week.map((day, index) => Object.fromEntries(MEAL_SLOTS.map(slot => {
        return [slot, day[slot] || suggestions[index][slot]];
      }))) };
    });
    const suggestions = suggestNutritionWeek(data);
    const added = data.week.reduce((count, day, index) => count + MEAL_SLOTS.filter(slot => !day[slot] && suggestions[index][slot]).length, 0);
    const unmatched = MEAL_SLOTS.filter(slot => !getMealChoices(data, slot).length);
    setNotice(added ? `${added} empty meal slots filled. Review portions and adjust your week.${unmatched.length ? ` No matching ${unmatched.join(', ')} options; those slots stay empty.` : ''}` : unmatched.length ? 'No matching suggestions for your restrictions. Add a custom food with ingredients you have checked.' : 'Your week is already filled. Remove a meal first to suggest something new.');
  }

  function openEditor(slot) {
    setEditor({ slot, mealId: planned[slot]?.mealId || '', servings: planned[slot]?.servings ?? '1' });
    setCustomOpen(false); setNotice('');
  }

  function saveMeal(event) {
    event.preventDefault();
    if (!editor?.mealId || !amountValid(editor.servings)) return;
    update(previous => setNutritionMeal(previous, selectedDay, editor.slot, { mealId: editor.mealId, servings: Number(editor.servings) }));
    setNotice(`${titleCase(editor.slot)} saved for every ${DAYS[selectedDay]}. Logged meals stay unchanged.`);
    setEditor(null);
  }

  function openCustom(food) {
    setCustomDraft(food ? { ...food, ingredients: food.ingredients.join(', '), ...food.nutrients } : blankFood());
    setCustomError(''); setCustomOpen(true);
  }

  function saveCustom(event) {
    event.preventDefault();
    const values = ['calories', 'protein', 'carbs', 'fat'];
    if (values.some(key => customDraft[key] === '' || !Number.isFinite(Number(customDraft[key])) || Number(customDraft[key]) < 0 || Number(customDraft[key]) > 10000)) {
      setCustomError('Enter all four nutrition values per portion. Use 0 where the label shows zero.'); return;
    }
    const candidate = normalizeCustomMeal({ ...customDraft, id: customDraft.id || `custom-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, ingredients: customDraft.ingredients.split(/[,;\n]/).map(item => item.trim()).filter(Boolean), nutrients: Object.fromEntries(values.map(key => [key, Number(customDraft[key])])) });
    if (!candidate) { setCustomError('Add a food name, portion description, ingredients and eating style, then review its allergens.'); return; }
    if (editor && !mealMatchesPreferences(candidate, data.preferences)) { setCustomError('This food conflicts with your saved preferences. Check its ingredients and allergens or update your preferences.'); return; }
    update(previous => {
      const next = { ...previous, customMeals: [...previous.customMeals.filter(item => item.id !== candidate.id), candidate] };
      return editor ? setNutritionMeal(next, selectedDay, editor.slot, { mealId: candidate.id, servings: 1 }) : next;
    });
    setNotice(editor ? `${candidate.name} saved and added to ${DAYS[selectedDay]} ${editor.slot}.` : `${candidate.name} saved to your foods.`);
    setCustomOpen(false); setEditor(null);
  }

  return <div className="diet-planner">
    <header className="diet-page-heading"><div><p>Good food. A steady routine.</p><h1>Fuel your progress</h1></div>{data.preferences && <button className="diet-icon-button" onClick={openPreferences} aria-label="Edit food preferences"><Settings2 size={21}/></button>}</header>
    {!data.preferences && !preferencesOpen && <section className="diet-welcome"><div className="diet-plate" aria-hidden="true"><Leaf size={32}/><span/><i/></div><span className="diet-eyebrow">A PLAN THAT FITS YOUR LIFE</span><h2>Your food, your rhythm.</h2><p>Choose how you eat, build a repeatable week, and log meals as you go. Start with your preferences.</p><button className="diet-primary" onClick={openPreferences}>Set up my food preferences <ArrowRight size={18}/></button><small>Your plan starts empty. Everything stays on this device.</small></section>}

    {preferencesOpen && <form className="diet-form-card" onSubmit={savePreferences} noValidate><div className="diet-card-title"><div><span className="diet-eyebrow">MAKE IT YOURS</span><h2 ref={preferencesRef} tabIndex={-1}>Food preferences</h2></div><button type="button" className="diet-icon-button" onClick={() => setPreferencesOpen(false)} aria-label="Close food preferences"><X size={20}/></button></div>
      {currentGoal && <p className="diet-context">Your fitness focus: <strong>{currentGoal}</strong>. Choose your food goal below.</p>}
      <label htmlFor={`${uid}-diet`}>How do you eat?<TouchSelect id={`${uid}-diet`} value={preferencesDraft.diet} onChange={event => setPreferencesDraft(previous => ({ ...previous, diet: event.target.value }))}><option value="" disabled>Choose an eating style</option>{DIET_OPTIONS.map(item => <option value={item.id} key={item.id}>{item.label} · {item.detail}</option>)}</TouchSelect></label>
      <label htmlFor={`${uid}-goal`}>What would you like to support?<TouchSelect id={`${uid}-goal`} value={preferencesDraft.goal} onChange={event => setPreferencesDraft(previous => ({ ...previous, goal: event.target.value }))}><option value="" disabled>Choose a food goal</option>{NUTRITION_GOALS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</TouchSelect></label>
      <AllergyChoices value={preferencesDraft.allergies} confirmed={preferencesDraft.allergyConfirmed} onChange={(allergies, allergyConfirmed) => setPreferencesDraft(previous => ({ ...previous, allergies, allergyConfirmed }))} legend="Allergies & ingredients to avoid" help="Select every relevant ingredient, or choose None of these."/>
      <label htmlFor={`${uid}-exclude`}>Other foods to exclude <span>Optional</span><textarea id={`${uid}-exclude`} value={preferencesDraft.exclusions} maxLength={500} placeholder="e.g. mushroom, onion, lentil" onChange={event => setPreferencesDraft(previous => ({ ...previous, exclusions: event.target.value }))}/><small>Separate foods with commas. Matches are based on meal names and listed ingredients.</small></label>
      <fieldset className="diet-targets"><legend>Your daily targets <span>Optional</span></legend><p>Enter your own targets if you use them. Suggestions do not calculate a calorie deficit or set a daily requirement.</p><div><label htmlFor={`${uid}-calories`}>Calories (kcal)<input id={`${uid}-calories`} inputMode="numeric" type="number" min="1" max="10000" placeholder="Your target" value={preferencesDraft.calorieGoal} onChange={event => setPreferencesDraft(previous => ({ ...previous, calorieGoal: event.target.value }))}/></label><label htmlFor={`${uid}-protein`}>Protein (g)<input id={`${uid}-protein`} inputMode="decimal" type="number" min="1" max="1000" step="0.1" placeholder="Your target" value={preferencesDraft.proteinGoal} onChange={event => setPreferencesDraft(previous => ({ ...previous, proteinGoal: event.target.value }))}/></label></div></fieldset>
      <p className="diet-help">Ingredient filters cannot check manufacturing cross-contact. Check food labels and preparation for your allergies.</p>
      {preferenceError && <p className="diet-error" role="alert">{preferenceError}</p>}<div className="diet-form-actions"><button type="button" className="diet-secondary" onClick={() => setPreferencesOpen(false)}>Cancel</button><button type="submit" className="diet-primary">Save preferences <Check size={17}/></button></div>
    </form>}

    {data.preferences && !preferencesOpen && <>
      <div className="diet-preference-summary"><span><Leaf size={16}/>{preferenceLabel}</span><span>{NUTRITION_GOALS.find(item => item.id === data.preferences.goal)?.label}</span></div>
      <section className="diet-week" aria-label="Meal planning week"><div className="diet-week-heading"><div><strong>{weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : weekOffset === 1 ? 'Next week' : 'Your week'}</strong><span>{dates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div><div><button aria-label="Previous meal week" onClick={() => setWeekOffset(value => value - 1)}><ChevronLeft size={18}/></button><button className="diet-today" onClick={() => { setWeekOffset(0); setSelectedDay(nutritionDayIndex(new Date())); }}>Today</button><button aria-label="Next meal week" onClick={() => setWeekOffset(value => value + 1)}><ChevronRight size={18}/></button></div></div><div className="diet-week-days">{dates.map((item, index) => <button key={nutritionDateKey(item)} aria-label={item.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} aria-pressed={index === selectedDay} aria-current={nutritionDateKey(item) === todayKey ? 'date' : undefined} onClick={() => setSelectedDay(index)}><span>{DAYS[index].slice(0, 3)}</span><strong>{item.getDate()}</strong><i className={Object.keys(data.logs[nutritionDateKey(item)] || {}).length ? 'has-meals' : ''}/></button>)}</div></section>
      <section className="diet-daily-summary" aria-label="Daily nutrition summary"><div className="diet-summary-heading"><div><span className="diet-eyebrow">{dateKey === todayKey ? 'TODAY' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}</span><h2>A little more mindful.</h2></div><span>{totals.completed} / 4 logged</span></div><div className="diet-calorie-total"><strong>{formatNumber(totals.logged.calories)}</strong><span>kcal logged{data.preferences.calorieGoal && <small>of your {formatNumber(data.preferences.calorieGoal)} kcal target</small>}</span></div><div className="diet-summary-comparison"><span>Planned <strong>{formatNumber(totals.planned.calories)} kcal</strong></span><span>Protein <strong>{formatNumber(totals.logged.protein)} / {formatNumber(totals.planned.protein)} g</strong><small>logged / planned{data.preferences.proteinGoal ? ` · target ${formatNumber(data.preferences.proteinGoal)} g` : ''}</small></span></div><details className="diet-macro-details"><summary>Carbs & fats</summary><p>Carbs: {formatNumber(totals.logged.carbs)} / {formatNumber(totals.planned.carbs)} g · Fat: {formatNumber(totals.logged.fat)} / {formatNumber(totals.planned.fat)} g <span>(logged / planned)</span></p></details></section>
      <div className="diet-plan-heading"><div><h2>{DAYS[selectedDay]} meals</h2><p><Repeat2 size={13}/>Your choices repeat each week</p></div><button className="diet-suggest" onClick={suggest}><Sparkles size={16}/><span>Suggest meals</span></button></div><p className="diet-small-note">Suggestions fill empty slots across your week. Your existing choices stay.</p>
      <div className="diet-meals">{MEAL_SLOTS.map(slot => {
        const entry = planned[slot]; const item = entry && catalog.find(food => food.id === entry.mealId); const logged = data.logs[dateKey]?.[slot]; const Icon = SLOT_ICONS[slot]; const matches = item && mealMatchesPreferences(item, data.preferences); const amount = actualAmounts[slot] ?? entry?.servings ?? 1;
        return <section className={`diet-meal-card${logged ? ' is-logged' : ''}`} key={slot} aria-label={`${titleCase(slot)} plan`}><div className="diet-meal-top"><span className={`diet-meal-icon diet-meal-icon--${slot}`}><Icon size={19}/></span><h3>{titleCase(slot)}</h3><button className="diet-icon-button" aria-label={`${item ? 'Edit' : 'Choose'} ${slot} meal`} onClick={() => openEditor(slot)}>{item ? <Pencil size={17}/> : <Plus size={20}/>}</button></div>
          {item ? <><h4>{item.name}</h4><p className="diet-portion">{formatNumber(entry.servings)} portion{entry.servings === 1 ? '' : 's'} · {item.portion}</p><NutritionFacts facts={scaleNutrients(item.nutrients, entry.servings)} compact/><details className="diet-ingredients"><summary>Ingredients & allergens</summary><p>{item.ingredients.join(', ')}.</p><p>{item.allergens.length ? `Contains: ${item.allergens.map(id => ALLERGENS.find(allergen => allergen.id === id)?.label).join(', ')}.` : 'No listed major allergens in these ingredients.'} Check labels and preparation.</p></details>{!matches && <p className="diet-error">This meal no longer matches your preferences. Choose a replacement before logging.</p>}</> : <button className="diet-add-meal" onClick={() => openEditor(slot)}><Plus size={17}/>Choose a meal for {slot}</button>}
          {logged ? <div className="diet-logged"><span><Check size={16}/><span><strong>Logged {formatNumber(logged.servings)} portion{logged.servings === 1 ? '' : 's'}</strong><small>{logged.name} · {formatNumber(logged.nutrients.calories)} kcal</small></span></span><button onClick={() => { update(previous => removeNutritionLog(previous, dateKey, slot)); setNotice(`${titleCase(slot)} log removed for this date.`); }} aria-label={`Undo ${slot} log`}>Undo</button></div> : item && !future && <div className="diet-log-actions"><label htmlFor={`${uid}-${slot}-eaten`}>Portions eaten<input id={`${uid}-${slot}-eaten`} type="number" min="0.1" max="20" step="0.01" inputMode="decimal" value={amount} onChange={event => setActualAmounts(previous => ({ ...previous, [slot]: event.target.value }))}/></label><button className="diet-log-button" disabled={!matches || !amountValid(amount)} onClick={() => { update(previous => logNutritionMeal(previous, dateKey, slot, Number(amount))); setNotice(`${titleCase(slot)} logged for ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`); }}><Check size={16}/>Log eaten</button></div>}
          {editor?.slot === slot && <form ref={editorRef} className="diet-meal-editor" onSubmit={saveMeal}><div className="diet-card-title"><h4>Plan every {DAYS[selectedDay]}</h4><button type="button" className="diet-icon-button" aria-label="Close meal editor" onClick={() => { setEditor(null); setCustomOpen(false); }}><X size={18}/></button></div><label htmlFor={`${uid}-meal`}>Choose a {slot} meal<TouchSelect id={`${uid}-meal`} value={editor.mealId} onChange={event => setEditor(previous => ({ ...previous, mealId: event.target.value }))}><option value="" disabled>Choose a meal</option>{getMealChoices(data, slot).map(food => <option key={food.id} value={food.id}>{food.name} · {food.nutrients.protein}g protein</option>)}</TouchSelect></label>{!getMealChoices(data, slot).length && <p className="diet-help">No meals match these preferences. Add a food you have checked, or edit your preferences.</p>}
            {catalog.find(food => food.id === editor.mealId) && <p className="diet-help">One portion: {catalog.find(food => food.id === editor.mealId).portion}.</p>}<label htmlFor={`${uid}-servings`}>Planned portions<input id={`${uid}-servings`} type="number" min="0.1" max="20" step="0.01" inputMode="decimal" value={editor.servings} onChange={event => setEditor(previous => ({ ...previous, servings: event.target.value }))}/></label><div className="diet-form-actions"><button type="button" className="diet-secondary" onClick={() => openCustom()}>Add custom food</button><button type="submit" className="diet-primary" disabled={!editor.mealId || !amountValid(editor.servings) || !mealMatchesPreferences(catalog.find(food => food.id === editor.mealId), data.preferences)}>Save meal</button></div>{item && <button type="button" className="diet-remove" onClick={() => { update(previous => setNutritionMeal(previous, selectedDay, slot, null)); setEditor(null); setNotice(`${titleCase(slot)} removed from your weekly plan. Existing logs are kept.`); }}><Trash2 size={15}/>Remove recurring meal</button>}</form>}
        </section>;
      })}</div>
      {future && <p className="diet-help diet-future-note">Plan ahead here. Meal logging becomes available on the selected date.</p>}
      <details className="diet-custom-library"><summary><span><Utensils size={18}/>Your custom foods</span><span>{data.customMeals.length}</span></summary><div>{data.customMeals.length ? data.customMeals.map(food => <div className="diet-custom-row" key={food.id}><div><strong>{food.name}</strong><small>{food.portion}</small></div><button className="diet-icon-button" onClick={() => { setEditor(null); openCustom(food); }} aria-label={`Edit ${food.name}`}><Pencil size={16}/></button><button className="diet-icon-button" onClick={() => { update(previous => normalizeNutrition({ ...previous, customMeals: previous.customMeals.filter(item => item.id !== food.id) })); setNotice(`${food.name} removed from saved foods and weekly meals. Logs are kept.`); }} aria-label={`Remove ${food.name}`}><Trash2 size={16}/></button></div>) : <p>Save foods from a package label or your own recipe.</p>}<button className="diet-secondary" onClick={() => { setEditor(null); openCustom(); }}><Plus size={17}/>Add a custom food</button><small>Removing a food also clears it from the weekly plan. Logged meals stay saved.</small></div></details>
      {customOpen && <form className="diet-form-card diet-custom-form" onSubmit={saveCustom} noValidate><div className="diet-card-title"><div><span className="diet-eyebrow">YOUR OWN RECIPE OR LABEL</span><h2 ref={customRef} tabIndex={-1}>{customDraft.id ? 'Edit food' : 'Add a custom food'}</h2></div><button type="button" className="diet-icon-button" onClick={() => setCustomOpen(false)} aria-label="Close custom food form"><X size={19}/></button></div><label htmlFor={`${uid}-food-name`}>Food name<input id={`${uid}-food-name`} value={customDraft.name} maxLength={90} placeholder="e.g. My lentil soup" onChange={event => setCustomDraft(previous => ({ ...previous, name: event.target.value }))}/></label><label htmlFor={`${uid}-portion`}>What is one portion?<input id={`${uid}-portion`} value={customDraft.portion} maxLength={180} placeholder="e.g. 1 bowl, 250 g" onChange={event => setCustomDraft(previous => ({ ...previous, portion: event.target.value }))}/></label><label htmlFor={`${uid}-ingredients`}>Ingredients<textarea id={`${uid}-ingredients`} value={customDraft.ingredients} maxLength={1500} placeholder="List every ingredient, separated by commas" onChange={event => setCustomDraft(previous => ({ ...previous, ingredients: event.target.value }))}/></label><label htmlFor={`${uid}-food-diet`}>This food is<TouchSelect id={`${uid}-food-diet`} value={customDraft.diet} onChange={event => setCustomDraft(previous => ({ ...previous, diet: event.target.value }))}><option value="" disabled>Choose an eating style</option>{DIET_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</TouchSelect></label><fieldset className="diet-custom-nutrients"><legend>Nutrition per portion</legend><p>Copy values from your food label or recipe calculation. All four fields are required.</p><div>{[{ id: 'calories', label: 'Calories (kcal)' }, { id: 'protein', label: 'Protein (g)' }, { id: 'carbs', label: 'Carbs (g)' }, { id: 'fat', label: 'Fat (g)' }].map(item => <label key={item.id} htmlFor={`${uid}-custom-${item.id}`}>{item.label}<input id={`${uid}-custom-${item.id}`} type="number" inputMode="decimal" min="0" max="10000" step="0.1" value={customDraft[item.id]} placeholder="Enter value" onChange={event => setCustomDraft(previous => ({ ...previous, [item.id]: event.target.value }))}/></label>)}</div></fieldset><AllergyChoices legend="Allergens in this food" help="Review the label and every ingredient. Select all that apply." value={customDraft.allergens} confirmed={customDraft.allergyConfirmed} onChange={(allergens, allergyConfirmed) => setCustomDraft(previous => ({ ...previous, allergens, allergyConfirmed }))}/>{customError && <p role="alert" className="diet-error">{customError}</p>}<div className="diet-form-actions"><button type="button" className="diet-secondary" onClick={() => setCustomOpen(false)}>Cancel</button><button type="submit" className="diet-primary">{editor ? 'Save food & add' : 'Save food'}<Check size={16}/></button></div></form>}
      <p className="diet-estimate-note">Nutrition values are estimates for the portions shown. Meal ideas are a starting point, not a complete daily nutrition prescription. Adjust portions and add your own foods as needed.</p><details className="diet-source-details"><summary>About the nutrition estimates</summary><p>Generic food composition references inform these rounded estimates. Brands, preparation and portion sizes change the values. Custom foods use the numbers you enter.</p><div>{NUTRITION_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowRight size={13}/></a>)}</div></details>
    </>}
    <p className="diet-notice" role="status" aria-live="polite">{notice}</p>
  </div>;
}
