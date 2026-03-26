
---

## 🚀 The Complete DevOps Cycle — From Nothing to Production


---

### The Core Idea First

"DevOps" is the **collapse of the wall** between Development (building software) and Operations (running software). Traditionally these were separate teams. DevOps merges the mindset — the people who build it are responsible for running it, monitoring it, and fixing it when it breaks.

The goal: **ship software faster, more reliably, with less manual work.**

The full cycle never ends. It's a loop:

```
PLAN → CODE → BUILD → TEST → RELEASE → DEPLOY
  ↑                                        │
  └──── MONITOR ←── OPERATE ←─────────────┘
```

Let's go through every phase with full depth.

---

## 📋 Phase 1 — PLAN

Before a single line of code, there's a process of turning a vague idea into actionable work.

---

### Product Requirements

```
Business Need / User Problem
        ↓
Product Requirements Document (PRD)
  - What problem are we solving?
  - Who is the user?
  - What does success look like? (metrics)
  - What are we explicitly NOT building?
        ↓
Technical Design Document (TDD / RFC)
  - What is the system architecture?
  - What are the data models?
  - What APIs are needed?
  - What are the scaling assumptions?
  - What are the risks?
```

Senior engineers write design docs **before** coding. A few hours of design saves days of wrong implementation.

---

### Breaking Work Down

```
EPIC (large feature, weeks-months)
  └── STORIES (user-facing units of work, days)
        └── TASKS (concrete implementation steps, hours)
```

**Example:**
```
Epic:  "User Authentication System"
  Story: "User can register with email/password"
    Task: Create users table in DB
    Task: Build POST /auth/register endpoint
    Task: Add input validation
    Task: Write unit tests
    Task: Add rate limiting
  Story: "User can log in"
  Story: "User can reset password"
```

**Tools:** Jira, Linear, GitHub Issues, Notion

---

### Agile / Sprint Model

Work is organized into **sprints** — fixed time periods (usually 2 weeks):

```
SPRINT PLANNING → pick tasks from backlog
        ↓
DAILY STANDUP → 15min: what did I do, what will I do, blockers?
        ↓
SPRINT REVIEW → demo what was built
        ↓
RETROSPECTIVE → what went well, what to improve
        ↓
NEXT SPRINT
```

This keeps teams shipping incrementally instead of big-bang releases every 6 months.

---

## 💻 Phase 2 — CODE

The environment and workflow around writing code is as important as the code itself.

---

### Local Development Environment

Every developer needs a consistent local environment that mirrors production as closely as possible.

```
Your Machine
├── Editor/IDE (VS Code, JetBrains, Neovim)
├── Language runtime (Node.js, Python, JVM)
├── Local database (PostgreSQL, Redis running locally or in Docker)
├── Environment variables (.env file — secrets not committed to git)
├── Package manager (npm, pip, cargo, go mod)
└── Docker (run dependent services locally)
```

**The classic problem:** "Works on my machine." Solved by containerizing the dev environment — everyone runs identical Docker containers locally.

**docker-compose.yml** — defines your entire local stack:
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://localhost/myapp
    depends_on: [db, redis]

  db:
    image: postgres:15
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7
```

`docker compose up` → entire stack running locally in seconds.

---

### Git — The Foundation of All Collaboration

Every professional codebase uses **Git** for version control. Understanding Git deeply is non-negotiable.

**The core model:**
```
WORKING DIRECTORY (your files)
        ↓ git add
STAGING AREA (changes selected for commit)
        ↓ git commit
LOCAL REPOSITORY (committed history)
        ↓ git push
REMOTE REPOSITORY (GitHub/GitLab/Bitbucket)
```

---

### Branching Strategy

The team agrees on how branches are used. The most common:

**Git Flow / Trunk-Based Development:**

```
main (production-ready always)
  │
  ├── develop (integration branch)
  │     │
  │     ├── feature/user-auth
  │     ├── feature/payment-flow
  │     └── bugfix/login-crash
  │
  └── hotfix/critical-security-patch
