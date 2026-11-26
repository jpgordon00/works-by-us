# Daily streamflow during the USGS API migration

On November 26, 2026, the legacy USGS WaterServices daily values endpoint and the modern USGS Water Data v1 daily endpoint returned matching results for all 21 expected gauge-days. Each observation agreed on the date, exact decimal discharge, units, approval status, and qualifiers. Both APIs returned HTTP 200. There were zero missing, duplicate, unexpected, or mismatched gauge-days.

The comparison used October 1–7, 2025, with the daily mean (`00003`) of discharge (`00060`) at these three gauges.

| Gauge | Location | Matching days |
| --- | --- | ---: |
| `01094400` | North Nashua River at Fitchburg, Massachusetts | 7 of 7 |
| `01646500` | Potomac River at Little Falls near Washington, D.C. | 7 of 7 |
| `09506000` | Verde River near Camp Verde, Arizona | 7 of 7 |

Legacy WaterServices returned the 21 observations in one response. The modern API returned three pages of 3, 3, and 1 observations for each gauge with a requested limit of 3. The checker followed six `rel=next` links provided by the server. The endpoints represent dates and units differently. The checker uses the local observation date and puts `ft3/s` and `ft^3/s` in the same unit. It maps legacy `A` and `P` to approval status and keeps other qualifier codes separate. All 21 sampled observations were approved and carried no other qualifier codes. Provisional observations and other qualifiers remain untested by this sample.

Run from the repository root with Python 3 and internet access. The queries require no API key.

```sh
python3 -B contributions/usgs-daily-api/check.py
```

The checker prints the paired observations and exits nonzero on a request error or incomplete agreement. The first run is recorded in [result.json](result.json) with the UTC start time, request URLs, HTTP statuses, page sizes, and response hashes. Pagination links are recorded as evidence of the requests made during the run. Rerunning the script starts a new request and follows fresh links.

[USGS migration guide](https://api.waterdata.usgs.gov/docs/ogcapi/migration/) · [WaterServices decommissioning timeline](https://waterdata.usgs.gov/blog/api-waterservices-decom)
