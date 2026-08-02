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

# QUET BAN DA STAGE (`git show :file`), KHONG QUET FILE TREN O DIA.
#
# Hai thu do khac nhau, va commit lay ban da stage. Neu quet o dia thi:
#   git add config.ts      (con chua khoa)
#   <sua file, xoa khoa, KHONG add lai>
#   git commit             -> quet ban sach tren o dia, PASS, commit van mang khoa
# Do dung la truong hop hook nay sinh ra de chan. Chieu nguoc lai cung sai: mot
# khoa chi nam o o dia (chua stage) se chan mot commit hoan toan sach.
check() {
  pattern="$1"
  label="$2"
  for f in $FILES; do
    # -I bo qua file nhi phan (.docx, anh) — chung khong chua khoa dang van ban
    if git show ":$f" 2>/dev/null | grep -I -q -E "$pattern"; then
      echo "  ✖ $label  ->  $f"
      FOUND=1
    fi
  done
}

# Doc thu ban da stage cua tung file. Doc that bai = KHONG quet duoc, va "khong
# quet duoc" phai keu len chu khong duoc im lang di qua — im lang o day chinh la
# fail-open. Truong hop hay gap nhat: ten file co dau cach hoac co ky tu khong
# phai ASCII (git mac dinh boc trong dau nhay va escape), nen `$f` khong con la
# duong dan that.
for f in $FILES; do
  if ! git show ":$f" >/dev/null 2>&1; then
    echo "  ⚠ khong doc duoc ban da stage  ->  $f"
    echo "    (ten file co dau cach / ky tu la? Xem core.quotepath)"
    FOUND=1
  fi
done

# AIza + 35 ky tu = khoa API Google (YouTube, Maps, Gemini...)
check 'AIza[0-9A-Za-z_-]{35}'        'Google API key'
# hf_ + 34 ky tu = token HuggingFace
check 'hf_[0-9A-Za-z]{34}'           'HuggingFace token'
check 'sk-[A-Za-z0-9]{20,}'          'OpenAI-style secret key'
check 'ghp_[0-9A-Za-z]{36}'          'GitHub personal access token'
check 'xox[baprs]-[0-9A-Za-z-]{10,}' 'Slack token'
check 'AKIA[0-9A-Z]{16}'             'AWS access key id'

# So di dong Viet Nam. CHEP NGUYEN VAN tu luat `vn-mobile-number` trong
# .gitleaks.toml — hai cong phai bat cung mot thu, neu khong chung se lech.
#
# Vi sao no thuoc ve day chu khong chi o CI: ca mot lop du lieu du lich bi giu
# ngoai git VI LY DO NAY (xem .gitignore) — 416 so that trong tai lieu ban giao,
# 14.328 trong kho tho. Voi ho kinh doanh mot nguoi, "so doanh nghiep" chinh la
# so di dong ca nhan. Truoc ban va nay, hook chi bat 6 mau khoa API va KHONG bat
# duoc dung lop du lieu ma no duoc dung de bao ve.
#
# Cho gia lap: dung mau `+8490xxxxxx<N>` — chu `x` that khong bi `\d{8}` an.
#
# Nhung mot so gia lap CO CHU DICH thi phai di qua duoc, neu khong chinh
# `.gitleaks.toml` (noi liet ke chung) va cac bao cao QA noi ve chung se bi chan.
# Danh sach mien tru KHONG chep lai o day — no duoc DOC RA tu `.gitleaks.toml`
# ngay luc chay, nen hai cong khong the lech nhau. Them mot so gia lap moi o mot
# noi la du.
# `\+849...` trong file TOML: grep -o chi tra ve phan KHOP, tuc `+849...` khong
# kem dau `\`, nen khong can sed. (Da thu `sed 's/\\//g'` va no hong tren
# Git-Bash/MSYS: `//` bi doi thanh duong dan Windows truoc khi sed nhin thay.)
# Dong dinh nghia LUAT `\+84[35789]\d{8}` khong khop, vi `[35789]` khong phai chu so.
# So sanh theo CHU SO, bo dau `+` o ca hai phia. Ly do rat cu the: neu de dau
# `+` lai thi mau tro thanh `^(+8490...|...)$`, va trong ERE mot dau `+` ngay sau
# `(` la toan tu lap khong co toan hang — grep im lang khong khop gi, tuc danh
# sach mien tru thanh vo dung ma khong bao loi.
SDT_GIA=$(grep -oE '\+84[0-9]{9}' .gitleaks.toml 2>/dev/null | tr -d '+' | sort -u | paste -sd'|' -)

check_sdt() {
  for f in $FILES; do
    ds=$(git show ":$f" 2>/dev/null | grep -I -oE '\+84[35789][0-9]{8}' | tr -d '+' | sort -u || true)
    [ -z "$ds" ] && continue
    # Bo cac so da duoc allowlist. Neu vi ly do nao do khong doc duoc allowlist,
    # KHONG bo gi ca — that bai phai nghieng ve phia chan, khong phai phia cho qua.
    if [ -n "$SDT_GIA" ]; then
      ds=$(printf '%s\n' "$ds" | grep -vE "^($SDT_GIA)$" || true)
    fi
    if [ -n "$ds" ]; then
      echo "  ✖ So di dong Viet Nam (PII)  ->  $f"
      printf '%s\n' "$ds" | sed 's/^/      +/'
      FOUND=1
    fi
  done
}
check_sdt

if [ "$FOUND" -eq 1 ]; then
  cat <<'MSG'

  ─────────────────────────────────────────────────────────────
  COMMIT BI CHAN — tim thay bi mat hoac PII trong ban da stage.

  Neu la KHOA / TOKEN:
    1. Go gia tri ra khoi file, thay bang bien moi truong.
    2. git restore --staged <file>   de bo file khoi commit.
    3. Neu DA bi push o commit truoc: THU HOI khoa ngay, dung tim
       cach xoa khoi lich su truoc. Thu hoi rẻ hơn rewrite.

  Neu la SO DI DONG:
    Khong the "thu hoi" mot so dien thoai — chi co the khong cong bo
    no. Che bang mau `+8490xxxxxx<N>`, hoac de gia tri that o
    `.tourism-data/` (da gitignore). Mot bao cao can cai HINH DANG
    cua so, khong bao gio can chinh con so.

    Dung them ca thu muc vao allowlist cua .gitleaks.toml de di qua:
    mien tru theo duong dan la mot loi hua ve MOI file ai do se them
    vao do sau nay. Chi allowlist tung GIA TRI gia lap mot.

  File .env* da duoc .gitignore che — neu no hien o day nghia la
  co ai do dung `git add -f`.
  ─────────────────────────────────────────────────────────────

MSG
  exit 1
fi

exit 0
