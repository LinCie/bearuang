# Elysia with Bun runtime

## Development

Start the development server with `bun run dev`.

## Stress load test

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and run the backend and its database and object storage. From `packages/backend`, run:

```bash
# Default: ramp from 0 to 100 VUs over 1 minute, then to 200 over 2 minutes,
# hold for 2 minutes, and ramp down over 1 minute.
STRESS_API_KEY=<key> bun run load:stress

# Start 20 full workflows per second for 3 minutes, regardless of response time.
STRESS_API_KEY=<key> LOAD_PROFILE=constant bun run load:stress

# One iteration for a quick connectivity check.
STRESS_API_KEY=<key> LOAD_PROFILE=smoke bun run load:stress --iterations 1
```

Set `BASE_URL` to override the default `http://localhost:8000`. Set `RAMP_VUS` to change the ramping profile's peak (default 200). For the constant-arrival-rate profile, set `RATE` (iterations per second, default 20), `DURATION` (default `3m`), `PREALLOCATED_VUS` (default 100), and `MAX_VUS` (default 200). The arrival rate targets workflow starts, not concurrent users; actual VU usage depends on response times. Increase the VU allocation if iterations are dropped; dropped iterations fail the constant-rate test. Use `LOAD_PROFILE=smoke` for ad hoc k6 `--vus` and `--iterations` options.

Each iteration creates a category, product, variant, two uploaded images, warehouse, supplier, customer, and purchase and sales orders, advancing the orders through their lifecycle. It receives stock before shipping the sales order. The API key needs permissions for these operations.

**This test writes persistent data and does not clean it up.** Run it only against a disposable test environment. Unlike the former stress seed, its workload is controlled by k6 iterations and VUs, not `--scale`, and it does not check for existing seed data. Checks and HTTP failures must pass for k6 to exit successfully.
