interface MealDbResponse {
  meals: Array<{ idMeal: string; strMeal: string }> | null
}

export async function sucheRezeptUrl(name: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(name)
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encoded}`
    )
    if (!res.ok) return null
    const data = await res.json() as MealDbResponse
    if (!data.meals || data.meals.length === 0) return null
    return `https://www.themealdb.com/meal/${data.meals[0].idMeal}`
  } catch {
    return null
  }
}