```

**Trunk-Based (modern, preferred at scale):**
```
main (everyone commits here frequently)
  │
  ├── Short-lived feature branches (< 1 day ideally)
  └── Feature flags hide unfinished features
      (code is merged but not yet active for users)
```

Short-lived branches = less merge conflicts = faster integration.

---

### The Pull Request (PR) / Code Review Cycle

No code goes directly to main. It goes through review:

```
Developer creates feature branch
        ↓
Writes code, commits locally
        ↓
Pushes branch to remote
        ↓
Opens Pull Request (PR)
  - Description of what changed and why
  - Link to the ticket/issue
  - Screenshots if UI changes
        ↓
Automated checks run (CI pipeline triggers)
  - Tests pass?
  - Linting clean?
  - Security scan?
        ↓
1-2 teammates review the code
  - Logic correct?
  - Edge cases handled?
  - Performance implications?
  - Code readable and maintainable?
        ↓
Feedback addressed, re-reviewed
        ↓
Approved → Merged to main
        ↓
Branch deleted
```

Code review is not just bug-catching — it's knowledge sharing, mentorship, and collective ownership.

---

## 🔨 Phase 3 — BUILD

After code is merged, it needs to be transformed into something deployable.

---

### The Build Process

Depending on your stack:

```
COMPILED LANGUAGES (Go, Rust, Java):
Source code
        ↓
Compiler (go build, cargo build, javac)
        ↓
Binary / JAR / executable artifact

INTERPRETED (Node.js, Python):
Source code
        ↓
Bundle step (webpack, esbuild for JS)
Dependency install (npm ci, pip install)
        ↓
Package (zip, tarball, or Docker image)

ALL STACKS → ultimately packaged as:
Docker Image (the universal deployable unit today)
```

---

### Docker Image — The Universal Artifact

A **Docker image** is a snapshot of everything needed to run your application:
- OS base layer (slim Linux)
- Runtime (Node.js, Python, JVM)
- Your application code
- Dependencies
- Configuration

**Dockerfile:**
```dockerfile
FROM node:20-alpine          # base image — slim Linux + Node

WORKDIR /app

COPY package*.json ./
RUN npm ci --production      # install dependencies

COPY . .
RUN npm run build            # compile/bundle

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Build it:
```bash
docker build -t myapp:v1.2.3 .
```

This image runs **identically** everywhere — local machine, staging server, production. The "works on my machine" problem is solved at the image level.

Images are pushed to a **Container Registry** (Docker Hub, AWS ECR, Google Artifact Registry) — the equivalent of npm for Docker images.

---

## 🧪 Phase 4 — TEST

Testing is not a phase that happens once. It's layered and runs at multiple points.

---

### The Testing Pyramid

```
        /\
       /  \
      / E2E \          ← Few, slow, expensive
     /────────\           (end-to-end, real browser)
    /Integration\      ← Some, medium speed
   /──────────────\       (test service + DB together)
  /   Unit Tests   \   ← Many, fast, cheap
 /──────────────────\     (test one function in isolation)
```

**Unit Tests:**
Test one function or class in complete isolation. Mock all dependencies.
```javascript
// Testing a pure function
test('calculateTax returns correct amount', () => {
  expect(calculateTax(100, 0.1)).toBe(10);
  expect(calculateTax(0, 0.1)).toBe(0);
  expect(calculateTax(-100, 0.1)).toThrow();
});
```

**Integration Tests:**
Test how components work together — your API endpoint + real database.
```python
def test_create_user_endpoint(client, db):
    response = client.post("/users", json={
        "email": "test@example.com",
        "password": "secure123"
    })
    assert response.status_code == 201
    assert db.query(User).count() == 1
```

