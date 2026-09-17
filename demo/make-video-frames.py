"""Render Z-Spend demo slides (1920x1080) to PNG frames for the CWF submission video."""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
OUT = os.path.join(os.path.dirname(__file__), "frames")
os.makedirs(OUT, exist_ok=True)

BG_TOP = (11, 18, 32)
BG_BOTTOM = (15, 27, 48)
TEAL = (45, 212, 191)
TEAL_DIM = (94, 234, 212)
RED = (251, 113, 133)
AMBER = (251, 191, 36)
WHITE = (241, 245, 249)
GREY = (148, 163, 184)
DARK_CARD = (30, 41, 59)

FONTS = {
    "mono": r"C:\Windows\Fonts\consola.ttf",
    "mono_b": r"C:\Windows\Fonts\consolab.ttf",
    "sans": r"C:\Windows\Fonts\segoeui.ttf",
    "sans_b": r"C:\Windows\Fonts\segoeuib.ttf",
    "sans_l": r"C:\Windows\Fonts\segoeuisl.ttf",
}


def font(kind, size):
    for p in [FONTS.get(kind, ""), r"C:\Windows\Fonts\arial.ttf"]:
        if p and os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def bg(d):
    d = d
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)))


def accent_bar(d):
    d.rectangle([(0, 0), (W, 10)], fill=TEAL)


def scene(d, label, idx):
    d.text((64, 56), label, font=font("mono_b", 26), fill=TEAL)
    d.text((W - 64 - 200, 56), f"{idx}/7", font=font("mono", 26), fill=GREY)


def card(d, x, y, w, h, fill=DARK_CARD):
    d.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=fill, outline=(51, 65, 85), width=2)


