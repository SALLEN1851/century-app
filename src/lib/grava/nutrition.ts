// src/lib/grava/nutrition.ts

export type Tone = 'easy' | 'moderate' | 'hard' | 'rest'

export function estimateDurationHours(miles: number, elevFt: number, tone: Tone) {
  if (!miles || tone === 'rest') return 0
  const mph = tone === 'easy' ? 15 : tone === 'moderate' ? 16.5 : 18
  const slow = 1 + (elevFt / 1000) * 0.03 // ~3% slower per 1000 ft
  return (miles / mph) * slow
}

export function perHourTargets(tone: Tone) {
  if (tone === 'rest') return { carbs_g: 0, fluids_L: 0, sodium_mg: 0 }
  const map = {
    easy:     { carbs_g: 40, fluids_L: 0.5, sodium_mg: 400 },
    moderate: { carbs_g: 60, fluids_L: 0.7, sodium_mg: 600 },
    hard:     { carbs_g: 80, fluids_L: 0.9, sodium_mg: 800 },
  } as const
  return map[tone]
}

export function dayRideNutrition({
  miles, elevFt, tone,
}: { miles: number; elevFt: number; tone: Tone }) {
  const durH = estimateDurationHours(miles, elevFt, tone)
  const per_h = perHourTargets(tone)
  const ftPerMi = miles ? elevFt / miles : 0
  const elevBump = ftPerMi > 150 ? 1.10 : ftPerMi > 100 ? 1.05 : 1.00

  const during = {
    carbs_g: per_h.carbs_g * durH * elevBump,
    fluids_L: per_h.fluids_L * durH * elevBump,
    sodium_mg: per_h.sodium_mg * durH * elevBump,
  }
  return { durH, per_h, during }
}

export function prePostGuidance({
  tone, bodyKg = 75,
}: { tone: Tone; bodyKg?: number }) {
  if (tone === 'rest') {
    return {
      pre:  { carbs_g: 0, fluids_L: 0.3, sodium_mg: 200 },
      post: { carbs_g: 0.5 * bodyKg, protein_g: 0.25 * bodyKg, fluids_L: 0.3, sodium_mg: 300 },
    }
  }
  const preCHO  = (tone === 'hard' ? 1.0 : 0.6) * bodyKg
  const postCHO = (tone === 'hard' ? 1.2 : 0.8) * bodyKg
  const postPRO = 0.3 * bodyKg

  return {
    pre:  { carbs_g: preCHO, fluids_L: 0.3, sodium_mg: 300, caffeine_mg: tone === 'hard' ? 150 : 100 },
    post: { carbs_g: postCHO, protein_g: postPRO, fluids_L: 0.5, sodium_mg: 500 },
  }
}

export function fullDayNutrition({
  miles, elevFt, tone, bodyKg = 75,
}: { miles: number; elevFt: number; tone: Tone; bodyKg?: number }) {
  const { durH, per_h, during } = dayRideNutrition({ miles, elevFt, tone })
  const { pre, post } = prePostGuidance({ tone, bodyKg })

  const totals = {
    carbs_g: Math.round(pre.carbs_g + during.carbs_g + post.carbs_g),
    protein_g: Math.round((post as any).protein_g ?? 0),
    fluids_L: +(pre.fluids_L + during.fluids_L + post.fluids_L).toFixed(1),
    sodium_mg: Math.round(pre.sodium_mg + during.sodium_mg + post.sodium_mg),
  }

  return { durH, per_h, during, pre, post, totals }
}
