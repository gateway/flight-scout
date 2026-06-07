#!/usr/bin/env python3
"""JSON-only adapter for the unofficial flights/fli Google Flights package.

The Node app owns planning, caching, ranking, and dashboards. This script only
converts one provider request into structured flight records and exits.
"""

from __future__ import annotations

import sys
import traceback
from datetime import datetime
from typing import Any

import json


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        result = run_search(payload)
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except ModuleNotFoundError as exc:
        print(json.dumps({
            "ok": False,
            "code": "fli-dependency-missing",
            "message": f"Missing Python dependency: {exc.name}. Install src/providers/fli/requirements.txt.",
        }))
        return 0
    except Exception as exc:  # noqa: BLE001 - provider failures should be JSON, not tracebacks.
        print(json.dumps({
            "ok": False,
            "code": "fli-search-failed",
            "message": str(exc),
            "trace": traceback.format_exc(limit=3),
        }))
        return 0


def run_search(payload: dict[str, Any]) -> dict[str, Any]:
    from fli.core import parse_max_stops, resolve_airport
    from fli.models import FlightSearchFilters, FlightSegment, PassengerInfo
    from fli.models.google_flights.base import SeatType, TripType
    from fli.search import SearchFlights
    from fli.search.client import get_client

    search_input = payload["input"]
    origins = split_codes(search_input["departure_id"])
    destinations = split_codes(search_input["arrival_id"])
    max_results = int(payload.get("maxResults") or 30)
    direct_only = bool(payload.get("directOnly"))
    stops = "NON_STOP" if direct_only else "ANY"
    all_results: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    requested_currency = str(payload.get("currency") or search_input.get("currency") or "USD").upper()
    language = payload.get("language") or search_input.get("language") or "en-US"
    country = payload.get("country") or search_input.get("country") or "US"
    search_client = SearchFlights()

    for origin_code in origins:
        for destination_code in destinations:
            filters = FlightSearchFilters(
                trip_type=TripType.ONE_WAY,
                passenger_info=PassengerInfo(
                    adults=int(search_input.get("adults") or 1),
                    children=int(search_input.get("children") or 0),
                    infants_in_seat=0,
                    infants_on_lap=int(search_input.get("infants") or 0),
                ),
                flight_segments=[
                    FlightSegment(
                        departure_airport=[[resolve_airport(origin_code), 0]],
                        arrival_airport=[[resolve_airport(destination_code), 0]],
                        travel_date=search_input["outbound_date"],
                    )
                ],
                seat_type=SeatType.ECONOMY,
                stops=parse_max_stops(stops),
            )
            flights = search_client.search(
                filters,
                currency=requested_currency,
                language=language,
                country=country,
            )
            if flights is None:
                continue
            for flight in flights:
                try:
                    normalized = normalize_flight(flight)
                    if normalized["price"] is None:
                        rejected.append({"reason": "missing price", "route": f"{origin_code}->{destination_code}"})
                        continue
                    all_results.append(normalized)
                except Exception as exc:  # noqa: BLE001 - one malformed provider record should not kill the scan.
                    rejected.append({"reason": str(exc), "route": f"{origin_code}->{destination_code}"})

    all_results.sort(key=lambda item: (item["price"], item.get("durationMinutes") or 10**9))
    return {
        "ok": True,
        "provider": "fli-google-flights",
        "currency": requested_currency,
        "language": language,
        "country": country,
        "searchTimestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "results": all_results[:max_results],
        "debug": {
            "returned": len(all_results[:max_results]),
            "cleanResultCount": len(all_results),
            "rejectedCount": len(rejected),
            "rejected": rejected[:20],
        },
    }


def normalize_flight(flight: Any) -> dict[str, Any]:
    legs = [normalize_leg(leg) for leg in getattr(flight, "legs", []) or []]
    first = legs[0] if legs else {}
    last = legs[-1] if legs else {}
    return {
        "price": getattr(flight, "price", None),
        "currency": getattr(flight, "currency", None),
        "durationMinutes": getattr(flight, "duration", None),
        "stops": getattr(flight, "stops", None),
        "airline": " + ".join(sorted({leg.get("airlineName") for leg in legs if leg.get("airlineName")})) or None,
        "departureAirport": first.get("departureAirport"),
        "arrivalAirport": last.get("arrivalAirport"),
        "departureTime": first.get("departureTime"),
        "arrivalTime": last.get("arrivalTime"),
        "legs": legs,
        "layovers": [],
        "bookingToken": getattr(flight, "booking_token", None),
    }


def normalize_leg(leg: Any) -> dict[str, Any]:
    return {
        "airline": getattr(getattr(leg, "airline", None), "name", None),
        "airlineName": clean_enum_name(getattr(getattr(leg, "airline", None), "name", None)),
        "flightNumber": getattr(leg, "flight_number", None),
        "durationMinutes": getattr(leg, "duration", None),
        "departureAirport": clean_enum_name(getattr(getattr(leg, "departure_airport", None), "name", None)),
        "departureAirportName": clean_enum_name(getattr(getattr(leg, "departure_airport", None), "value", None)),
        "arrivalAirport": clean_enum_name(getattr(getattr(leg, "arrival_airport", None), "name", None)),
        "arrivalAirportName": clean_enum_name(getattr(getattr(leg, "arrival_airport", None), "value", None)),
        "departureTime": format_datetime(getattr(leg, "departure_datetime", None)),
        "arrivalTime": format_datetime(getattr(leg, "arrival_datetime", None)),
        "airplane": None,
        "travelClass": None,
        "extensions": [],
    }


def split_codes(value: str) -> list[str]:
    return [code.strip().upper() for code in str(value).split(",") if code.strip()]


def clean_enum_name(value: Any) -> Any:
    if value is None:
        return None
    return str(value).lstrip("_")


def format_datetime(value: Any) -> Any:
    return value.strftime("%Y-%m-%d %H:%M") if value else None


if __name__ == "__main__":
    raise SystemExit(main())
