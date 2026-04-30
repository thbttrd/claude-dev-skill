# Icon Catalog

Curated icons bundled with the skill. **Always prefer these local paths over remote URLs** — d2 aborts the whole compile if any remote icon fetch returns non-200, and terrastruct's CDN has patchy coverage.

All paths are absolute. Base: `${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/`

## When to use an icon vs a shape hint

| Situation | Choice |
|---|---|
| Named AWS service (EC2, RDS, Lambda, S3, …) | Icon from `aws/` |
| Named dev tool (Docker, React, Postgres, …) | Icon from `dev/` |
| Generic database, no specific engine | `shape: cylinder` |
| Generic message queue | `shape: queue` |
| Generic persistent store | `shape: stored_data` |
| Generic 3rd-party service | `shape: cloud` + `style.stroke-dash: 3` |
| User / persona / actor | `shape: person` |
| Document / report | `shape: document` or `page` |
| Logical microservice / service boundary | `shape: hexagon` |

Within a group of similar modules, stay consistent — don't mix icon-styled and shape-styled DBs in the same diagram.

## AWS catalog (`assets/icons/aws/`)

| Key | File | Typical label |
|---|---|---|
| `ec2` | `aws/ec2.svg` | EC2 / compute instance |
| `lambda` | `aws/lambda.svg` | Lambda / serverless function |
| `ecs` | `aws/ecs.svg` | ECS / container service |
| `eks` | `aws/eks.svg` | EKS / Kubernetes cluster |
| `ec2-autoscaling` | `aws/ec2-autoscaling.svg` | Auto-scaling group |
| `s3` | `aws/s3.svg` | S3 / object storage |
| `rds` | `aws/rds.svg` | RDS / managed relational DB |
| `aurora` | `aws/aurora.svg` | Aurora DB |
| `dynamodb` | `aws/dynamodb.svg` | DynamoDB / NoSQL key-value |
| `elasticache` | `aws/elasticache.svg` | ElastiCache / managed Redis |
| `api-gateway` | `aws/api-gateway.svg` | API Gateway |
| `cloudfront` | `aws/cloudfront.svg` | CloudFront / CDN |
| `route53` | `aws/route53.svg` | Route 53 / DNS |
| `elb` | `aws/elb.svg` | Elastic Load Balancing |
| `sqs` | `aws/sqs.svg` | SQS / message queue |
| `sns` | `aws/sns.svg` | SNS / pub-sub topic |
| `cloudwatch` | `aws/cloudwatch.svg` | CloudWatch / monitoring |

## Dev tools catalog (`assets/icons/dev/`)

| Key | File | Typical label |
|---|---|---|
| `docker` | `dev/docker.svg` | Docker container |
| `github` | `dev/github.svg` | GitHub / repo / CI trigger |
| `react` | `dev/react.svg` | React app / frontend |
| `nodejs` | `dev/nodejs.svg` | Node.js runtime |
| `python` | `dev/python.svg` | Python app / service |
| `typescript` | `dev/typescript.svg` | TypeScript app |
| `postgresql` | `dev/postgresql.svg` | PostgreSQL |
| `redis` | `dev/redis.svg` | Redis |
| `mongodb` | `dev/mongodb.svg` | MongoDB |
| `nginx` | `dev/nginx.svg` | Nginx / reverse proxy |

## Using an icon in d2

```d2
auth_lambda: Auth {
  icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/lambda.svg
}

user_db: Users DB {
  icon: ${CLAUDE_PLUGIN_ROOT}/skills/d2-architect/assets/icons/aws/rds.svg
}
```

The icon appears as a badge next to the label. Don't add `shape: image` unless you specifically want the icon to *replace* the label (rare for architecture diagrams).

## Adding a new icon

If you need an icon that's not here:

```bash
~/.claude/skills/d2-architect/scripts/add_icon.sh <remote_url> <category>/<name>
```

Example:

```bash
~/.claude/skills/d2-architect/scripts/add_icon.sh \
  'https://icons.terrastruct.com/aws%2FStorage%2FAmazon-Elastic-File-System.svg' \
  aws/efs
```

The script verifies the URL returns 200 and that the file is valid SVG/PNG before saving. If terrastruct's CDN doesn't have what you need, any stable SVG URL works — or drop an SVG directly into `assets/icons/<category>/<name>.svg`.

After adding, update this catalog (one row) so future diagrams know about it.

## Shape-hint quick reference

When no icon matches, these shapes are safe, always available, and need zero network:

```d2
db:     User DB      { shape: cylinder }
queue:  Order Queue  { shape: queue }
kv:     Session KV   { shape: stored_data }
stripe: Stripe       { shape: cloud; style.stroke-dash: 3 }
user:   Customer     { shape: person }
svc:    Pricing Svc  { shape: hexagon }
doc:    Invoice PDF  { shape: document }
```
