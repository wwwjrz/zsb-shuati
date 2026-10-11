"""把真题PDF逐页渲染为PNG，供视觉转录使用。"""
import pymupdf, os, sys

BASE = "/Users/staid/Downloads/理工类"
OUT = f"{BASE}/专升本刷题/pages_png"

PAPERS = {
    "pol": [("政治/历年真题", f"{y}年专升本政治考试试题及答案详解.pdf") for y in range(2014, 2020)] + [
        ("政治/历年真题", "2020年专升本（政治）真题及答案解析.pdf"),
        ("政治/历年真题", "2021年专升本（政治）真题及答案解析.pdf"),
        ("政治/历年真题", "2022年专升本（政治）真题及答案解析.pdf"),
        ("政治/历年真题", "2023年专升本（政治）真题及答案解析.pdf"),
        ("政治/历年真题", "2024年专升本（政治）真题及答案解析.pdf"),
        ("政治/历年真题", "2025年专升本（政治）真题及答案解析.pdf"),
    ],
    "eng": [("英语/英语历年真题", f"{y}年专升本英语考试试题及答案详解.pdf") for y in range(2014, 2020)] + [
        ("英语/英语历年真题", "2020年专升本（英语）真题及答案解析.pdf"),
        ("英语/英语历年真题", "2021年专升本（英语）真题及答案解析.pdf"),
        ("英语/英语历年真题", "2022年专升本（英语）真题及答案解析.pdf"),
        ("英语/英语历年真题", "2023年专升本英语考试试题及答案详解(a4版本).pdf"),
        ("英语/英语历年真题", "2024年全国成人高考【专升本-英语】真题试卷+答案解析.pdf"),
        ("英语/英语历年真题", "2025年成考专升本英语真题及答案解析.pdf"),
    ],
}

only = sys.argv[1] if len(sys.argv) > 1 else None
for subj, papers in PAPERS.items():
    if only and subj != only:
        continue
    for folder, fname in papers:
        year = next(y for y in range(2014, 2026) if str(y) in fname)
        dest = f"{OUT}/{subj}-{year}"
        os.makedirs(dest, exist_ok=True)
        if os.path.exists(f"{dest}/p1.png"):
            print(f"{subj}-{year}: 已存在，跳过")
            continue
        doc = pymupdf.open(f"{BASE}/{folder}/{fname}")
        for i, page in enumerate(doc):
            page.get_pixmap(dpi=150).save(f"{dest}/p{i+1}.png")
        print(f"{subj}-{year}: {len(doc)}页 完成")
