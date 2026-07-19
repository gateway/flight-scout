export function parseIntentDirectness(lower) {
  const hardDirect = /\b(?:direct flight|nonstop only|non-stop only|must be nonstop|must be non-stop|no layover|no stops)\b/.test(lower);
  const preferredDirect = /\b(?:prefer(?:red)?|ideally|if possible)[^.]{0,40}\b(?:direct|nonstop|non-stop)\b/.test(lower)
    || /\b(?:direct|nonstop|non-stop)\b[^.]{0,40}\b(?:if possible|preferred|ideally)\b/.test(lower);
  const required = hardDirect || (/\b(?:direct|nonstop|non-stop)\b/.test(lower) && !preferredDirect);
  return {
    requested: required || preferredDirect || /fewest layover|least layover/.test(lower),
    required,
    maxStops: required ? 0 : null
  };
}

export function parseIntentTravelHours(lower) {
  const result = { hardMax: null, preferredMax: null };
  const preferred = lower.match(/(?:under|less than|around|about)\s*(\d{1,2})\s*(?:h|hour|hours)[^.]{0,45}\bif possible\b/)
    ?? lower.match(/\bprefer(?:red)?\b[^.]{0,60}(?:under|less than|around|about)\s*(\d{1,2})\s*(?:h|hour|hours)/)
    ?? lower.match(/(?:flight|travel|trip)\s*time[^.]{0,40}(?:under|less than|around|about)\s*(\d{1,2})\s*(?:h|hour|hours)[^.]{0,50}(?:not (?:a )?hard|soft|if possible)/);
  if (preferred) result.preferredMax = Number(preferred[1]);

  const hardPatterns = [
    /(?:hard|absolute)\s*(?:cutoff|cut-off|limit)(?:\s*(?:at|of))?\s*(\d{1,2}(?:\.\d+)?)\s*(?:h|hour|hours)/,
    /(?:max|maximum|no more than|no longer than|avoid over|not over|nothing over|anything over|over)\s*(?:a\s*)?(\d{2})[-\s]*(?:h|hour|hours)/,
    /(?:do not want|don't want|dont want)[^.]{0,40}\bover\s*(?:a\s*)?(\d{2})[-\s]*(?:h|hour|hours)/
  ];
  const explicit = hardPatterns.map((pattern) => lower.match(pattern)).find(Boolean);
  if (explicit) result.hardMax = Number(explicit[1]);
  if (!result.hardMax && /no (?:brutal|painful|long long)|avoid (?:brutal|painful|long long|35 hour)|not .*35 hour/.test(lower)) {
    result.hardMax = 35;
  }
  return result;
}

// Preference assembly is kept together so priority, limits, and stop filters cannot drift.
export function buildIntentPreferences(lower, { budget, directness, travelHours }) {
  return {
    priority: /fewest|least layover|no layover/.test(lower) ? "fewest-layovers" : /fastest|quickest|shortest/.test(lower) ? "fastest" : /cheap|budget|lowest|best price/.test(lower) ? "cheapest" : "balanced",
    budgetSensitivity: budget || /cheap|cheapest|budget|lowest/.test(lower) ? "high" : "balanced",
    ...(travelHours.hardMax ? { rejectTotalElapsedHoursOver: travelHours.hardMax } : {}),
    ...(travelHours.preferredMax ? { preferredTotalElapsedHours: travelHours.preferredMax } : {}),
    ...(directness.required ? { maxStops: 0 } : {})
  };
}