def title(d):
    accent_bar(d)
    d.text((W // 2, 300), "TEMPO Z-SPEND", font=font("sans_b", 96), fill=WHITE, anchor="mm")
    d.text((W // 2, 410), "On-Chain Enforced Agentic Treasury", font=font("sans_l", 44), fill=TEAL, anchor="mm")
    d.text((W // 2, 500), "Live on Moderato testnet \u00b7 chain 42431", font=font("mono", 34), fill=GREY, anchor="mm")
    d.rounded_rectangle([W // 2 - 300, 590, W // 2 + 300, 662], radius=36, outline=TEAL, width=3)
    d.text((W // 2, 626), "github.com/sidsri14/tempo-zspend", font=font("mono", 28), fill=WHITE, anchor="mm")
    d.text((W // 2, 760), "Crypto World's Fair 2026 \u00b7 Tempo Track", font=font("sans_b", 32), fill=GREY, anchor="mm")


def problem(d):
    scene(d, "PROBLEM", 1)
    d.text((W // 2, 180), "An AI agent with its own key can overspend.", font=font("sans_b", 52), fill=WHITE, anchor="mm")
    d.text((W // 2, 300), "Agent keys get compromised. A stolen key spends the whole vault.", font=font("sans", 34), fill=GREY, anchor="mm")
    card(d, 160, 400, 800, 360)
    d.text((200, 445), "[1] OFF-CHAIN POLICY \u2014 fail-closed verdicts", font=font("mono_b", 30), fill=TEAL)
    d.text((200, 505), "daily caps \u00b7 per-recipient caps \u00b7 reserve floor", font=font("mono", 26), fill=WHITE)
    d.text((200, 555), "immutable JSONL ledger \u00b7 7/7 policy tests", font=font("mono", 26), fill=WHITE)
    card(d, 960, 400, 800, 360)
    d.text((1000, 445), "[2] ON-CHAIN ACCESS KEY \u2014 protocol enforced", font=font("mono_b", 30), fill=TEAL)
    d.text((1000, 505), "Tempo TIP-1011 access keys: per-token spend", font=font("mono", 26), fill=WHITE)
    d.text((1000, 555), "limit + call scope, enforced at tx validation", font=font("mono", 26), fill=WHITE)
    d.text((1000, 605), "compromised key still cannot exceed allowance", font=font("mono", 26), fill=WHITE)


def authorize(d):
    scene(d, "STEP 2 \u00b7 ON-CHAIN", 3)
    d.text((W // 2, 180), "Authorize the agent key", font=font("sans_b", 52), fill=WHITE, anchor="mm")
    d.text((W // 2, 265), "Tempo protocol now enforces the agent's budget itself", font=font("sans", 32), fill=GREY, anchor="mm")
    rows = [
        ("agent key", "0xC63A31d7552852c5c444950110B0B9530f1c14f4", WHITE),
        ("limit", "$100 / day \u00b7 pathUSD", TEAL),
        ("scope", "pathUSD.transfer", TEAL),
        ("auth tx", "0xde369eed f9f6928c 0335962d ...", GREY),
    ]
    card(d, 260, 360, 1400, 420)
    y = 420
    for label, val, col in rows:
        d.text((340, y), label, font=font("mono_b", 30), fill=GREY)
        d.text((640, y), val, font=font("mono", 30), fill=col)
        y += 88
    d.text((W // 2, 880), "auth tx 0xde369eedf9f6928c0335962dfa076b74299f704ec25c1db1ec6ff48617753105", font=font("mono", 22), fill=GREY, anchor="mm")


def pay_approve(d):
    scene(d, "STEP 4 \u00b7 POLICY \u2713", 4)
    d.text((W // 2, 180), "pay-001 \u00b7 ops \u00b7 $80", font=font("sans_b", 52), fill=WHITE, anchor="mm")
    d.rounded_rectangle([W // 2 - 170, 260, W // 2 + 170, 330], radius=35, fill=(16, 185, 129))
    d.text((W // 2, 295), "APPROVE", font=font("mono_b", 32), fill=(5, 21, 16), anchor="mm")
    card(d, 260, 400, 1400, 300)
    d.text((340, 455), "policy verdict", font=font("mono_b", 28), fill=GREY)
    d.text((340, 510), "OK \u2014 reserve 500bps; category remaining $300.000000", font=font("mono", 28), fill=WHITE)
    d.text((340, 570), "executed through the authorized agent key", font=font("mono", 28), fill=WHITE)
    d.text((W // 2, 830), "tx 0x9a4425e8de802eb2820709474f055242f23c64ac63c5545c296b617d24ff0e2a", font=font("mono", 22), fill=GREY, anchor="mm")
    d.text((W // 2, 900), "$80 paid \u2014 mined on-chain seconds later", font=font("sans", 30), fill=TEAL, anchor="mm")


def pay_reject(d):
    scene(d, "STEP 5 \u00b7 POLICY \u2717", 5)
    d.text((W // 2, 180), "pay-002 \u00b7 marketing \u00b7 $160", font=font("sans_b", 52), fill=WHITE, anchor="mm")
    d.rounded_rectangle([W // 2 - 150, 260, W // 2 + 150, 330], radius=35, fill=RED)
    d.text((W // 2, 295), "REJECT", font=font("mono_b", 32), fill=(40, 6, 12), anchor="mm")
    card(d, 260, 400, 1400, 300, fill=(43, 30, 40))
    d.text((340, 455), "fail-closed verdict", font=font("mono_b", 28), fill=GREY)
    d.text((340, 510), "category 'marketing' daily cap exceeded", font=font("mono", 28), fill=RED)
    d.text((340, 570), "tried $160.00 / cap $150.00 / remaining $150.00 \u2014 no tx sent", font=font("mono", 28), fill=WHITE)
    d.text((W // 2, 830), "policy stops the over-spend before any signature", font=font("sans", 30), fill=WHITE, anchor="mm")


def pay_blocked(d):
    scene(d, "STEP 7 \u00b7 THE TEETH", 6)
    d.text((W // 2, 170), "pay-003 \u00b7 ops \u00b7 $100", font=font("sans_b", 52), fill=WHITE, anchor="mm")
    d.text((W // 2, 245), "policy said APPROVE \u2014 but the key is exhausted", font=font("sans", 32), fill=GREY, anchor="mm")
    card(d, 260, 320, 1400, 380)
    d.text((340, 380), "agent remaining allowance  $19.999495 / $100", font=font("mono_b", 34), fill=TEAL)
    d.text((340, 460), "attempting $100 transfer through the access key...", font=font("mono", 30), fill=WHITE)
    d.text((340, 540), "blocked on-chain \u2014 the contract function 'transfer' reverted:", font=font("mono", 30), fill=WHITE)
    d.text((340, 600), "  0x8a9e71ea", font=font("mono_b", 30), fill=RED)
    d.rounded_rectangle([W // 2 - 380, 750, W // 2 + 380, 840], radius=34, outline=RED, width=3)
    d.text((W // 2, 795), "THE CHAIN REFUSED", font=font("mono_b", 34), fill=RED, anchor="mm")


def report(d):
    scene(d, "DAILY REPORT", 8)
    d.text((W // 2, 170), "Treasury report \u2014 closed, audited, enforced", font=font("sans_b", 48), fill=WHITE, anchor="mm")
    card(d, 260, 290, 1400, 400)
    rows = [
        ("engineering", "$0.00 / $200.00", "0%"),
        ("marketing", "$0.00 / $150.00", "0%"),
        ("ops", "$80.00 / $300.00", "26.66%"),
    ]
    y = 350
    for cat, cap, used in rows:
        d.text((340, y), cat, font=font("mono", 30), fill=WHITE)
        d.text((760, y), cap, font=font("mono", 30), fill=WHITE)
        d.text((1060, y), used + " used", font=font("mono", 30), fill=TEAL)
        y += 90
    d.text((340, 620), "total spend today $80 \u00b7 executed on-chain $80 \u00b7 per-recipient cap $250", font=font("mono", 26), fill=GREY)
    d.text((W // 2, 780), "An agent that cannot overspend \u2014 even with its own key.", font=font("sans_b", 44), fill=TEAL, anchor="mm")
    d.text((W // 2, 880), "run it:  npm install && npm test && npm run demo", font=font("mono", 28), fill=GREY, anchor="mm")


SLIDES = [title, problem, authorize, pay_approve, pay_reject, pay_blocked, report]

for i, fn in enumerate(SLIDES, 1):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    bg(d)
    fn(d)
    p = os.path.join(OUT, f"slide-{i:02d}.png")
    img.save(p)
    print("wrote", p)
print("done", len(SLIDES))