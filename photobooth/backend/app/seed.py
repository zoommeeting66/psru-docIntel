"""Seed reference data: roles, scene categories, scenes, outfits, branding, event.

Idempotent — safe to run repeatedly. Invoked on startup in dev.
"""
from __future__ import annotations

from sqlalchemy import select

from .db import SessionLocal
from .models import (
    BrandingTemplate,
    Event,
    Outfit,
    Role,
    Scene,
    SceneCategory,
)

ROLES = [
    ("admin", ["*"]),
    ("operator", ["session.*", "capture.*", "output.read", "scene.read"]),
    ("executive", ["dashboard.read", "report.read"]),
    ("user", ["session.self", "output.self"]),
]

CATEGORIES = [
    "PSRU Campus", "พิธีการ", "Academic", "Studio",
    "Future", "Nature", "Heritage", "VIP",
]

SCENES = [
    ("หอประชุมศรีวชิรโชติ", "PSRU Campus", True, False),
    ("อาคารเรียน PSRU", "PSRU Campus", True, False),
    ("พิธีพระราชทานปริญญาบัตร", "พิธีการ", False, True),
    ("ห้องรับรอง VIP", "VIP", True, False),
    ("ห้องประชุมผู้บริหาร", "Academic", True, False),
    ("ห้องเรียนอัจฉริยะ", "Academic", True, False),
    ("ห้องสมุดดิจิทัล", "Academic", True, False),
    ("เวทีประชุมวิชาการ", "Academic", True, False),
    ("สตูดิโอข่าว", "Studio", False, False),
    ("เมืองอนาคต", "Future", True, False),
    ("อวกาศ", "Future", True, False),
    ("ธรรมชาติ", "Nature", True, False),
    ("พิพิธภัณฑ์", "Heritage", True, False),
    ("วัดไทย", "Heritage", True, False),
    ("เมืองโบราณ", "Heritage", True, False),
    ("พระราชวัง (เชิงสัญลักษณ์)", "Heritage", False, True),
]

OUTFITS = [
    ("ชุดครุย", "gown"), ("ชุดสูท", "suit"), ("ชุดไทย", "thai"),
    ("ชุดพิธีการ", "ceremony"), ("ชุดนักศึกษา", "student"),
    ("ชุดผู้บริหาร", "executive"), ("ชุดกีฬา", "sport"), ("ชุดแฟชั่น", "fashion"),
]


async def seed() -> None:
    async with SessionLocal() as db:
        if await db.scalar(select(Role).limit(1)) is not None:
            return  # already seeded

        for name, perms in ROLES:
            db.add(Role(name=name, permissions=perms))

        cats: dict[str, SceneCategory] = {}
        for i, name in enumerate(CATEGORIES):
            c = SceneCategory(name=name, sort_order=i)
            cats[name] = c
            db.add(c)
        await db.flush()

        for name, cat, is_360, restricted in SCENES:
            db.add(Scene(
                name=name,
                category_id=cats[cat].id,
                is_360=is_360,
                is_symbolic_restricted=restricted,
            ))

        for name, cat in OUTFITS:
            db.add(Outfit(name=name, category=cat))

        brand = BrandingTemplate(
            name="PSRU Default",
            watermark={"text": "PSRU · AI-generated", "opacity": 0.15},
            show_qr=True,
            layout={"title": "top", "image_no": "bottom-right"},
        )
        db.add(brand)
        await db.flush()

        db.add(Event(
            name="พิธีพระราชทานปริญญาบัตร 2569",
            slug="grad-2569",
            start_date="2026-07-15",
            end_date="2026-07-17",
            default_branding_id=brand.id,
        ))

        await db.commit()
