# -*- coding: utf-8 -*-
"""Loi dung chung cho MOI bo quet YouTube. CHI phan THUAN — khong goi mang.

VI SAO LA MODULE RIENG. Moi ham duoi day la mot su co da tra gia, va tat ca
deu can cho ca bo quet AN UONG lan bo quet LUU TRU:

    luu_json     ghi nguyen tu + ly do khong duoc `json.dump` thang
    ly_do_403    khoa bi thu hoi KHAC het han muc (28/07)
    chi_phi      HAI han muc, khong phai mot (28/07, mat 72 dong)
    nhat ky ngay mot lan chay khong biet gi ve lan chay truoc
    tim_cum      bien tu — `banh can` khong duoc khop trong `banh canh`
    co_ten_rieng ten toan tu chung thi khop moi thu (`Chè hé`)

Chep chung sang bo quet thu hai la tai lap dung lop loi du an da ghi so ngay
30/07: mot quy tac dung chung boi hai bo dung ma nam trong tung bo dung thi
mot ben se lech, va khong ai phat hien.

CO Y KHONG dua vao day: `goi()` va hai bo dem han muc. Chung bam vao bien toan
cuc cua tung bo quet (9-10 diem tham chieu moi cai), nen chuyen chung se doi
nhieu diem goi — va mot diem bo sot chi lo ra khi CHAY THAT, tuc ton han muc
khong hoan lai de phat hien. Thay vao do `chi_phi()` giu TRI THUC (lenh nao
ton bao nhieu, tren ca hai han muc), con bo dem thi de tai cho.
"""
import io
import json
import os
import time
import unicodedata

S_API = "https://www.googleapis.com/youtube/v3/search"
V_API = "https://www.googleapis.com/youtube/v3/videos"

MAX_KQ = 25              # video moi truy van
MIN_KENH = 2             # nguong bang chung: >=2 KENH khac nhau, khong phai video
MIN_TEN = 8              # do dai ten co so toi thieu (sau khi bo dau)

# ── HAI HAN MUC, KHONG PHAI MOT ────────────────────────────────────────────
# Ngay 28/07 mot bo quet chet giua duong voi
#     429 Quota exceeded for quota metric 'Search Queries'
# trong khi no in `3.400/10.000` va tuong con du 66%. Sai vi co HAI han muc
# doc lap va no chi dem MOT. Han muc reset NUA DEM PACIFIC = 14:00-15:00 gio
# Viet Nam.
TRAN_DON_VI = 10_000
TRAN_LENH_SEARCH = 100


def chi_phi(api):
    """(don_vi, lenh_search) cho mot lenh toi `api`.

    Day la TRI THUC da mat 72 dong du lieu de hoc: `search.list` ton 100 don vi
    VA 1 luot cua han muc thu hai; `videos.list` ton 1 don vi va 0 luot. Ngan
    sach don vi co the con 97% trong khi ngan sach luot da can.
    """
    return (100, 1) if api == S_API else (1, 0)


def luu_json(path, obj):
    """Ghi qua file tam roi os.replace — thay the file cu bang MOT phep toan.

    `json.dump` ghi thang vao file dich, nen mot lan ngat giua luc ghi de lai
    file JSON hong. Lan sau `json.load` that bai, roi `except: cu = []` lam MOC
    SO SANH im lang tut ve rong — khien MOI ket qua trong nhu cai thien va vo
    hieu hoa dung ban va chong ghi de. Bien the tinh vi hon cua chinh loi ma
    ban va do sinh ra de chan.
    """
    tmp = path + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def fold(s):
    s = (s or "").lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def tim_cum(hay, kim):
    """Vi tri cua `kim` trong `hay` VOI BIEN TU o ca hai dau.

    ⚠ Ban dau ca hai cho — khop ten co so va khop mon — dung `kim in hay` tran.
    Lan chay that lo ngay hau qua: `Bánh canh Xuân An` duoc gan mon `Bánh căn`,
    vi bo dau thi "banh canh xuan an" CHUA "banh can" lam tien to. Cung ho voi
    bay `bar`/`barber`, `sữa chua`/`sửa chữa` da ghi trong so nhieu lan.
    Rui ro doi xung ben ten co so: mot vlog noi "chè hẻm" ("che hem") se khop
    `Quán Chè Hé` ("che he") neu khong co bien tu.
    Van ban da bo dau nen chi con [0-9a-z ] — bien tu la ky tu khong alnum.
    """
    i = hay.find(kim)
    while i >= 0:
        truoc = hay[i - 1] if i else " "
        sau = hay[i + len(kim)] if i + len(kim) < len(hay) else " "
        if not truoc.isalnum() and not sau.isalnum():
            yield i
        i = hay.find(kim, i + 1)


