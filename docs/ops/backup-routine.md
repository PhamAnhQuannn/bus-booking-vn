# Backup Routine — Cheatsheet (Phase 1)

**Event-driven, NOT every-day.** Prod already has Neon 6h auto-PITR. You only act BEFORE risky changes
or DURING an incident. Data is tiny → no daily chore needed.

## A. Ngày làm việc bình thường (dev) — KHÔNG backup gì
```bash
# 1. Bật Docker Desktop (chờ vài giây), rồi:
docker compose -f docker-compose.dev.yml up -d      # pg 5432 / shadow 5434 / redis 6379
# 2. Chạy app:
pnpm dev                                            # http://localhost:3001
# 3. Xong việc: để chạy, hoặc dừng:
docker compose -f docker-compose.dev.yml stop
```
> `bbvn_dev` là DB LOCAL — không phải prod. Không cần backup. Prod (Neon) tự có 6h PITR.

## B. TRƯỚC việc RỦI RO trên prod (deploy migration / sửa data lớn / go-live)
**B1. Neon snapshot (30 giây, luôn làm):**
- console.neon.com → project → branch `production` → **Backup & Restore** → **Create**.
- Xong việc rủi ro mà ổn → có thể xoá snapshot cũ (Free = 1 slot).

**B2. On-demand dump off-Neon (tuỳ, khi thay đổi lớn / go-live):**
```bash
# Bật Docker trước (container bus-booking-postgres-1 phải chạy).
export BBVN_PROD_DATABASE_URL="postgresql://…neon…prod…"   # lấy từ vault, 1 lần/phiên terminal
./scripts/backup-ondemand.sh                                # → ~/bbvn-backups/bbvn-prod-<time>.dump
```
→ Rồi mới deploy / chạy migration.

## C. Khi có sự cố (data sai / xoá nhầm)
**Trong 6h:** console.neon.com → `production` → **Backup & Restore** → **Restore from history** → chọn
mốc thời gian → **Next** → **Restore**. (Neon tự tạo branch backup trước khi restore → đảo ngược được.)

**Từ snapshot (B1):** cùng trang → mục snapshot → **Restore**.

**Từ dump off-Neon (B2), worst case:** `scripts/restore.sh ~/bbvn-backups/<file>.dump` vào 1 DB đích
KHÔNG phải primary.

## Tần suất thực tế
| Việc | Khi nào |
|------|---------|
| Neon 6h PITR | tự động, không làm gì |
| Neon snapshot (Create) | trước MỖI thay đổi rủi ro |
| `backup-ondemand.sh` | trước go-live / migration lớn |
| (tuỳ chọn) snapshot "cho yên tâm" | 1 lần/ngày khi bật máy, 30 giây — Free ghi đè slot cũ |

Nâng cấp (Neon scheduled snapshot / dump tự động) chỉ khi business lớn hơn.
