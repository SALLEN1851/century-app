'use client'

import { useEffect, useMemo, useState } from 'react'
import { Disclosure } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { fullDayNutrition, Tone } from '@/lib/grava/nutrition'

/* =========================================================
   Utils
========================================================= */
function cyrb128(str: string) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [(h1^h2)>>>0, (h3^h4)>>>0, (h1^h3)>>>0, (h2^h4)>>>0]
}
function sfc32(a:number,b:number,c:number,d:number){return function(){a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;t=(t+d)|0;d=(d+1)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);c=(c+t)|0;return (t>>>0)/4294967296}}
function seededRng(seed: string){const s=cyrb128(seed);return sfc32(s[0],s[1],s[2],s[3])}

/* =========================================================
   Types
========================================================= */
type Diet = 'omnivore'|'vegetarian'|'vegan'|'pescatarian'
type CalorieBias = 'maintain'|'cut'|'surplus'

type DayPlan = {
  day: string
  tone: Tone
  miles?: number
  durH?: number
  elev?: number
}

type Ingredient = {
  name: string
  portion: string
  grams?: number
  ml?: number
  kcal: number
  carbs_g: number
  protein_g: number
  fat_g: number
  section?: string
}

type Meal = {
  name: string
  kcal: number
  carbs_g: number
  protein_g: number
  fat_g: number
  notes?: string
  ingredients?: Ingredient[]
}

type DayMeals = {
  kcalTarget: number
  carbs_g: number
  protein_g: number
  fat_g: number
  meals: Meal[]
  rideFuel?: { duringCHO_g: number; fluids_L: number; sodium_mg: number; preCHO_g: number; postCHO_g: number; postPRO_g?: number }
}

type Props = {
  weekPlan?: DayPlan[]
  whoopData?: any
  goal?: any
  bodyKg?: number
  className?: string
  defaultOpen?: boolean
}

/* =========================================================
   Macro helper (fill remaining kcal with carbs)
========================================================= */
function macroTargets({
  kcal, bodyKg, tone,
}: { kcal: number; bodyKg: number; tone: 'easy'|'moderate'|'hard'|'rest' }) {
  const protein_g = Math.round(bodyKg * 1.8)
  const fat_g = Math.round(bodyKg * (tone === 'hard' ? 0.7 : 0.8))
  const kcal_pf = protein_g * 4 + fat_g * 9
  const carbs_g = Math.max(0, Math.round((kcal - kcal_pf) / 4))
  return { carbs_g, protein_g, fat_g }
}

/* =========================================================
   Minimal nutrient table (per 100 g unless noted)
========================================================= */
const NUTR: Record<string, { kcal: number; C: number; P: number; F: number; section?: string }> = {
  'cooked rice': { kcal: 130, C: 28, P: 2.7, F: 0.3, section: 'Pantry' },
  'cooked pasta': { kcal: 157, C: 30, P: 5.8, F: 0.9, section: 'Pantry' },
  'baked potato': { kcal: 93, C: 21, P: 2.5, F: 0.1, section: 'Produce' },
  'chicken breast (cooked)': { kcal: 165, C: 0, P: 31, F: 3.6, section: 'Meat/Seafood' },
  'salmon (cooked)': { kcal: 208, C: 0, P: 22, F: 13, section: 'Meat/Seafood' },
  'tofu firm': { kcal: 144, C: 3, P: 17, F: 9, section: 'Plant Protein' },
  'tempeh': { kcal: 195, C: 9, P: 20, F: 11, section: 'Plant Protein' },
  'eggs': { kcal: 155, C: 1.1, P: 13, F: 11, section: 'Dairy/Eggs' },
  'greek yogurt nonfat': { kcal: 59, C: 3.6, P: 10.3, F: 0.4, section: 'Dairy/Eggs' },
  'olive oil': { kcal: 884, C: 0, P: 0, F: 100, section: 'Pantry' },
  'avocado': { kcal: 160, C: 9, P: 2, F: 15, section: 'Produce' },
  'broccoli': { kcal: 35, C: 7, P: 2.4, F: 0.4, section: 'Produce' },
  'mixed greens': { kcal: 20, C: 4, P: 1.5, F: 0.2, section: 'Produce' },
}
const PROTEINS: Record<Diet, string[]> = {
  omnivore: ['chicken breast (cooked)','salmon (cooked)','eggs','greek yogurt nonfat'],
  pescatarian: ['salmon (cooked)','eggs','greek yogurt nonfat'],
  vegetarian: ['eggs','greek yogurt nonfat','tofu firm','tempeh'],
  vegan: ['tofu firm','tempeh'],
}
const CARBS = ['cooked rice','cooked pasta','baked potato']
const VEG = ['broccoli','mixed greens']

