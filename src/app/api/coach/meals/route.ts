import { NextResponse } from 'next/server'
import { z } from 'zod'

/** ---------- Input types ---------- */
const ToneEnum = z.enum(['easy','moderate','hard','rest'])
const DayPlan = z.object({
  day: z.string(),              // "Mon", "Tue", ...
  tone: ToneEnum,
  miles: z.number().optional(),
  elev: z.number().optional(),
  durH: z.number().optional(),
})
const RideNutri = z.object({
  day: z.string(),
  durH: z.number(),
  per_h: z.object({
    carbs_g: z.number(),
    fluids_L: z.number(),
    sodium_mg: z.number(),
  }).optional().nullable(),
  during: z.object({
    carbs_g: z.number(),
    fluids_L: z.number(),
    sodium_mg: z.number(),
  }),
  pre: z.record(z.any()).optional(),
  post: z.record(z.any()).optional(),
})
const Prefs = z.object({
  diet: z.enum(['omnivore','vegetarian','vegan','pescatarian']).default('omnivore'),
  mealsPerDay: z.number().int().min(3).max(5).default(4),
  calorieBias: z.enum(['maintain','cut','surplus']).default('maintain'),
  exclude: z.string().default(''),
  bodyKg: z.number().min(35).max(150).default(75),
})

const RequestSchema = z.object({
  week: z.array(DayPlan),
  rideNutrition: z.array(RideNutri),
  prefs: Prefs,
  goal: z.any().optional(),
})

const IngredientSchema = z.object({
  name: z.string(),
  portion: z.string(),                  // e.g., "120 g", "1 cup (240 ml)"
  grams: z.number().optional(),         // numeric grams if known
  ml: z.number().optional(),            // numeric ml for liquids
  kcal: z.number(),
  carbs_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  section: z.string().optional(),       // Produce, Pantry, Dairy, Meat/Seafood, etc
})

const MealSchema = z.object({
  name: z.string(),
  kcal: z.number(),
  carbs_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  notes: z.string().optional(),
  ingredients: z.array(IngredientSchema).optional().default([]),
})

/** ---------- Output schema (what client expects) ---------- */

const DayMealsSchema = z.object({
  kcalTarget: z.number(),
  carbs_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  meals: z.array(MealSchema),
  rideFuel: z.object({
    duringCHO_g: z.number(),
    fluids_L: z.number(),
    sodium_mg: z.number(),
    preCHO_g: z.number().optional().default(0),
    postCHO_g: z.number().optional().default(0),
    postPRO_g: z.number().optional().default(0),
  }).optional(),
})
const PlanSchema = z.record(z.string(), DayMealsSchema)

/** ---------- Macro helper (same logic you used) ---------- */
function macroTargets({ kcal, bodyKg, tone }: { kcal: number; bodyKg: number; tone: 'easy'|'moderate'|'hard'|'rest' }) {
  const protein_g = Math.round(bodyKg * 1.8)
  const fat_g = Math.round(bodyKg * (tone === 'hard' ? 0.7 : 0.8))
  const carbs_g = Math.max(0, Math.round((kcal - (protein_g*4 + fat_g*9)) / 4))
  return { carbs_g, protein_g, fat_g }
}

/** ---------- Baseline kcal (food) ---------- */
function dailyKcal({ bodyKg, tone, rideHours }: { bodyKg: number; tone: 'easy'|'moderate'|'hard'|'rest'; rideHours: number }) {
  // Rough BMR/TEE shortcut + exercise; tweak if you have better signals
  const base = bodyKg * 33
  const ride = tone === 'easy' ? 450*rideHours : tone === 'moderate' ? 600*rideHours : tone === 'hard' ? 750*rideHours : 0
  return Math.round(base + ride)
}

