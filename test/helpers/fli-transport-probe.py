"""Exercise the real provider and adapter against synthetic HTTP responses."""

import contextlib
import importlib.util
import io
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "flight_adapter", root / "src/providers/fli/fli_search_adapter.py"
)
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)

from fli.search.client import Client

case = sys.argv[1]
if case == "upstream-error":
    body = ")]}'\n" + json.dumps([["wrb.fr", None, None, None, None, [13]]])
elif case == "missing-payload":
    body = "<html><title>Unavailable</title><body>No search payload</body></html>"
elif case == "empty-inventory":
    # A valid search payload with both flight buckets present and empty.
    body = "AF_initDataCallback({key: 'ds:1', data:[[null,null,null,null,\"fixture-session\"],null,[[]],[[]]], sideChannel: {}});"
else:
    raise ValueError(f"Unknown fixture: {case}")

response = SimpleNamespace(text=body, status_code=200, raise_for_status=lambda: None)
payload = {"input": {"departure_id": "CNX", "arrival_id": "BKK", "outbound_date": "2026-11-15"}}
output = io.StringIO()
# Stub both transports so this test goes red with the old RPC client and
# green with the public-page client, without touching the network.
with patch.object(Client, "post", return_value=response), \
        patch.object(Client, "get", return_value=response), \
        patch("time.sleep"), \
        patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), \
        contextlib.redirect_stdout(output):
    adapter.main()
print(output.getvalue().strip())
