#!/usr/bin/env sh
# Chan bi mat va PII NGAY TRUOC KHI commit hinh thanh.
#
# Vi sao can, khi CI da co gitleaks: gitleaks chi chay tren CI, tuc la SAU khi
# commit da ton tai va da push. Bi mat luc do da nam trong lich su git, va go ra
# phai rewrite history. Hook nay chan som hon mot buoc.
set -e

FILES=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$FILES" ] && exit 0

FOUND=0

# ── Danh sach so gia lap, DOC RA tu .gitleaks.toml ──────────────────────────
# Khong chep lai o day. Chep la de hai cong lech nhau; doc ra thi them mot so
# gia lap o mot noi la du.
#
# Hai chi tiet da lam hong ban truoc, ghi lai de khong ai "don dep" chung:
#   * `grep -o` chi tra ve phan KHOP, tuc `+849...` khong kem dau `\` cua TOML,
#     nen KHONG can sed. (`sed 's/\\//g'` hong tren Git-Bash/MSYS: `//` bi doi
#     thanh duong dan Windows truoc khi sed nhin thay.)
#   * So sanh theo CHU SO, bo dau `+`. Neu giu `+` thi mau thanh `^(+849...)$`,
#     va trong ERE mot dau `+` ngay sau `(` la toan tu lap khong co toan hang —
#     grep im lang khong khop gi, tuc danh sach mien tru thanh vo dung.
# Dong dinh nghia LUAT `\+84[35789]\d{8}` khong bi hut vao day, vi `[35789]`
# khong phai chu so.
SDT_GIA=$(grep -oE '\+84[0-9]{9}' .gitleaks.toml 2>/dev/null | tr -d '+' | sort -u | tr '\n' ' ')

# ── Mot mau duy nhat cho tat ca ─────────────────────────────────────────────
# MOI FILE: dung 1 lan `git show` + 1 lan `grep`. Khong phai tiet kiem vu vo —
# da do tren may nay: moi lan spawn `git show` ~43 ms, moi lan spawn `grep`
# ~27 ms (Windows). Ban truoc quet moi mau mot vong rieng => 8 lan `git show` +
# 7 lan `grep` cho MOI file, tuc ~45 giay cho mot commit 84 file. Mot hook cham
# nhu vay se bi ai do cho `--no-verify`, va luc do cong nay bang khong. Gop lai
# con ~6 giay. Phan loai tung ket qua bang `case` cua shell — khong spawn them.
#
# AIza+35 = Google (YouTube, Maps, Gemini) · hf_+34 = HuggingFace · sk- = OpenAI
# ghp_ = GitHub PAT · xox[baprs]- = Slack · AKIA = AWS
# \+84[35789]+8 chu so = so di dong Viet Nam, CHEP NGUYEN VAN tu luat
# `vn-mobile-number` trong .gitleaks.toml.
#
# Vi sao mau PII thuoc ve day chu khong chi o CI: ca mot lop du lieu du lich bi
# giu ngoai git VI LY DO NAY (xem .gitignore) — 416 so that trong tai lieu ban
# giao, 14.328 trong kho tho. Voi ho kinh doanh mot nguoi, "so doanh nghiep"
# chinh la so di dong ca nhan. Ban dau hook nay chi bat 6 mau khoa API va KHONG
# bat duoc dung lop du lieu ma no duoc dung de bao ve.
MAU='AIza[0-9A-Za-z_-]{35}|hf_[0-9A-Za-z]{34}|sk-[A-Za-z0-9]{20,}|ghp_[0-9A-Za-z]{36}|xox[baprs]-[0-9A-Za-z-]{10,}|AKIA[0-9A-Z]{16}|\+84[35789][0-9]{8}'

TMP="${TMPDIR:-/tmp}/bb-secret-scan-$$"
trap 'rm -f "$TMP"' EXIT INT TERM

# QUET BAN DA STAGE (`git show :file`), KHONG QUET FILE TREN O DIA.
#
# Hai thu do khac nhau, va commit lay ban da stage. Neu quet o dia thi:
#   git add config.ts      (con chua khoa)
#   <sua file, xoa khoa, KHONG add lai>
#   git commit             -> quet ban sach tren o dia, PASS, commit van mang khoa
# Do dung la truong hop hook nay sinh ra de chan. Chieu nguoc lai cung sai: mot
# khoa chi nam o o dia (chua stage) se chan mot commit hoan toan sach.
#
# `git show` that bai = KHONG doc duoc ban da stage, va "khong doc duoc" phai
# keu len chu khong duoc im lang di qua — im lang o day chinh la fail-open.
# Truong hop hay gap nhat: ten file co dau cach hoac ky tu khong phai ASCII
# (git mac dinh boc trong dau nhay va escape), nen `$f` khong con la duong dan that.
for f in $FILES; do
  if ! git show ":$f" > "$TMP" 2>/dev/null; then
    echo "  ⚠ khong doc duoc ban da stage  ->  $f"
    echo "    (ten file co dau cach / ky tu la? Xem core.quotepath)"
    FOUND=1
    continue
  fi

  # -I bo qua file nhi phan (.docx, anh) — chung khong chua khoa dang van ban
  hits=$(grep -I -oE "$MAU" "$TMP") || hits=''
  [ -z "$hits" ] && continue

  daBao=''
  for h in $hits; do
    case "$h" in
      +84*)
        d=${h#+}
        # Neu vi ly do nao do khong doc duoc allowlist, KHONG bo qua gi ca —
        # that bai phai nghieng ve phia chan, khong phai phia cho qua.
        if [ -n "$SDT_GIA" ]; then
          case " $SDT_GIA " in *" $d "*) continue ;; esac
        fi
        nhan='So di dong Viet Nam (PII)' ;;
      AIza*) nhan='Google API key' ;;
      hf_*)  nhan='HuggingFace token' ;;
      sk-*)  nhan='OpenAI-style secret key' ;;
      ghp_*) nhan='GitHub personal access token' ;;
      xox*)  nhan='Slack token' ;;
      AKIA*) nhan='AWS access key id' ;;
      *)     continue ;;
    esac

    case "$daBao" in *"[$nhan]"*) ;; *)
      daBao="$daBao[$nhan]"
      echo "  ✖ $nhan  ->  $f"
      FOUND=1 ;;
    esac
    # Chi in lai gia tri khi la so dien thoai: no ngan, khong phai bi mat, va
    # nguoi sua can biet CHINH so nao chua duoc che. Khoa API thi khong in.
    case "$h" in +84*) echo "      $h" ;; esac
  done
done

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