/** ---------- Build day targets from inputs ---------- */
function buildTargets({
  week, rideNutrition, prefs,
}: {
  week: z.infer<typeof RequestSchema>['week']
  rideNutrition: z.infer<typeof RequestSchema>['rideNutrition']
  prefs: z.infer<typeof Prefs>
}) {
  const ex = prefs.exclude.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const out: Record<string, any> = {}
  for (const d of week) {
    const rn = rideNutrition.find(x => x.day === d.day)
    const rideH = rn?.durH || d.durH || 0
    let kcal = dailyKcal({ bodyKg: prefs.bodyKg, tone: d.tone, rideHours: rideH })
    if (prefs.calorieBias === 'cut') kcal = Math.round(kcal * 0.88)
    if (prefs.calorieBias === 'surplus') kcal = Math.round(kcal * 1.10)

    // Day macro targets from kcal
    const macros = macroTargets({ kcal, bodyKg: prefs.bodyKg, tone: d.tone })
    // Subtract on-bike carbs so meals reflect FOOD
    const mealsCarbs = Math.max(0, Math.round(macros.carbs_g - (rn?.during.carbs_g || 0)))

    out[d.day] = {
      kcalTarget: kcal,
      foodMacros: { carbs_g: mealsCarbs, protein_g: macros.protein_g, fat_g: macros.fat_g },
      rideFuel: rn ? {
        duringCHO_g: rn.during.carbs_g,
        fluids_L: rn.during.fluids_L,
        sodium_mg: rn.during.sodium_mg,
        preCHO_g: rn.pre?.carbs_g || 0,
        postCHO_g: rn.post?.carbs_g || 0,
        postPRO_g: rn.post?.protein_g || 0,
      } : undefined,
      tone: d.tone,
      mealsPerDay: prefs.mealsPerDay,
      diet: prefs.diet,
      exclude: ex,
    }
  }
  return out
}

/** ---------- AI call (OpenAI chat JSON mode) ---------- */
async function callAI({
  targets,
  goal,
}: {
  targets: Record<string, {
    kcalTarget: number
    foodMacros: { carbs_g: number; protein_g: number; fat_g: number }
    tone: 'easy'|'moderate'|'hard'|'rest'
    mealsPerDay: number
    diet: 'omnivore'|'vegetarian'|'vegan'|'pescatarian'
    exclude: string[]
  }>
  goal?: any
}) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) return null

  const prompt = `
You are a sports nutritionist for cyclists. Generate a 7-day meal plan with **different meals every day** (no repeats in the week), aligned to the **food macro targets** per day (carbs/protein/fat) and the **tone** of training (hard/moderate/easy/rest). 
Rules:
- Respect diet type and excluded ingredients.
- Use ${'Breakfast / Lunch / Dinner / Snack(s)'}—exact count = mealsPerDay for each day.
- Distribute macros across meals (±10% for the day is okay), but keep each day close to its targets.
- Name real foods (no brand names required).
- Hard days: front-load more carbs (Breakfast/Lunch).
- Rest days: lighter / protein-forward.
- Vary cuisines across the week for interest.
- For each meal, include an "ingredients" array with 3–6 items.
- For each ingredient provide: name, portion (human string), and numeric grams or ml when possible.
- Include ingredient-level macros and kcal. Make per-meal macro totals ≈ sum(ingredients) within ±5%.
- Prefer grams for solids and ml for liquids; still include a friendly "portion" string (e.g., "1 cup (240 ml)").
- Use everyday foods (no brands) and keep diet & exclusions.
- Return ONLY JSON matching the given schema.

Here are the day targets (food macros exclude on-bike fueling):
${JSON.stringify(targets, null, 2)}

User goal (optional): ${JSON.stringify(goal ?? null)}
Return a JSON object with keys Mon..Sun and value:
{
  "kcalTarget": 2300,
  "carbs_g": 320,
  "protein_g": 130,
  "fat_g": 65,
  "meals": [
    {
      "name": "Mediterranean chicken rice bowl",
      "kcal": 650,
      "carbs_g": 90,
      "protein_g": 40,
      "fat_g": 15,
      "ingredients": [
        {"name":"cooked jasmine rice","portion":"250 g","grams":250,"kcal":325,"carbs_g":72,"protein_g":6,"fat_g":1},
        {"name":"grilled chicken breast","portion":"150 g","grams":150,"kcal":248,"carbs_g":0,"protein_g":46,"fat_g":5},
        {"name":"olive oil","portion":"1 tsp (5 ml)","ml":5,"kcal":40,"carbs_g":0,"protein_g":0,"fat_g":4},
        {"name":"tomato & cucumber","portion":"120 g","grams":120,"kcal":25,"carbs_g":5,"protein_g":1,"fat_g":0}
      ]
    }
  ]
}

`.trim()

  // Minimal fetch; avoids SDK version mismatches. Uses Chat Completions JSON mode.
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a careful, precise sports dietitian who outputs strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  })

  if (!r.ok) return null
  const j = await r.json()
  const text = j?.choices?.[0]?.message?.content
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

