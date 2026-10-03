"""Render a factual one-minute CWF Week 3 update for Z-Spend."""
import asyncio
import os
import subprocess
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
TEMP = ROOT / ".zspend" / "week3-video"
OUTPUT = ROOT / "demo" / "z-spend-week3-update.mp4"
W, H = 1920, 1080
BG = (11, 18, 32)
CARD = (30, 41, 59)
TEAL = (45, 212, 191)
WHITE = (241, 245, 249)
GREY = (148, 163, 184)
RED = (251, 113, 133)
FONTS = {
    "mono": r"C:\Windows\Fonts\consola.ttf",
    "mono_b": r"C:\Windows\Fonts\consolab.ttf",
    "sans": r"C:\Windows\Fonts\segoeui.ttf",
    "sans_b": r"C:\Windows\Fonts\segoeuib.ttf",
}

SLIDES = [
    (
        "WEEK 3 UPDATE",
        "Z-SPEND / TEMPO TRACK",
        [
            "Scoped agent spending controls on Tempo",
            "Moderato testnet evidence and final proof package",
        ],
        "Week three update for Z-Spend on the Tempo track. I completed the final proof package for a scoped agent spending-control prototype on Moderato testnet.",
    ),
    (
        "VERIFIED TESTNET FLOW",
        "WHAT THE DEMO SHOWS",
        [
            "$80 pathUSD payment: executed through the access key",
            "$160 marketing request: rejected by local policy",
            "$100 follow-up: rejected before mining after allowance exhaustion",
        ],
        "The demo documents the exact behavior. An 80 dollar pathUSD payment succeeded, a marketing request was rejected by policy, and a later payment was rejected before mining when its access-key allowance was exhausted.",
    ),
    (
        "DOCUMENTATION CORRECTION",
        "BOUNDARIES MADE EXPLICIT",
        [
            "Local policy evaluates execution state recorded in JSONL",
            "Tempo access-key limits provide the protocol-enforced ceiling",
            "No production or immutable-ledger claim",
        ],
        "I replaced inaccurate wording across the README, deck, and videos. Local policy uses JSONL execution state. The hard spending ceiling comes from Tempo's scoped access key.",
    ),
    (
        "READY FOR REVIEW",
        "PUBLIC, REPRODUCIBLE EVIDENCE",
        [
            "Public repository, corrected deck, and demo artifacts",
            "Seven focused policy tests pass",
            "Final review begins when the CWF submission window opens",
        ],
        "The repository now contains corrected artifacts, seven policy tests, and testnet evidence. Next is final review when the CWF submission window opens.",
    ),
]


def font(kind, size):
    path = FONTS[kind]
    return ImageFont.truetype(path, size)


def draw_slide(index, label, title, bullets):
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W, 12), fill=TEAL)
    draw.text((72, 58), label, font=font("mono_b", 27), fill=TEAL)
    draw.text((W - 190, 58), f"{index}/4", font=font("mono", 27), fill=GREY)
    draw.text((W // 2, 230), title, font=font("sans_b", 62), fill=WHITE, anchor="mm")
    draw.rounded_rectangle((180, 350, W - 180, 790), radius=22, fill=CARD, outline=(51, 65, 85), width=2)
    y = 445
    for bullet in bullets:
        color = RED if "rejected" in bullet.lower() else TEAL
        draw.ellipse((250, y + 11, 270, y + 31), fill=color)
        draw.text((310, y), bullet, font=font("sans", 34), fill=WHITE)
        y += 105
    draw.text((W // 2, 930), "github.com/sidsri14/tempo-zspend", font=font("mono", 28), fill=GREY, anchor="mm")
    return image


async def render():
    TEMP.mkdir(parents=True, exist_ok=True)
    clips = []
    for index, (label, title, bullets, narration) in enumerate(SLIDES, 1):
        frame = TEMP / f"week3-{index:02d}.png"
        audio = TEMP / f"week3-{index:02d}.mp3"
        clip = TEMP / f"week3-{index:02d}.mp4"
        draw_slide(index, label, title, bullets).save(frame)
        await edge_tts.Communicate(narration, "en-US-ChristopherNeural", rate="+2%").save(audio)
        subprocess.run([
            "ffmpeg", "-y", "-loop", "1", "-i", str(frame), "-i", str(audio),
            "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-b:a", "160k",
            "-pix_fmt", "yuv420p", "-t", "15", str(clip),
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        clips.append(clip)
    listing = TEMP / "clips.txt"
    listing.write_text("".join(f"file '{clip.as_posix()}'\n" for clip in clips), encoding="utf-8")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
        "-c", "copy", "-movflags", "+faststart", str(OUTPUT),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    asyncio.run(render())
