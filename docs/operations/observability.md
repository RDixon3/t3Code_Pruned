# Local diagnostics

Use **Settings → General → About → View diagnostics** to inspect failures, slow operations, and live process CPU/memory. **Open logs folder** locates the selected environment's actual logs; avoid guessing paths when using separate development homes or WSL.

## Reproduce a failure

1. Record the CoCo version, selected environment, provider or integration, and time of the failing action.
2. Reproduce it once with the smallest useful request.
3. In diagnostics, inspect the failure and its related spans. Copy the trace ID so support can correlate the operation with its child work.
4. For a slow action, compare the slowest spans with process CPU/memory at that time. Distinguish provider or terminal work from renderer delay.
5. For Jira or v0 authorization failures, copy the integration's connection diagnostics as well.

## Inspect local files

The logs folder contains `server.trace.ndjson` for backend operations and `desktop.trace.ndjson` for desktop operations. Each line is a JSON trace record with timing, result, attributes, and events. Search by trace ID to follow one request. Logs emitted outside a span may appear only in the development console.

The desktop buffers child-process output and writes `server-child.log` when startup or runtime failure requires a diagnostic snapshot. WSL instances have separate child-log filenames. These files are rotated; preserve the relevant files before repeating a failure many times.

Packaged CoCo normally uses `.coco/userdata/logs` under the user's home directory. Development and explicit `--home-dir` runs use their own state locations; the app's displayed logs path is authoritative. WSL owns its backend files inside the distribution.

For command-line inspection, set the path to the log you copied from the app, then filter JSON records. For example, in PowerShell:

```powershell
Get-Content -LiteralPath $tracePath |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.traceId -eq $traceId }
```

Local tracing does not export logs or metrics to an external collector. Provider and integration requests still contact their configured services.

## Share evidence carefully

Include the exact action, error, time zone, trace ID, version, and operating system. Review logs before sharing: paths, chat text, tool output, and customer data may appear. Do not send credential files or the complete application data directory as routine support evidence.

For installed-app recovery procedures, see [Troubleshooting](../user/coco/troubleshooting.md). For isolated development runs, see [Development](development.md).
