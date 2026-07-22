import { escapeAttr, escapeHtml, formatHumanDate, money } from "./html-utils.js";

// Shared decision/date prompt for extending a promising boundary without running searches.
export function renderWindowEdgeSuggestion(suggestion, planPath) {
  if (!suggestion || !planPath) return "";
  return `<article class="card window-edge-suggestion">
    <div class="label">Check just beyond this date</div>
    <div class="title">${escapeHtml(monthAndDay(suggestion.edgeDate))} is the cheapest date found and it is the edge of your search window.</div>
    <p>It is $${money(suggestion.edgePrice)}, compared with $${money(suggestion.runnerUpPrice)} for the next-lowest complete date.</p>
    <button class="btn" type="button" data-plan-extend-window data-plan-path="${escapeAttr(planPath)}" data-direction="${escapeAttr(suggestion.direction)}" data-days="${suggestion.addDays}">Extend the search to ${escapeHtml(compactDateList(suggestion.dates))}?</button>
  </article>`;
}

export function renderWindowExtensionScript() {
  return `<script>
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-plan-extend-window]");
  if (!button || button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Extending date window…";
  try {
    const response = await fetch("/api/plans/extend-window", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planPath: button.dataset.planPath,
        direction: button.dataset.direction,
        days: Number(button.dataset.days)
      })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || "Date window could not be extended.");
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now());
    window.location.assign(url);
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    window.alert(error.message);
  }
});
</script>`;
}

function compactDateList(dates) {
  const formatted = (dates ?? []).map((date) => formatHumanDate(date));
  if (formatted.length < 2) return formatted[0] ?? "the next date";
  const [first, second] = formatted;
  const firstParts = first.split(", ");
  const secondParts = second.split(", ");
  const firstMonthDay = firstParts[0];
  const secondMonthDay = secondParts[0];
  const firstMonth = firstMonthDay.split(" ")[0];
  const secondMonth = secondMonthDay.split(" ")[0];
  const year = secondParts[1] ?? firstParts[1];
  if (firstMonth === secondMonth) return `${firstMonthDay} and ${secondMonthDay.split(" ").at(-1)}`;
  return `${firstMonthDay} and ${secondMonthDay}${year ? `, ${year}` : ""}`;
}

function monthAndDay(date) {
  return formatHumanDate(date).replace(/, \d{4}$/, "");
}
