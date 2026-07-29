#!/usr/bin/env sh
# Chan bi mat NGAY TRUOC KHI commit hinh thanh.
#
# Vi sao can, khi CI da co gitleaks: gitleaks chi chay tren CI, tuc la SAU khi
# commit da ton tai va da push. Bi mat luc do da nam trong lich su git, va go ra
# phai rewrite history. Hook nay chan som hon mot buoc.
#
# Chi quet FILE DA STAGE. Chay nhanh, khong phu thuoc gi ngoai grep.
set -e

FILES=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$FILES" ] && exit 0

FOUND=0

check() {
  pattern="$1"
  label="$2"
  for f in $FILES; do
    [ -f "$f" ] || continue
    # -I bo qua file nhi phan (.docx, anh) — chung khong chua khoa dang van ban
    if grep -I -n -E "$pattern" "$f" >/dev/null 2>&1; then
      echo "  ✖ $label  ->  $f"
      FOUND=1
    fi
  done
}

# AIza + 35 ky tu = khoa API Google (YouTube, Maps, Gemini...)
check 'AIza[0-9A-Za-z_-]{35}'        'Google API key'
# hf_ + 34 ky tu = token HuggingFace
check 'hf_[0-9A-Za-z]{34}'           'HuggingFace token'
check 'sk-[A-Za-z0-9]{20,}'          'OpenAI-style secret key'
check 'ghp_[0-9A-Za-z]{36}'          'GitHub personal access token'
check 'xox[baprs]-[0-9A-Za-z-]{10,}' 'Slack token'
check 'AKIA[0-9A-Z]{16}'             'AWS access key id'

if [ "$FOUND" -eq 1 ]; then
  cat <<'MSG'

  ─────────────────────────────────────────────────────────────
  COMMIT BI CHAN — phat hien bi mat trong file da stage.

  Cach xu ly:
    1. Go gia tri ra khoi file, thay bang bien moi truong.
    2. git restore --staged <file>   de bo file khoi commit.
    3. Neu bi mat DA bi push o commit truoc: THU HOI khoa ngay,
       dung tim cach xoa khoi lich su truoc. Thu hoi rẻ hơn rewrite.

  File .env* da duoc .gitignore che — neu no hien o day nghia la
  co ai do dung `git add -f`.
  ─────────────────────────────────────────────────────────────

MSG
  exit 1
fi

exit 0