**End-to-End (E2E) Tests:**
A real browser, clicking through real UI flows.
```javascript
// Playwright / Cypress
test('user can sign up and log in', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('[name=email]', 'user@test.com');
    await page.fill('[name=password]', 'pass123');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/dashboard');
});
```

---

### Other Test Types

**Load Testing:** Simulate thousands of concurrent users. Does the system hold?
Tools: k6, Locust, Apache JMeter
```javascript
// k6 load test
export default function() {
    http.get('https://api.myapp.com/users');
    sleep(1);
}
// Run with 1000 virtual users for 5 minutes
```

**Security Testing:**
- SAST (Static Analysis) — scan source code for vulnerabilities
- DAST (Dynamic Analysis) — attack running app like a hacker would
- Dependency scanning — check packages for known CVEs

**Contract Testing:**
In microservices — verify that Service A and Service B agree on the shape of their API. Catches breaking changes before deployment.

---

## ⚙️ Phase 5 — CI/CD PIPELINE

This is the engine of modern DevOps. The pipeline **automates** everything from code merge to production deployment.

---

### CI — Continuous Integration

Every time code is pushed or a PR is opened, an automated pipeline runs:

```
Code pushed to GitHub
        ↓
CI system triggered (GitHub Actions, GitLab CI,
                     Jenkins, CircleCI)
        ↓
Runner spins up (a fresh VM or container)
        ↓
Pipeline steps execute:

  Step 1: Checkout code
  Step 2: Install dependencies
  Step 3: Run linter (eslint, ruff, golint)
  Step 4: Run unit tests → must all pass
  Step 5: Run integration tests
  Step 6: Check test coverage (must be > 80%)
  Step 7: Security scan (Snyk, Trivy)
  Step 8: Build Docker image
  Step 9: Push image to registry

  ALL GREEN? → PR can be merged
  ANY FAILURE? → PR blocked, developer notified
```

**GitHub Actions example:**
```yaml
name: CI Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Push to registry
        run: docker push myapp:${{ github.sha }}
```

Every merge to main produces a **tagged, tested Docker image** in the registry. The image tag is the git commit SHA — every deployment is perfectly traceable to exact code.

---

### CD — Continuous Delivery vs Continuous Deployment

**Continuous Delivery:**
Every successful build is **ready** to deploy to production. Deployment itself requires a human approval click.

**Continuous Deployment:**
Every successful build **automatically deploys** to production. No human in the loop.

```
CONTINUOUS DELIVERY:
Code merged → CI passes → Image built → 
[Human clicks deploy] → Production updated

CONTINUOUS DEPLOYMENT:
Code merged → CI passes → Image built →
Automatically deployed → Production updated
```

Most mature teams practice Continuous Delivery at minimum. High-confidence teams (with great test coverage) do full Continuous Deployment. Companies like GitHub, Netflix, and Amazon deploy to production **hundreds of times per day**.

---

### The Deployment Pipeline — Environments

Code doesn't go straight from commit to production. It travels through environments:

```
LOCAL (developer's machine)
  ↓ merge to main triggers CI
DEVELOPMENT / STAGING
  ↓ automated tests pass, QA verification
  ↓ product team signs off
PRODUCTION
```

**Staging** is a production-identical environment with production-like data (anonymized). The last checkpoint before real users see changes.

---

## 🚢 Phase 6 — RELEASE STRATEGIES

How you actually get new code in front of users safely.

---

### Big Bang / Direct Deploy

Old school. Replace old version with new version instantly.
```
All users: v1 → All users: v2
```
**Problem:** If v2 has a bug, all users are affected immediately.

---

### Blue-Green Deployment

Run two identical production environments. Switch traffic between them.

```
BLUE (current production, v1) ← 100% traffic
GREEN (new version, v2)       ← 0% traffic, being tested

All tests pass on GREEN
        ↓
Load balancer switches:
BLUE  ← 0% traffic
GREEN ← 100% traffic

If something breaks → switch back to BLUE instantly
```

