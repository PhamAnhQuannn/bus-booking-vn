# -*- coding: utf-8 -*-
"""T2 — do MUC CHU Y CONG CHUNG cho tung mon, bang YouTube Data API.

╔═══════════════════════════════════════════════════════════════════════════╗
║ KET QUA: TIN HIEU NAY KHONG DUNG DUOC. DA CHAY, DA DO, KHONG IN VAO TAI   ║
║ LIEU. Giu script lai de khong ai phai lam lai va phat hien lai.           ║
╚═══════════════════════════════════════════════════════════════════════════╝

Chay ngay 29/07/2026 tren 30 mon, khoa hoat dong, 30/30 tra ve so. Ba bang
chung doc lap cho thay `totalResults` KHONG do duoc do noi tieng:

1. BI CHAN TRAN. Bon mon dung o DUNG 1.000.000 (Trứng nướng, Cơm lam, Bánh mì,
   Mứt Đà Lạt) va khong mon nao vuot. Day la uoc luong bi chan, khong phai so
   dem — Google khong cam ket con so nay chinh xac.

2. DAO NGUOC. `Lẩu gà lá é` — 56 co so, lau noi tieng nhat Da Lat — hang 28/30,
   THAP HON `Cháo` (hang 23). `Trứng nướng` chi 2 co so lai hang 1/30.

3. PHAN BO QUA DET. Trung vi 738.036 va 20/30 mon nam trong khoang 300k-1tr.

NGUYEN NHAN: truy van "Trứng nướng Đà Lạt" khop ca video ve trung nuong o BAT
CU DAU lan video ve Da Lat noi chung — YouTube khop long, nen tu cang CHUNG thi
vung ket qua cang lon. No do DO PHO BIEN CUA TU NGU, khong do do noi tieng cua
mon o Da Lat.

Day la lan THU HAI trong phase nay mot chi so nghe hop ly lai dao nguoc cau tra
loi: lan dau la SO QUAN (Lẩu 229 / Phở 89 dan dau, kem bo 7 nam cuoi), lan nay
la SO VIDEO. Thu lam duoc viec tach dac san khoi mon pho thong hoa ra la NHOM
PHAN LOAI — mot phan doan bien tap co dan nhan, khong phai mot con so.

Bai hoc: mot chi so co san va de lay khong tu dong la bang chung cho khang dinh
ta muon chung minh. Phai kiem chi so DO DUOC DUNG THU KHONG truoc khi in no ra
canh mot nhan nhu "do noi tieng".

───────────────────────────────────────────────────────────────────────────────

VI SAO CAN: "noi tieng" la mot KHANG DINH, va truoc buoc nay ta chi co so co so
ban — thu do DO PHO BIEN CUA VIEC BAN, khong phai do noi tieng. Da chung minh
no gay hieu sai: xep theo so co so thi Lẩu 229, Phở 90, Cháo 43 dan dau, con
banh trang nuong 24 va kem bo 7 nam cuoi. Nguoi doc quet tu tren xuong se tu
van khach an pho o Da Lat.

So video cho truy van "<mon> Đà Lạt" do mot thu KHAC: muc chu y cua cong chung.
Khong thay the so co so, ma la mot cot RIENG canh no.

═════════════════════════════════════════════════════════════════════════════
CHI LAY DUY NHAT `totalResults`.

Khong luu tieu de, khong luu ten kenh, khong luu ID video, khong luu mo ta.
Day la thu giu toan bo viec nay NGOAI pham vi PDPL 2025 — luat khong co mien
tru "da dang cong khai", nen mot con so tong hop thi khong phai du lieu ca
nhan, con mot tieu de kem ten kenh thi la. Cung ly do Phase O cat vung bai
dang TRUOC khi doc thay vi loc sau.

KHOA: doc tu os.environ -> .env.tourism.local. KHONG in ra, KHONG ghi vao repo.
Ngay 27/07 mot token HuggingFace da lo dung theo kieu no nam trong file thuoc
thu muc lam viec va cong cu doc file day noi dung vao transcript.
═════════════════════════════════════════════════════════════════════════════

Han muc: 10.000 don vi/ngay, `search.list` ton 100 -> 100 luot/ngay. Bo nay
dung ~30 luot. Co bo nho dem `yt_mon.json` nen chay lai khong goi lai.

Chay:  python scripts/tourism/sweep_youtube_mon.py <thu-muc-raw>
"""
import json, os, sys, io, time, urllib.parse, urllib.request, urllib.error