def co_ten_rieng(ten_folded, tap_chung):
    """Ten co so con >=1 token NGOAI `tap_chung`?

    Luat phai DOC LAP VOI TRUY VAN. Ban dau no duoc viet THEO truy van — "ten
    phai co token khong xuat hien trong truy van tim ra no" — va van de lot ke
    te nhat (`Bánh tráng nướng` 52 lan, `Sua Dau Nanh` 33), vi mot co so ten
    dung bang ten mon con khop CA truy van chung ("ăn vặt Đà Lạt"), va so voi
    truy van do thi no CO token rieng. `any()` tren nhieu truy van la tu mo cua
    hau — bo loc bi dinh nghia boi truy van long nhat trong bo.

    `tap_chung` vi vay phai co dinh va suy tu DU LIEU, khong tu cau tim:
        an uong : MON_TU | CHUNG        ("Bánh tráng nướng" -> toan tu mon -> LOAI)
        luu tru : LUU_TRU_TU | CHUNG    ("Khách sạn Đà Lạt" -> toan tu chung -> LOAI)

    ⚠ Truoc khi thu token tu mot danh sach nhan vao `tap_chung`, kiem xem co
    nhan nao la DANH TU RIENG khong: `Chè hé` la mot cua hang co that, va khi
    no lot vao bo tu-mon thi `Quán Chè Hé` rut gon con toan tu chung va bi xoa
    khoi tu dien TRUOC khi so sanh chay.
    """
    return any(w not in tap_chung for w in ten_folded.split() if len(w) > 1)


def doc_khoa():
    """Khoa YouTube tu bien moi truong, roi `.env.tourism.local`, roi `.env.local`."""
    k = os.environ.get("YOUTUBE_API_KEY")
    if k and k.strip():
        return k.strip(), "biến môi trường"
    for p in (".env.tourism.local", ".env.local"):
        if os.path.exists(p):
            for line in io.open(p, encoding="utf-8"):
                if line.startswith("YOUTUBE_API_KEY"):
                    v = line.partition("=")[2].strip().strip("'\"")
                    if v:
                        return v, p
    return None, None


def ly_do_403(body):
    """403 KHONG dong nhat la het han muc.

    Ngay 28/07 khoa bi thu hoi va tra `API key expired`; script coi no la het
    han muc nen loi khuyen la "cho mai" — sai, cho mai khong sua duoc mot khoa
    da thu hoi. Ly do thuc nam o error.errors[0].reason.
    """
    try:
        e = json.loads(body)["error"]
        r = (e.get("errors") or [{}])[0].get("reason") or ""
        return r, e.get("message", "")[:120]
    except Exception:
        return "", body[:120]


# `quotaExceeded`/`rateLimitExceeded` -> mai lai co. Con lai -> khoa co van de.
LY_DO_HAN_MUC = {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded",
                 "userRateLimitExceeded"}


# ── SO LENH DA DUNG HOM NAY, LUU QUA CAC LAN CHAY ──────────────────────────
# Mot lan chay khong biet gi ve lan chay truoc, nen han muc theo NGAY la vo
# hinh voi no. Do la ly do that su bo quet chet 28/07: khong lan nao vuot 100,
# nhung ba lan cong lai thi vuot.
#
# ⚠ Nhat ky doc ra 0 KHONG phai bang chung han muc chua dung — lan chay dau
# tien sau khi them nhat ky la lan khong dang tin, vi luot dung truoc do vo
# hinh. Da xac nhan bang thuc te: mot lan chay tuong con nguyen ngan sach da
# chet sau 8 lenh.
def ngay_pacific():
    """Ranh gioi ngay tinh o UTC-8 chu khong phai UTC-7.

    Reset that la nua dem Pacific (UTC-7 mua he), nen UTC-8 lam bo dem doi them
    ~1 tieng moi reset — lech ve phia THAN TRONG, khong bao gio reset som hon
    thuc te.
    """
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() - 8 * 3600))


def doc_nhat_ky(path):
    """{ngay: so_lenh}. File hong/thieu -> {} (chi la bo dem, khong phai moc so sanh)."""
    if not os.path.exists(path):
        return {}
    try:
        return json.load(io.open(path, encoding="utf-8"))
    except Exception:
        return {}


def ghi_nhat_ky(path, nk, ngay, them):
    """Cong `them` lenh vao `ngay`, giu 14 ngay gan nhat."""
    nk[ngay] = int(nk.get(ngay, 0)) + them
    luu_json(path, {k: nk[k] for k in sorted(nk)[-14:]})