/* Turn macros into ingredients with portions (grams) */
function composeIngredientsFromMacros({
  mealMacros, diet,
}: {
  mealMacros: { carbs_g: number; protein_g: number; fat_g: number; kcal: number }
  diet: Diet
}): Ingredient[] {
  const protein = PROTEINS[diet][0]
  const carb = CARBS[0]
  const veg = VEG[0]
  const fat = 'olive oil'

  const p100 = NUTR[protein], c100 = NUTR[carb], f100 = NUTR[fat], v100 = NUTR[veg]
  const wantP = Math.max(0, mealMacros.protein_g)
  const wantC = Math.max(0, mealMacros.carbs_g)
  const wantF = Math.max(0, mealMacros.fat_g)

  const gP = p100.P ? (wantP / p100.P) * 100 : 0
  const gC = c100.C ? (wantC / c100.C) * 100 : 0
  const gF = f100.F ? (wantF / f100.F) * 100 : 0
  const gV = 120 // fixed veg portion

  function ingRow(name: string, grams: number): Ingredient {
    const t = NUTR[name]
    const ratio = grams / 100
    const C = +(t.C * ratio).toFixed(1)
    const P = +(t.P * ratio).toFixed(1)
    const F = +(t.F * ratio).toFixed(1)
    const kcal = Math.round(C*4 + P*4 + F*9)
    return { name, portion: `${Math.round(grams)} g`, grams: Math.round(grams), kcal, carbs_g: C, protein_g: P, fat_g: F, section: t.section }
  }

  const out = [
    ingRow(carb, gC),
    ingRow(protein, gP),
    ingRow(fat, Math.max(5, gF)),
    ingRow(veg, gV),
  ]

  // nudge carbs if kcal off by >10%
  const kcalSum = out.reduce((a,b)=>a+b.kcal,0)
  if (mealMacros.kcal > 0) {
    const diff = mealMacros.kcal - kcalSum
    if (Math.abs(diff) > mealMacros.kcal * 0.1) {
      const addC = Math.max(0, diff / 4)
      const extraG = (addC / NUTR[carb].C) * 100
      const target = out[0]
      target.grams = Math.round((target.grams ?? 0) + extraG)
      const r = (target.grams ?? 0) / 100
      target.carbs_g = +(NUTR[carb].C * r).toFixed(1)
      target.protein_g = +(NUTR[carb].P * r).toFixed(1)
      target.fat_g = +(NUTR[carb].F * r).toFixed(1)
      target.kcal = Math.round(target.carbs_g*4 + target.protein_g*4 + target.fat_g*9)
      target.portion = `${target.grams} g`
    }
  }
  return out
}

/* Generate a friendly meal name from selected sources */
function synthMealName(diet: Diet, seed: string) {
  const rnd = seededRng(`name:${diet}:${seed}`)
  const p = PROTEINS[diet][Math.floor(rnd()*PROTEINS[diet].length)]
  const c = CARBS[Math.floor(rnd()*CARBS.length)]
  const v = VEG[Math.floor(rnd()*VEG.length)]
  const pLabel = p.replace(/\s*\(cooked\)/i,'')
  const forms = [
    `${capitalize(pLabel)} & ${c.replace('cooked ','')} bowl`,
    `${capitalize(pLabel)} with ${v}`,
    `${capitalize(c.replace('cooked ',''))} plate with ${pLabel}`,
    `${capitalize(pLabel)} wrap (with ${v})`,
  ]
  return forms[Math.floor(rnd()*forms.length)]
}
function capitalize(s:string){return s.charAt(0).toUpperCase()+s.slice(1)}