RAW = sys.argv[1]
OUT = os.path.join(RAW, "yt_mon.json")
API = "https://www.googleapis.com/youtube/v3/search"


def doc_khoa():
    """os.environ -> .env.tourism.local. Tra ve khoa va TEN NOI tim thay,
    khong bao gio tra ve hay in gia tri o log."""
    k = os.environ.get("YOUTUBE_API_KEY")
    if k and k.strip():
        return k.strip(), "biến môi trường"
    for p in (".env.tourism.local", ".env.local"):
        if not os.path.exists(p):
            continue
        for line in io.open(p, encoding="utf-8"):
            if line.startswith("YOUTUBE_API_KEY"):
                _, _, v = line.partition("=")
                v = v.strip().strip("'\"")
                if v:
                    return v, p
    return None, None


khoa, nguon = doc_khoa()
if not khoa:
    print("KHONG tim thay YOUTUBE_API_KEY (biến môi trường hoặc .env.tourism.local).")
    print("Cột số video sẽ để TRỐNG — không suy đoán.")
    sys.exit(0)
print(f"khoá đọc từ: {nguon}  (giá trị không in ra)\n")

mon = json.load(io.open(os.path.join(RAW, "mon_an_dalat.json"), encoding="utf-8"))
dem = json.load(io.open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}

can = [k for k, v in mon.items() if v["quan"] and k not in dem]
print(f"{len(mon)} món · đã có trong bộ nhớ đệm {len(dem)} · cần gọi {len(can)} lượt")
print(f"(hạn mức 100 lượt/ngày, search.list tốn 100 đơn vị)\n")

for i, label in enumerate(can, 1):
    # Bo phan trong ngoac khoi truy van: "Dâu tây (vườn / quán)" -> "Dâu tây".
    q = label.split("(")[0].split("·")[0].strip() + " Đà Lạt"
    url = API + "?" + urllib.parse.urlencode({
        "part": "snippet", "type": "video", "maxResults": 1,
        "q": q, "key": khoa, "relevanceLanguage": "vi", "regionCode": "VN",
    })
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            d = json.load(r)
        # DUY NHAT con so nay duoc giu. `items` bi bo ngay tai day.
        dem[label] = {"truy_van": q,
                      "so_video": d.get("pageInfo", {}).get("totalResults")}
        print(f"[{i:2d}/{len(can)}] {label[:30]:32s}{dem[label]['so_video']:>10,}"
              .replace(",", "."))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:160]
        print(f"[{i:2d}/{len(can)}] {label[:30]:32s}  LỖI {e.code}")
        if e.code in (403, 429):
            print(f"    {body}")
            print("    Hết hạn mức hoặc khoá bị chặn — DỪNG. Các món còn lại để trống.")
            break
    except Exception as e:
        print(f"[{i:2d}/{len(can)}] {label[:30]:32s}  LỖI {type(e).__name__}")
    time.sleep(0.4)

json.dump(dem, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

co = {k: v for k, v in dem.items() if v.get("so_video")}
print(f"\n{len(co)}/{len([1 for v in mon.values() if v['quan']])} món có số video\n")
print(f"{'Món':32s}{'Cơ sở':>7s}{'Video':>12s}  Nhóm")
for label, v in sorted(co.items(), key=lambda x: -(x[1]["so_video"] or 0)):
    n = len(mon[label]["quan"])
    print(f"{label[:30]:32s}{n:7d}{v['so_video']:12,}".replace(",", ".")
          + f"  {mon[label]['nhom']}")
print(f"\nsaved -> {OUT}")
print("raw/ chỉ chứa con số tổng — không tiêu đề, không tên kênh, không ID video.")