Instant rollback. Zero downtime. Requires double the infrastructure.

---

### Canary Deployment

Release to a small percentage of users first. Watch metrics. Gradually increase.

```
v1: 95% of users
v2: 5% of users (the "canaries")
        ↓
Metrics look good? No errors spike?
        ↓
v1: 50%, v2: 50%
        ↓
v1: 0%, v2: 100%
```

Named after coal miners who used canary birds to detect gas — the small group detects problems before full rollout.

---

### Feature Flags

Deploy code to production but control who sees it via runtime configuration:

```javascript
if (featureFlags.isEnabled('new-checkout-flow', userId)) {
    return <NewCheckout />;
} else {
    return <OldCheckout />;
}
```

Feature flags let you:
- Deploy code without releasing features
- A/B test features on subsets of users
- Instantly disable a feature without deployment
- Give early access to specific users

Tools: LaunchDarkly, Unleash, PostHog flags, simple DB config

---

### Rolling Deployment (Kubernetes default)

Replace instances one at a time:

```
10 instances running v1

Replace instance 1 with v2 → 9×v1, 1×v2
Wait, check health
Replace instance 2 with v2 → 8×v1, 2×v2
...continue until...
0×v1, 10×v2
```

No downtime. Gradual. If new version is unhealthy → deployment pauses automatically.

---

## 📡 Phase 7 — INFRASTRUCTURE AS CODE

Manually clicking through cloud consoles to set up servers is fragile, unrepeatable, and undocumented. The solution: **define your infrastructure in code.**

---

### Terraform — Provision Infrastructure

```hcl
# Create an AWS EC2 instance
resource "aws_instance" "app_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"

  tags = {
    Name = "production-app-server"
  }
}

# Create a load balancer
resource "aws_lb" "main" {
  name               = "app-load-balancer"
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
}
```

`terraform apply` → Terraform talks to AWS API, creates exactly these resources. Change the code → `terraform apply` → infrastructure updates. Stored in Git. Reviewed like code. Auditable. Repeatable.

**Infrastructure drift** — when real infrastructure diverges from what's defined. Terraform detects and corrects this.

---

### Kubernetes Manifests — Deploy Applications

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3               # run 3 instances
  selector:
    matchLabels:
      app: myapp
  template:
    spec:
      containers:
      - name: myapp
        image: myapp:a3f8b2c  # exact image from CI
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:        # kill and restart if unhealthy
          httpGet:
            path: /health
            port: 3000
```

`kubectl apply -f deployment.yaml` → Kubernetes ensures 3 instances are always running. If one crashes → starts a new one automatically.

---

## 📊 Phase 8 — MONITOR & OBSERVE

You can't fix what you can't see. Monitoring is what closes the loop from production back to development.

---

### The Three Pillars of Observability

**1. Metrics — Numbers over time**

```
CPU usage: 72%
Memory: 4.2GB / 8GB
Request rate: 1,432 req/sec
Error rate: 0.3%
P99 latency: 245ms
Active DB connections: 87
```

Tools: Prometheus (collects metrics), Grafana (visualizes them)

**Dashboards** show all metrics in real time. Engineers watch these during deployments.

---

**2. Logs — Timestamped event records**

```
2026-03-21 14:23:01 INFO  User 4829 logged in from 192.168.1.1
2026-03-21 14:23:04 ERROR Failed to charge card: insufficient funds
2026-03-21 14:23:05 WARN  DB connection pool at 90% capacity
2026-03-21 14:23:09 ERROR Unhandled exception in /api/orders
                          NullPointerException at OrderService.java:142
