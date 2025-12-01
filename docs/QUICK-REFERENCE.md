# Quick Reference Guide - Personupplysning MCP

## Essential URLs

| Resource | URL |
|----------|-----|
| **Production** | https://personupplysning-mcp.onrender.com |
| **Health Check** | https://personupplysning-mcp.onrender.com/health |
| **MCP Endpoint** | https://personupplysning-mcp.onrender.com/mcp |
| **Render Dashboard** | https://dashboard.render.com/ |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd |

---

## Common Commands

### Deployment

```bash
# Verify deployment
./scripts/verify-deployment.sh https://personupplysning-mcp.onrender.com

# View logs
render logs --tail 100 personupplysning-mcp

# Restart service
render services:restart personupplysning-mcp
```

### Database Queries

```sql
-- Cache hit rate (last 24h)
SELECT
  COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*) as hit_rate
FROM api_request_log
WHERE requested_at > NOW() - INTERVAL '24 hours';

-- Bolagsverket API usage (current month)
SELECT COUNT(*) as api_calls FROM api_request_log
WHERE cache_hit = false
  AND requested_at > DATE_TRUNC('month', NOW());
```

---

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| **Health check** | < 100ms | > 1s |
| **Cache hit rate** | > 80% | < 50% |
| **Error rate** | < 0.5% | > 5% |
| **Memory usage** | < 300MB | > 450MB |

---

## Emergency Procedures

### Service Crash
```bash
render logs --tail 200 | grep -i error
render services:restart personupplysning-mcp
```

### Rollback
```
Render Dashboard → Events → Rollback to previous version
```

---

**For complete documentation, see OPERATIONS-RUNBOOK.md**
