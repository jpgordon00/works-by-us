#!/usr/bin/env python3
"""Compare a fixed week of USGS daily discharge between two public APIs."""

import hashlib
import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen


GAUGES = ("01094400", "01646500", "09506000")
START = date(2025, 10, 1)
END = date(2025, 10, 7)
PARAMETER = "00060"
STATISTIC = "00003"
LEGACY = "https://waterservices.usgs.gov/nwis/dv/"
MODERN = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items"
APPROVALS = {"A": "approved", "P": "provisional"}


def fetch(url, request_log):
    entry = {"url": url}
    request_log.append(entry)
    try:
        request = Request(url, headers={"Accept": "application/json"})
        with urlopen(request, timeout=30) as response:
            body = response.read()
            entry.update(http_status=response.status, sha256=hashlib.sha256(body).hexdigest())
        return json.loads(body)
    except (OSError, ValueError) as error:
        entry["error"] = str(error)
        raise


def measurement(value, unit, approval, qualifiers):
    return {
        "value": None if value is None else format(Decimal(value).normalize(), "f"),
        "unit": {"ft3/s": "ft^3/s"}.get(unit, unit),
        "approval": approval,
        "qualifiers": sorted(qualifiers),
    }


def legacy_rows(request_log):
    query = urlencode({
        "format": "json", "sites": ",".join(GAUGES), "startDT": START, "endDT": END,
        "parameterCd": PARAMETER, "statCd": STATISTIC,
    })
    data = fetch(f"{LEGACY}?{query}", request_log)
    rows = []
    for series in data["value"]["timeSeries"]:
        gauge = series["sourceInfo"]["siteCode"][0]["value"]
        variable = series["variable"]
        parameter = variable["variableCode"][0]["value"]
        statistic = next(
            (option["optionCode"] for option in variable["options"]["option"]
             if option["name"] == "Statistic"),
            None,
        )
        if (parameter, statistic) != (PARAMETER, STATISTIC):
            raise ValueError(f"Unexpected legacy parameter/statistic: {parameter}/{statistic}")
        for group in series["values"]:
            for observation in group["value"]:
                codes = observation["qualifiers"]
                approvals = {APPROVALS[code] for code in codes if code in APPROVALS}
                if len(approvals) > 1:
                    raise ValueError(f"Conflicting legacy approvals for {gauge}: {codes}")
                value = observation["value"]
                if Decimal(value) == Decimal(str(variable["noDataValue"])):
                    value = None
                rows.append((gauge, observation["dateTime"][:10], measurement(
                    value, variable["unit"]["unitCode"], next(iter(approvals), None),
                    [code for code in codes if code not in APPROVALS],
                )))
    request_log[-1]["rows"] = len(rows)
    return rows


def modern_rows(gauge, request_log):
    query = urlencode({
        "f": "json", "monitoring_location_id": f"USGS-{gauge}",
        "parameter_code": PARAMETER, "statistic_id": STATISTIC,
        "datetime": f"{START}/{END}", "limit": 3,
    })
    url = f"{MODERN}?{query}"
    seen = set()
    rows = []
    while url:
        parts = urlsplit(url)
        if url in seen or parts._replace(query="", fragment="").geturl() != MODERN:
            raise ValueError(f"Unexpected pagination link: {url}")
        seen.add(url)
        data = fetch(url, request_log)
        request_log[-1].update(gauge=gauge, rows=len(data["features"]))
        for feature in data["features"]:
            fields = feature["properties"]
            key = (fields["monitoring_location_id"], fields["parameter_code"], fields["statistic_id"])
            if key != (f"USGS-{gauge}", PARAMETER, STATISTIC):
                raise ValueError(f"Unexpected modern series: {key}")
            qualifier = fields["qualifier"]
            qualifiers = [qualifier] if isinstance(qualifier, str) else qualifier or []
            approval = fields["approval_status"]
            rows.append((gauge, fields["time"][:10], measurement(
                fields["value"], fields["unit_of_measure"],
                approval.casefold() if approval else None, qualifiers,
            )))
        link = next((link["href"] for link in data["links"] if link["rel"] == "next"), None)
        url = urljoin(url, link) if link else None
    return rows


def compare(legacy, modern):
    days = [str(START + timedelta(days=offset)) for offset in range((END - START).days + 1)]
    expected = {(gauge, day) for gauge in GAUGES for day in days}
    indexed = {"legacy": defaultdict(list), "modern": defaultdict(list)}
    for source, rows in [("legacy", legacy), ("modern", modern)]:
        for gauge, day, value in rows:
            indexed[source][(gauge, day)].append(value)
    comparisons = []
    for key in sorted(expected | indexed["legacy"].keys() | indexed["modern"].keys()):
        before, after = (indexed[source].get(key, []) for source in indexed)
        differences = [field for field in before[0] if before[0][field] != after[0][field]] \
            if len(before) == len(after) == 1 else []
        comparisons.append({
            "gauge": key[0], "date": key[1], "expected": key in expected,
            "legacy": before, "modern": after, "different_fields": differences,
        })
    return comparisons


def main():
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    requests = {"legacy": [], "modern": []}
    errors = []
    legacy, modern = [], []
    try:
        legacy = legacy_rows(requests["legacy"])
    except (OSError, ValueError, KeyError) as error:
        errors.append({"source": "legacy", "error": str(error)})
    for gauge in GAUGES:
        try:
            modern.extend(modern_rows(gauge, requests["modern"]))
        except (OSError, ValueError, KeyError) as error:
            errors.append({"source": "modern", "gauge": gauge, "error": str(error)})

    rows = compare(legacy, modern)
    summary = {
        "expected_pairs": sum(row["expected"] for row in rows),
        "matching_pairs": sum(row["expected"] and len(row["legacy"]) == len(row["modern"]) == 1
                              and not row["different_fields"] for row in rows),
        "mismatched_pairs": sum(bool(row["different_fields"]) for row in rows),
        "unexpected_pairs": sum(not row["expected"] for row in rows),
        "missing_pairs": {source: sum(row["expected"] and not row[source] for row in rows)
                          for source in requests},
        "duplicate_pairs": {source: sum(len(row[source]) > 1 for row in rows) for source in requests},
    }
    print(json.dumps({
        "checked_at_utc": checked_at, "parameter_code": PARAMETER, "statistic_id": STATISTIC,
        "gauges": GAUGES, "start_date": str(START), "end_date": str(END),
        "summary": summary, "errors": errors, "requests": requests, "comparisons": rows,
    }, indent=2))
    return bool(errors or summary["matching_pairs"] != summary["expected_pairs"] or summary["unexpected_pairs"])


if __name__ == "__main__":
    raise SystemExit(main())