```

Logs from every service → aggregated into a central system.
Tools: ELK Stack (Elasticsearch + Logstash + Kibana), Loki + Grafana, Datadog

```bash
# Search logs across all services
logs.search("ERROR AND service:payment AND timestamp:last-1h")
```

---

**3. Traces — Following a request across services**

In microservices, one user request touches many services. How do you debug a slow request?

**Distributed tracing** assigns a trace ID to each request and records every service it touches:

```
Request ID: abc-123
  ├── API Gateway         2ms
  ├── Auth Service        8ms
  ├── Order Service       45ms
  │     ├── DB Query      38ms  ← THIS is slow
  │     └── Cache check   2ms
  └── Response sent       1ms
Total: 58ms
```

Immediately shows where time is spent. Tools: Jaeger, Zipkin, Datadog APM, OpenTelemetry.

---

### Alerting

Metrics without alerts are useless at 3am. Set thresholds:

```
IF error_rate > 1% for 5 minutes → PagerDuty alert → wake on-call engineer
IF p99_latency > 2000ms → Slack alert → investigate
IF disk_usage > 85% → ticket created → fix before crisis
IF deployment error_rate spikes → auto-rollback triggered
```

Good alerting = **alert on symptoms, not causes.** Alert when users are affected, not just when a server metric looks odd.

---

### SLIs, SLOs, SLAs — The Reliability Contract

**SLI (Service Level Indicator):** A metric measuring service health.

```
Availability = (successful requests / total requests) × 100
Latency = 99th percentile response time
```

**SLO (Service Level Objective):** Internal target.

```
Availability SLO: 99.9% uptime
Latency SLO: P99 < 500ms
```

**SLA (Service Level Agreement):** External promise to customers. Often has financial penalties for breach.

```
99.9% uptime = 8.7 hours downtime allowed per year
99.99% = 52 minutes per year
99.999% = 5 minutes per year ("five nines")
```

**Error Budget:** 100% - SLO = how much failure you're allowed.

```
99.9% SLO → 0.1% error budget
If you've used 80% of error budget this month →
slow down deployments, focus on reliability
```

---

## 🔁 The Full Cycle — Connected

```
PLAN
  Product requirements → technical design → sprint tasks

CODE
  Local dev environment → Git branching → Pull Request

BUILD
  Docker image built → tagged with commit SHA → pushed to registry

TEST
  Unit → Integration → E2E → Load → Security
  All automated, all blocking merge if failed

CI PIPELINE
  Triggered on every push → lint → test → build → push image

CD PIPELINE
  On merge to main → deploy to staging → automated tests
  → human approval (or auto) → deploy to production

RELEASE STRATEGY
  Canary / Blue-Green / Rolling → gradual, safe rollout
  Feature flags → decouple deploy from release

INFRASTRUCTURE AS CODE
  Terraform → provision cloud resources
  Kubernetes manifests → declare desired app state

MONITOR
  Metrics (Prometheus/Grafana) → numbers
  Logs (ELK/Loki) → events
  Traces (Jaeger) → request journeys
  Alerts → notify humans when users are affected

INCIDENT
  Alert fires → on-call responds → diagnose with observability
  → fix or rollback → write postmortem → improve
  → feed learnings back into PLAN
```

---

## 🗺️ The Complete Mental Model

```
DEVELOPER'S MACHINE
  Code → Git commit → Push branch → Open PR

GITHUB / GITLAB
  PR opened → CI pipeline triggers

CI PIPELINE (GitHub Actions / Jenkins)
  Lint → Test → Build Docker Image → Push to Registry

CD PIPELINE
  Image promoted → Staging deploy → Tests → Production deploy

PRODUCTION INFRASTRUCTURE (AWS / GCP / Azure)
  Kubernetes cluster running N replicas
  Load balancer distributing traffic
  Managed DB, Cache, Queue

USERS
  Requests hit CDN → Load Balancer → App → DB

OBSERVABILITY
  Every request logged, measured, traced
  Dashboards, alerts, on-call rotation

INCIDENT HAPPENS
  Alert → Diagnose → Rollback or Fix → Deploy → Postmortem

POSTMORTEM LEARNINGS
  Feed back into planning → make system more resilient
```