/* =========================================================
   Component
========================================================= */
export default function GravaMealsPlanner({
  weekPlan, whoopData, goal, bodyKg = 75, className = '', defaultOpen = false,
}: Props) {
  const [diet, setDiet] = useState<Diet>('omnivore')
  const [mealsPerDay, setMealsPerDay] = useState(4)
  const [calorieBias, setCalorieBias] = useState<CalorieBias>('maintain')
  const [exclude, setExclude] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<Record<string, DayMeals> | null>(null)

  // Walmart lookup state
  const [wm, setWm] = useState<Record<string, { title:string; price:number|null; image:string|null; url:string|null }[]>>({})

  // Combined shopping plan state (fuel + food)
  const [shopping, setShopping] = useState<{ items: Array<{ item: string; qty: string; section: string }> } | null>(null)

  // hydrate prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem('grava.mealprefs')
      if (raw) {
        const j = JSON.parse(raw)
        if (j.diet) setDiet(j.diet)
        if (j.mealsPerDay) setMealsPerDay(j.mealsPerDay)
        if (j.calorieBias) setCalorieBias(j.calorieBias)
        if (typeof j.exclude === 'string') setExclude(j.exclude)
      }
    } catch {}
  }, [])
  useEffect(() => {
    localStorage.setItem('grava.mealprefs', JSON.stringify({ diet, mealsPerDay, calorieBias, exclude }))
  }, [diet, mealsPerDay, calorieBias, exclude])

  // Training week (fallback shape)
  const week: DayPlan[] = useMemo(() => {
    if (Array.isArray(weekPlan) && weekPlan.length) return weekPlan
    const tones: Tone[] = ['easy','moderate','moderate','moderate','easy','hard','rest']
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    return days.map((d, i) => ({
      day: d,
      tone: tones[i],
      miles: Math.round([15,22,18,22,15,35,0][i]),
      elev: Math.round(([15,22,18,22,15,35,0][i]) * (tones[i]==='hard'?95:80)),
    }))
  }, [weekPlan, whoopData])

  // Generate plan (AI -> fallback)
  async function generate() {
    setLoading(true); setError(null); setShopping(null); setWm({})
    try {
      const nutri = week.map(d => ({
        day: d.day,
        ...fullDayNutrition({ miles: d.miles || 0, elevFt: d.elev || 0, tone: d.tone, bodyKg }),
      }))

      // Try AI endpoint if present
      const r = await fetch('/api/coach/meals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          week, goal,
          prefs: { diet, mealsPerDay, calorieBias, exclude, bodyKg },
          rideNutrition: nutri,
        }),
      })

      if (r.ok) {
        const j = await r.json()
        if (j?.plan) {
          setPlan(attachRideFuelToPlan(j.plan, nutri))
          setLoading(false)
          return
        }
      }

      // Fallback
      setPlan(buildFallbackMealPlan({ week, diet, mealsPerDay, calorieBias, exclude, bodyKg, nutri }))
    } catch (e: any) {
      setPlan(buildFallbackMealPlan({
        week, diet, mealsPerDay, calorieBias, exclude, bodyKg,
        nutri: week.map(d => ({ day: d.day, ...fullDayNutrition({ miles: d.miles||0, elevFt: d.elev||0, tone: d.tone, bodyKg }) })),
      }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [
    JSON.stringify(week), diet, mealsPerDay, calorieBias, exclude, bodyKg
  ])

  const grocery = useMemo(() => (plan ? buildGroceryList(plan) : []), [plan])

  // Combined shopping (fuel + food)
  function generateShoppingPlan() {
    if (!plan) return
    const fuel = buildFuelingShopping(plan)
    const food = grocery.map(g => ({ ...g, section: 'Food' }))
    const combined = [...fuel, ...food]
    setShopping({ items: combined })
  }

  // Walmart search for each grocery item (via your server proxy)
  async function findAtWalmart() {
    if (!grocery.length) return
    const clean = (s: string) => s.replace(/[\(\)]/g,'').trim()
    const lookups = await Promise.allSettled(
      grocery.map(async g => {
        const r = await fetch(`/api/walmart/search?q=${encodeURIComponent(clean(g.item))}&size=3`, { next: { revalidate: 60 } as any })
        if (!r.ok) throw new Error('search failed')
        const j = await r.json()
        return [g.item, j.results] as const
      })
    )
    const map: typeof wm = {}
    for (const res of lookups) {
      if (res.status === 'fulfilled') {
        const [key, arr] = res.value
        map[key] = (arr || []).map((x: any) => ({
          title: x.title, price: x.price ?? null, image: x.image ?? null, url: x.url ?? null,
        }))
      }
    }
    setWm(map)
  }

  return (
    <section className={`rounded-2xl border border-stone-200/60 dark:border-stone-800/70 p-5 bg-white/60 dark:bg-stone-950/40 backdrop-blur ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">AI Meal Plan (7 days)</h3>
          <p className="text-xs text-stone-500">Synced with training (pre/during/post) + goals</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => generate()} className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
            {loading ? 'Thinking…' : 'Regenerate'}
          </button>
          <button onClick={() => copyGrocery(grocery)} className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800">
            Copy grocery list
          </button>
          <button onClick={() => downloadJSON('grava-meal-plan.json', plan)} className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800">
            Download JSON
          </button>
          <button onClick={generateShoppingPlan} disabled={!plan}
                  className="rounded-md bg-stone-800 text-white px-3 py-1.5 text-xs dark:bg-stone-100 dark:text-stone-900 disabled:opacity-50">
            Generate shopping plan (week)
          </button>
          <button onClick={findAtWalmart} disabled={!grocery.length || loading}
                  className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50">
            Find at Walmart
          </button>
        </div>
      </div>

      {/* Prefs */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
        <div>
          <label className="text-[11px] text-stone-500">Diet</label>
          <select value={diet} onChange={e=>setDiet(e.target.value as Diet)} className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2">
            <option value="omnivore">Omnivore</option><option value="pescatarian">Pescatarian</option>
            <option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone-500">Meals per day</label>
          <select value={mealsPerDay} onChange={e=>setMealsPerDay(Number(e.target.value))} className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2">
            {[3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone-500">Calorie bias</label>
          <select value={calorieBias} onChange={e=>setCalorieBias(e.target.value as CalorieBias)} className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2">
            <option value="maintain">Maintain</option><option value="cut">Cut (−10–15%)</option><option value="surplus">Surplus (+10%)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-stone-500">Exclude (comma-separated)</label>
          <input value={exclude} onChange={e=>setExclude(e.target.value)} placeholder="e.g., mushrooms, shellfish, peanuts"
                 className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-stone-100/70 dark:bg-stone-900/60 px-3 py-2" />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Days */}
      {!plan ? (
        <div className="rounded-lg border border-stone-200/60 dark:border-stone-800/70 p-3 text-sm">Preparing…</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(plan).map(([day, m]) => (
            <Disclosure key={day} defaultOpen={defaultOpen}>
              {({ open }) => (
                <div className="rounded-xl border border-stone-200/60 dark:border-stone-800/70 bg-white/60 dark:bg-stone-900/50">
                  <Disclosure.Button className="w-full px-4 py-3 text-left">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{day}</div>
                        <div className="text-[11px] text-stone-500">
                          Target: {Math.round(m.kcalTarget)} kcal • {Math.round(m.carbs_g)}g C • {Math.round(m.protein_g)}g P • {Math.round(m.fat_g)}g F
                        </div>
                        {m.rideFuel && (
                          <div className="text-[11px] text-stone-500">
                            Ride fueling: {Math.round(m.rideFuel.duringCHO_g)}g CHO • {m.rideFuel.fluids_L.toFixed(1)} L • {Math.round(m.rideFuel.sodium_mg)} mg Na
                          </div>
                        )}
                      </div>
                      <ChevronDownIcon className={`size-4 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </div>
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pb-4">
                    <ul className="space-y-2 text-sm">
                      {m.meals.map((meal, i) => (
                        <li key={i} className="rounded-lg bg-stone-100/70 dark:bg-stone-900/60 p-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{meal.name}</div>
                            <div className="text-[11px] text-stone-500">
                              {Math.round(meal.kcal)} kcal • {Math.round(meal.carbs_g)}C / {Math.round(meal.protein_g)}P / {Math.round(meal.fat_g)}F
                            </div>
                          </div>

                          {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
                            <Disclosure>
                              {({ open }) => (
                                <div className="mt-2">
                                  <Disclosure.Button className="flex w-full items-center justify-between rounded-md border border-stone-200/60 dark:border-stone-700 bg-white/60 dark:bg-stone-900/40 px-3 py-2 text-[12px] hover:bg-stone-100 dark:hover:bg-stone-800">
                                    <span className="font-medium">Ingredients</span>
                                    <ChevronDownIcon className={`size-4 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                                  </Disclosure.Button>
                                  <Disclosure.Panel className="mt-2 rounded-md bg-white/60 dark:bg-stone-900/40 p-2 text-[12px]">
                                    <div className="mb-1 font-medium">Per-meal breakdown</div>
                                    <ul className="space-y-1">
                                      {meal.ingredients.map((ing, j) => (
                                        <li key={j} className="flex items-center justify-between">
                                          <span>
                                            {ing.name}{ing.portion ? <span className="text-stone-500"> — {ing.portion}</span> : null}
                                          </span>
                                          <span className="text-stone-500">{Math.round(ing.kcal)} kcal</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </Disclosure.Panel>
                                </div>
                              )}
                            </Disclosure>
                          )}

                          {meal.notes && <div className="mt-2 text-[12px] text-stone-600 dark:text-stone-300">{meal.notes}</div>}
                        </li>
                      ))}
                    </ul>
                  </Disclosure.Panel>
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      )}

      {/* Grocery list (meals only) */}
      {plan && (
        <div className="mt-5 rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
          <div className="mb-2 text-sm font-semibold">Grocery List (meals)</div>
          <ul className="columns-2 md:columns-3 text-sm [column-gap:1rem]">
            {grocery.map((g, i) => (
              <li key={i} className="break-inside-avoid">
                <span className="font-medium">{g.item}</span> — <span className="text-stone-600 dark:text-stone-300">{g.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Combined Shopping Plan (meals + fueling) */}
      {shopping && (
        <div className="mt-5 rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
          <div className="mb-2 text-sm font-semibold">Shopping Plan (meals + fueling)</div>
          <ul className="columns-1 md:columns-2 text-sm [column-gap:1rem]">
            {shopping.items.map((it, i) => (
              <li key={i} className="break-inside-avoid">
                <span className="font-medium">{it.item}</span> — <span className="text-stone-600 dark:text-stone-300">{it.qty}</span>
                <span className="text-[11px] text-stone-500"> ({it.section})</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button onClick={() => copyShopping(shopping.items)} className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800">
              Copy list
            </button>
            <button onClick={() => downloadJSON('grava-shopping-plan.json', shopping)} className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-800">
              Download JSON
            </button>
          </div>
        </div>
      )}

      {/* Walmart Matches */}
      {Object.keys(wm).length > 0 && (
        <div className="mt-5 rounded-xl border border-stone-200/60 dark:border-stone-800/70 p-4">
          <div className="mb-2 text-sm font-semibold">Walmart Matches</div>
          <div className="space-y-3">
            {grocery.map((g, i) => (
              <div key={i}>
                <div className="text-sm font-medium">{g.item} <span className="text-stone-500 text-xs">({g.qty})</span></div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(wm[g.item] || []).map((p, j) => (
                    <a key={j} href={p.url || '#'} target="_blank" rel="noreferrer"
                       className="flex gap-3 rounded-lg border border-stone-200/60 dark:border-stone-800/70 p-2 hover:bg-stone-50 dark:hover:bg-stone-900/40">
                      {p.image ? <img src={p.image} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-stone-200" />}
                      <div className="text-sm">
                        <div className="line-clamp-2">{p.title}</div>
                        <div className="text-[12px] text-stone-600 dark:text-stone-300">{p.price != null ? `$${p.price.toFixed(2)}` : '—'}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ======================= Fallback meal generator (synced) ======================= */
function buildFallbackMealPlan({
  week, diet, mealsPerDay, calorieBias, exclude, bodyKg, nutri,
}: {
  week: DayPlan[]
  diet: Diet
  mealsPerDay: number
  calorieBias: CalorieBias
  exclude: string
  bodyKg: number
  nutri: Array<{ day: string; durH: number; during: { carbs_g: number; fluids_L: number; sodium_mg: number }, pre: any; post: any }>
}): Record<string, DayMeals> {
  const ex = exclude.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const out: Record<string, DayMeals> = {}

  for (const d of week) {
    const n = nutri.find(x => x.day === d.day)
    const durH = n?.durH || d.durH || 0
    const ride = d.tone === 'easy' ? 450*durH : d.tone === 'moderate' ? 600*durH : d.tone === 'hard' ? 750*durH : 0
    let base = bodyKg * 33
    if (calorieBias === 'cut') base *= 0.88
    if (calorieBias === 'surplus') base *= 1.10
    const kcal = Math.round(base + ride)

    const macros = macroTargets({ kcal, bodyKg, tone: d.tone })
    const mealsMacros = {
      carbs_g: Math.max(0, Math.round(macros.carbs_g - (n?.during.carbs_g || 0))), // exclude on-bike carbs
      protein_g: macros.protein_g,
      fat_g: macros.fat_g,
    }

    const meals = distributeMeals({
      macros: mealsMacros,
      mealsPerDay,
      diet,
      tone: d.tone,
      exclude: ex,
      dayKey: `${new Date().toISOString().slice(0,10)}:${d.day}`,
      includeRecovery: n?.post,
      bodyKg,
    })

    out[d.day] = {
      kcalTarget: kcal,
      carbs_g: mealsMacros.carbs_g,
      protein_g: mealsMacros.protein_g,
      fat_g: mealsMacros.fat_g,
      meals,
      rideFuel: n ? {
        duringCHO_g: n.during.carbs_g,
        fluids_L: n.during.fluids_L,
        sodium_mg: n.during.sodium_mg,
        preCHO_g: n.pre?.carbs_g || 0,
        postCHO_g: n.post?.carbs_g || 0,
        postPRO_g: n.post?.protein_g || 0,
      } : undefined,
    }
  }
  return out
}

/* Split daily macros across meals, synthesize names + ingredients */
function distributeMeals({
  macros, mealsPerDay, diet, tone, exclude, dayKey, includeRecovery, bodyKg,
}: {
  macros: { carbs_g:number; protein_g:number; fat_g:number }
  mealsPerDay: number
  diet: Diet
  tone: Tone
  exclude: string[]
  dayKey: string
  includeRecovery?: any
  bodyKg: number
}): Meal[] {
  const rnd = seededRng(`dist:${dayKey}:${diet}:${tone}`)
  const splits =
    mealsPerDay === 3 ? [0.30,0.40,0.30] :
    mealsPerDay === 5 ? [0.22,0.26,0.26,0.16,0.10] :
                        [0.25,0.30,0.25,0.20] // 4
  // Prefer a protein-leaning post-workout meal if recovery present
  const postIdx = Math.floor(rnd()*splits.length)
  const meals: Meal[] = []

  for (let i=0;i<splits.length;i++){
    const share = splits[i]
    let C = Math.max(0, Math.round(macros.carbs_g * share))
    let P = Math.max(0, Math.round(macros.protein_g * share))
    let F = Math.max(0, Math.round(macros.fat_g * share))
    if (includeRecovery && i === postIdx) {
      P = Math.round(P * 1.15) // +15% protein in post meal
    }
    const kcal = Math.round(C*4 + P*4 + F*9)

    const seed = `${dayKey}:${i}`
    const name = synthMealName(diet, seed)

    // If exclusions include a word in the name, regenerate with a different seed
    if (exclude.some(x => name.toLowerCase().includes(x))) {
      const alt = synthMealName(diet, seed+'alt')
      meals.push({
        name: alt,
        carbs_g: C, protein_g: P, fat_g: F, kcal,
        ingredients: composeIngredientsFromMacros({ mealMacros: { carbs_g: C, protein_g: P, fat_g: F, kcal }, diet }),
      })
    } else {
      meals.push({
        name,
        carbs_g: C, protein_g: P, fat_g: F, kcal,
        ingredients: composeIngredientsFromMacros({ mealMacros: { carbs_g: C, protein_g: P, fat_g: F, kcal }, diet }),
      })
    }
  }
  return meals
}

/* ---------------------- grocery & shopping ---------------------- */
function buildGroceryList(plan: Record<string, DayMeals>) {
  type Tot = { grams?: number; ml?: number; count?: number }
  const acc = new Map<string, Tot>()

  for (const d of Object.values(plan)) {
    for (const m of d.meals) {
      if (!Array.isArray(m.ingredients)) continue
      for (const ing of m.ingredients) {
        const key = normalizeIngName(ing.name)
        const cur = acc.get(key) || {}
        if (ing.grams != null) cur.grams = (cur.grams ?? 0) + ing.grams
        else if (ing.ml != null) cur.ml = (cur.ml ?? 0) + ing.ml
        else cur.count = (cur.count ?? 0) + 1
        acc.set(key, cur)
      }
    }
  }

  return Array.from(acc.entries()).map(([name, tot]) => ({
    item: prettifyIngName(name),
    qty: formatQty(tot),
  }))
}
function normalizeIngName(s: string) {
  return s.trim().toLowerCase()
    .replace(/\s+\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
}
function prettifyIngName(s: string) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}
function formatQty(t: { grams?: number; ml?: number; count?: number }) {
  if (t.grams != null && t.grams > 0) {
    if (t.grams >= 1000) return `${(t.grams/1000).toFixed(1)} kg`
    return `${Math.round(t.grams)} g`
  }
  if (t.ml != null && t.ml > 0) {
    if (t.ml >= 1000) return `${(t.ml/1000).toFixed(1)} L`
    return `${Math.round(t.ml)} ml`
  }
  return `${t.count ?? 1}×`
}

/** Fueling shopping — allocate during-ride carbs across products */
function buildFuelingShopping(plan: Record<string, DayMeals>) {
  let totalCHO = 0, totalL = 0, totalNa = 0
  for (const d of Object.values(plan)) {
    totalCHO += d.rideFuel?.duringCHO_g || 0
    totalL += d.rideFuel?.fluids_L || 0
    totalNa += d.rideFuel?.sodium_mg || 0
  }
  const mixCHO = totalCHO * 0.5
  const gelsCHO = totalCHO * 0.3
  const chewsCHO = totalCHO * 0.2

  const mixScoops = Math.ceil(mixCHO / 25)
  const gels = Math.ceil(gelsCHO / 25)
  const chews = Math.ceil(chewsCHO / 20)

  const electrolyteNaPerServing = 500
  const electrolyteServings = Math.ceil(totalNa / electrolyteNaPerServing)

  const waterL = Math.ceil(totalL)

  return [
    { item: 'Drink mix (carb)', qty: `${mixScoops} scoops (~25g CHO ea)`, section: 'Fuel' },
    { item: 'Gels', qty: `${gels} packets (~25g CHO ea)`, section: 'Fuel' },
    { item: 'Chews', qty: `${chews} packs (~20g CHO ea)`, section: 'Fuel' },
    { item: 'Electrolyte mix', qty: `${electrolyteServings} servings (~500 mg Na ea)`, section: 'Fuel' },
    { item: 'Water', qty: `${waterL} L (for bottles/refills)`, section: 'Fuel' },
  ]
}

/* ---------------------- misc ---------------------- */
function downloadJSON(filename: string, data: any) {
  if (!data) return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function copyGrocery(items: { item: string; qty: string }[]) {
  const txt = items.map(i => `• ${i.item}: ${i.qty}`).join('\n')
  navigator.clipboard?.writeText(txt).catch(()=>{})
}
function copyShopping(items: { item: string; qty: string; section: string }[]) {
  const txt = items.map(i => `• ${i.item}: ${i.qty} (${i.section})`).join('\n')
  navigator.clipboard?.writeText(txt).catch(()=>{})
}

/* Attach synced ride fueling to any AI plan result */
function attachRideFuelToPlan(plan: Record<string, DayMeals>, nutri: Array<any>) {
  const out: Record<string, DayMeals> = {}
  for (const [day, val] of Object.entries(plan)) {
    const n = nutri.find(x => x.day === day)
    out[day] = {
      ...val,
      rideFuel: n ? {
        duringCHO_g: n.during.carbs_g,
        fluids_L: n.during.fluids_L,
        sodium_mg: n.during.sodium_mg,
        preCHO_g: n.pre?.carbs_g || 0,
        postCHO_g: n.post?.carbs_g || 0,
        postPRO_g: n.post?.protein_g || 0,
      } : val.rideFuel,
    }
  }
  return out
}
