# -*- coding: utf-8 -*-
"""Ranh gioi tinh (boundary.geojson) + point-in-polygon — CHUNG cho sweep/build.

bbox chu nhat 1 tinh lan sang tinh ke (Quang Ninh <-> Hai Phong); clip theo polygon THAT
de khong gan sai tinh (mot claim SAI provenance). Khong co boundary.geojson -> khong clip.
Tach ra module de sweep_osm_diem_den/nha_hang/luu_tru dung chung (doctrine shared-rule).
"""
import os, io, json


def load_boundary(raw):
    p = os.path.join(raw, "boundary.geojson")
    if not os.path.exists(p):
        return None
    g = json.load(io.open(p, encoding="utf-8"))
    t = g.get("type")
    if t == "Polygon":
        return [g["coordinates"]]
    if t == "MultiPolygon":
        return g["coordinates"]
    return None


def _pip_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def in_boundary(lon, lat, polys):
    if polys is None:
        return True
    for poly in polys:                       # poly = [outer_ring, hole1, ...]
        if _pip_ring(lon, lat, poly[0]) and not any(_pip_ring(lon, lat, h) for h in poly[1:]):
            return True
    return False