/** ---------- Route ---------- */
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Bad request', issues: parsed.error.flatten() }, { status: 400 })
    }
    const { week, rideNutrition, prefs, goal } = parsed.data

    // Build day targets
    const targets = buildTargets({ week, rideNutrition, prefs })

    // Ask AI; fall back gracefully if unset or invalid
    const ai = await callAI({ targets, goal })
    if (!ai || typeof ai !== 'object') {
      return NextResponse.json({ plan: null }) // client will use fallback generator
    }

    // Coerce to client shape & validate
    const planInput: Record<string, z.infer<typeof DayMealsSchema>> = {}
    for (const [day, v] of Object.entries(targets)) {
      const aiDay = (ai as any)[day]
      if (!aiDay) continue
      planInput[day] = {
        kcalTarget: Number(aiDay.kcalTarget ?? v.kcalTarget),
        carbs_g: Number(aiDay.carbs_g ?? v.foodMacros.carbs_g),
        protein_g: Number(aiDay.protein_g ?? v.foodMacros.protein_g),
        fat_g: Number(aiDay.fat_g ?? v.foodMacros.fat_g),
            meals: Array.isArray(aiDay.meals) ? aiDay.meals.map((m: any) => ({
        name: String(m.name || 'Meal'),
        kcal: Number(m.kcal || 0),
        carbs_g: Number(m.carbs_g || 0),
        protein_g: Number(m.protein_g || 0),
        fat_g: Number(m.fat_g || 0),
        notes: m.notes ? String(m.notes) : undefined,
        ingredients: Array.isArray(m.ingredients) ? m.ingredients.map((ing: any) => ({
            name: String(ing.name || 'Ingredient'),
            portion: String(ing.portion || ''),
            grams: ing.grams != null ? Number(ing.grams) : undefined,
            ml: ing.ml != null ? Number(ing.ml) : undefined,
            kcal: Number(ing.kcal || 0),
            carbs_g: Number(ing.carbs_g || 0),
            protein_g: Number(ing.protein_g || 0),
            fat_g: Number(ing.fat_g || 0),
            section: ing.section ? String(ing.section) : undefined,
        })) : [],
        })) : [],
        rideFuel: (body.rideNutrition?.find((r: any) => r.day === day) ? {
          duringCHO_g: Number(body.rideNutrition.find((r: any) => r.day === day)!.during.carbs_g),
          fluids_L: Number(body.rideNutrition.find((r: any) => r.day === day)!.during.fluids_L),
          sodium_mg: Number(body.rideNutrition.find((r: any) => r.day === day)!.during.sodium_mg),
          preCHO_g: Number(body.rideNutrition.find((r: any) => r.day === day)!.pre?.carbs_g || 0),
          postCHO_g: Number(body.rideNutrition.find((r: any) => r.day === day)!.post?.carbs_g || 0),
          postPRO_g: Number(body.rideNutrition.find((r: any) => r.day === day)!.post?.protein_g || 0),
        } : undefined),
      }
    }

    const valid = PlanSchema.safeParse(planInput)
    if (!valid.success) {
      // If AI JSON fails validation, punt to client fallback
      return NextResponse.json({ plan: null })
    }

    // Ensure per-day meal count = mealsPerDay
    for (const [day, v] of Object.entries(targets)) {
      const want = v.mealsPerDay
      const have = valid.data[day]?.meals?.length ?? 0
      if (have && want && have !== want) {
        const arr = valid.data[day].meals
        if (have > want) valid.data[day].meals = arr.slice(0, want)
        if (have < want) {
          while (valid.data[day].meals.length < want) {
            valid.data[day].meals.push({ ...arr[arr.length-1], name: arr[arr.length-1].name + ' (alt)' })
          }
        }
      }
    }

    return NextResponse.json({ plan: valid.data })
  } catch (e) {
    return NextResponse.json({ plan: null })
  }
}
