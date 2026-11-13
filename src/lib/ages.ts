// Junior age classes (12, 14, 16, 18): a player may play their own class or an older one.
export const AGE_CLASSES = [12, 14, 16, 18] as const;
export type AgeClass = (typeof AGE_CLASSES)[number];

/** The youngest class a player of this age can play (11 → 12, 13 → 14). null when too old for junior classes. */
export function ageClassFor(age: number | null | undefined): AgeClass | null {
  if (age == null || !Number.isFinite(age)) return null;
  return AGE_CLASSES.find((c) => age <= c) ?? null;
}

/** Two-digit numbers in a name: "P12/F12" → [12], "Flickor och pojkar 12, 14 & 16" → [12, 14, 16], "12-14 år" → [12, 14]. */
function numbers(name: string): number[] {
  return [...name.matchAll(/(?:^|\D)(\d{2})(?=\D|$)/g)].map((m) => Number(m[1]));
}

export const classMatchesAge = (className: string, age: AgeClass) => numbers(className).includes(age);

/** Uses the tournament's real classes when known, otherwise its name. */
export function eventMatchesAge(eventName: string, classNames: string[] | undefined, age: AgeClass): boolean {
  if (classNames && classNames.length) return classNames.some((c) => classMatchesAge(c, age));
  return numbers(eventName).includes(age);
}
