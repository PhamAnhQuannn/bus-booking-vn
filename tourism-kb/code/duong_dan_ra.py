# -*- coding: utf-8 -*-
"""Chan duong ong tourism ghi ra ngoai cac thu muc da duoc gitignore.

VI SAO CAN, KHI DA CO .gitignore
================================
Vi luat ignore khong the phu het. MOI duong dan ra trong duong ong nay deu den
tu `argv`: nam script `build_*` lay `sys.argv[2]`, sau script quet lay
`sys.argv[1]`, hai muoi lam script con lai ghep tu `RAW = sys.argv[1]`. Mot luat
ignore chi biet TEN va NOI, con `argv` thi tuy nguoi go.

Do bang so — chin duong dan hop ly ma mot builder co the bi tro vao, tam duong
dan trong so do KHONG bi ignore (nen phai chan ngay tai luc GHI):

    tourism-kb/output/da-lat/Diem-Den-Da-Lat.docx  duoc phep  <- ban phat hanh
    tourism-kb/raw/x.json                     duoc phep   <- du lieu tho
    docs/tourism-guide.md                      COMMIT DUOC
    docs/qa/dalat-data.md                      COMMIT DUOC
    scripts/tourism/out.md                     COMMIT DUOC
    documentation/dalat.md                     COMMIT DUOC
    issues/dalat-quan.md                       COMMIT DUOC
    bao-cao.md                                 COMMIT DUOC
    docs/design/dalat.md                       COMMIT DUOC

Them luat ignore la cuoc choi da thua: du an nay da hai lan bi lot vi luat theo
NOI — `diem_den_chot.json` roi vao thu muc script chu khong phai thu muc du lieu,
va `scratch_out*.txt` khong khop mau nao. Nen thay vi doan tiep xem file se roi o
dau, chan ngay tai luc GHI.

Day la lop THU HAI trong hai lop. Lop kia la `G8` trong
`scripts/audit/greppable-invariants.sh`, chay tren CI va bao loi neu co bat ky
file sinh ra nao bi THEO DOI (bat ca `git add -f`). Lop nay ngan file ra doi sai
cho; lop kia ngan no bi day len. Can ca hai: mot file ghi dung cho van co the bi
`git add -f`, va mot file ghi sai cho van co the khong bao gio duoc commit.

NOI DUNG LA PII, KHONG PHAI DUNG LUONG
======================================
`tourism-kb/raw/` giu 14.328 so di dong Viet Nam that, `tourism-kb/wiki/` giu
416. Voi ho kinh doanh mot nguoi — vuon dau, tiem thue xe may — "so doanh
nghiep" chinh la so ca nhan. Repo nay duoc chuyen CONG KHAI trong luc `/ship` de
lay CI mien phi, nen commit dong nghia voi cong bo.
"""
import os
import sys

# Thu muc goc repo, suy ra tu vi tri file nay (tourism-kb/code/ -> len hai cap).
# Khong goi `git rev-parse` — module nay phai chay duoc ca khi khong co git.
GOC = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Bon thu muc con cua tourism-kb/ duoc ghi thoai mai o moi do sau: du lieu tho +
# trung gian (raw), tai lieu ban giao (wiki), ban phat hanh .docx (output), va du
# lieu xuat cho planner (export — JSON co SDT that). Ca bon deu da nam trong
# .gitignore (qua tourism-kb/.gitignore); danh sach nay va cac luat ignore do phai
# noi cung mot dieu — sua mot ben thoi la vo hieu hoa guard.
THU_MUC_CHO_PHEP = ("tourism-kb/raw", "tourism-kb/wiki", "tourism-kb/output", "tourism-kb/export")


def _tuong_doi(duong_dan):
    """Duong dan tuyet doi, da chuan hoa, tinh tuong doi so voi goc repo.

    Dung `abspath` + `normpath` chu khong so khop chuoi: nguoi goi co the dua
    duong dan tuyet doi, hoac duong dan co `..` (mot cach di vong ra ngoai vung
    cho phep ma so khop tien to khong nhin thay). Tra ve `None` neu dich nam
    hoan toan ngoai repo.
    """
    tuyet_doi = os.path.normpath(os.path.abspath(duong_dan))
    goc = os.path.normpath(GOC)
    if tuyet_doi == goc:
        return None
    if not tuyet_doi.startswith(goc + os.sep):
        return None
    return tuyet_doi[len(goc) + 1:].replace(os.sep, "/")


def duoc_phep(duong_dan):
    """True neu ghi vao `duong_dan` la hop le. Thuan tuy, khong in, khong thoat.

    Tach khoi `kiem_loi_ra` de kiem duoc bang so bia — mot ham chi biet thoat
    tien trinh thi khong test duoc ca hai chieu, va mot phep kiem chi thu chieu
    TU CHOI khong phan biet duoc guard dung voi guard tu choi tat ca.
    """
    rel = _tuong_doi(duong_dan)
    if rel is None:
        return False
    for thu_muc in THU_MUC_CHO_PHEP:
        if rel == thu_muc or rel.startswith(thu_muc + "/"):
            return True
    return False


def kiem_loi_ra(duong_dan):
    """Dung chuong trinh neu `duong_dan` nam ngoai vung cho phep.

    Goi TRUOC khi mo file de ghi. Thoat 1 kem thong diep noi ro duoc ghi vao dau
    — mot guard chi noi "khong duoc" ma khong noi "vay o dau" se bi go bo.
    """
    if duoc_phep(duong_dan):
        return duong_dan

    rel = _tuong_doi(duong_dan)
    o_dau = rel if rel is not None else os.path.abspath(duong_dan) + "  (ngoai repo)"
    sys.stderr.write(
        "\n"
        "  ─────────────────────────────────────────────────────────────\n"
        "  TU CHOI GHI — duong dan nam ngoai vung duoc gitignore.\n"
        "\n"
        "    dich:  {}\n"
        "\n"
        "  Duong ong tourism sinh ra du lieu chua SO DIEN THOAI THAT cua ho\n"
        "  kinh doanh nho. Repo nay chuyen cong khai trong luc /ship, nen mot\n"
        "  file sinh ra nam ngoai vung ignore la mot file co the bi cong bo.\n"
        "\n"
        "  Ghi vao mot trong nhung noi sau:\n"
        "    tourism-kb/raw/...        (moi du lieu tho va trung gian)\n"
        "    tourism-kb/wiki/...       (tai lieu ban giao)\n"
        "    tourism-kb/output/<dia-diem>/...  (ban phat hanh .docx, theo dia diem)\n"
        "    tourism-kb/export/<dia-diem>/...  (JSON xuat cho planner, co SDT that)\n"
        "\n"
        "  Neu that su can mot noi moi: them luat vao tourism-kb/.gitignore VA\n"
        "  vao THU_MUC_CHO_PHEP trong tourism-kb/code/duong_dan_ra.py cung luc.\n"
        "  Sua mot ben thoi la cach guard nay tro thanh vo nghia.\n"
        "  ─────────────────────────────────────────────────────────────\n"
        "\n".format(o_dau)
    )
    raise SystemExit(1)
