import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRoutePlans } from "../../src/planner.js";

// Public synthetic itinerary used when tests need a realistic multi-route plan.
export function publicPlanTrip() {
  const trip = {
    name: "London to Reykjavik fixture",
    tripType: "one-way",
    departureWindow: { start: "2026-08-01", end: "2026-08-07", center: "2026-08-04" },
    origin: { label: "London", airports: ["LHR"] },
    destination: { label: "Reykjavik", airports: ["KEF"] },
    alternateStarts: [{ label: "Manchester", airports: ["MAN"] }],
    optionalStops: [{ label: "Dublin", airports: ["DUB"], nights: [1] }],
    gatewayAirports: ["BOS"],
    routeModes: { includeOptionalStopCombinations: true, includeGatewaySplit: true },
    rules: { requestDelayMs: 0 }
  };
  const routes = buildRoutePlans(trip);
  const routeId = (predicate) => {
    const route = routes.find(predicate);
    if (!route) throw new Error("Public plan fixture could not find its required route.");
    return route.id;
  };
  const plan = {
    id: "public-test-plan",
    name: "London to Reykjavik",
    tripSpecPath: "trip.json",
    routeIdeas: [
      {
        id: "lhr-kef",
        label: "London to Reykjavik",
        type: "direct-to-final",
        focusSearchIds: [routeId((route) => route.kind === "one-way" && startsAt(route, "LHR"))],
        originAirports: ["LHR"],
        destinationAirports: ["KEF"],
        batches: ["all-reviewed"]
      },
      {
        id: "lhr-dub-kef",
        label: "London via Dublin to Reykjavik",
        type: "stopover",
        focusSearchIds: [routeId((route) => route.kind === "multi-city" && startsAt(route, "LHR"))],
        originAirports: ["LHR"],
        destinationAirports: ["KEF"],
        stopover: { label: "Dublin", airports: ["DUB"] }
      },
      {
        id: "man-kef",
        label: "Manchester to Reykjavik",
        type: "direct-to-final",
        focusSearchIds: [routeId((route) => route.kind === "one-way" && startsAt(route, "MAN"))],
        originAirports: ["MAN"],
        destinationAirports: ["KEF"]
      },
      {
        id: "man-dub-kef",
        label: "Manchester via Dublin to Reykjavik",
        type: "alternate-start-stopover",
        focusSearchIds: [routeId((route) => route.kind === "multi-city" && startsAt(route, "MAN"))],
        originAirports: ["MAN"],
        destinationAirports: ["KEF"],
        stopover: { label: "Dublin", airports: ["DUB"] }
      }
    ]
  };
  return { plan, trip };
}

export async function writePublicPlanFixture(root) {
  const { plan, trip } = publicPlanTrip();
  const planDir = path.join(root, "plans", plan.id);
  await mkdir(planDir, { recursive: true });
  await writeFile(path.join(planDir, "plan.json"), JSON.stringify(plan));
  await writeFile(path.join(planDir, plan.tripSpecPath), JSON.stringify(trip));
  return { plan, trip, planPath: path.relative(root, path.join(planDir, "plan.json")) };
}

function startsAt(route, airport) {
  return route.segments[0]?.from?.airports?.includes(airport);
}
