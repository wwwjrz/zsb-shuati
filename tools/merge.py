"""把 data/raw/ 下的逐卷JSON合并为应用使用的 data/politics.json / data/english.json。"""
import json, glob, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBJ = {"politics": ("pol", "政治", "politics.json"),
        "english": ("eng", "英语", "english.json")}

def norm_question(subj_abbr, year, q):
    return {
        "id": f"{subj_abbr}-{year}-{q['number']:02d}",
        "n": q["number"],
        "type": q["type"],
        "stem": str(q.get("stem") or "").strip(),
        "options": q.get("options"),
        "answer": str(q.get("answer") or "").strip(),
        "exp": str(q.get("explanation") or "").strip(),
        "pid": q.get("passageId"),
    }

def merge(prefix, subject):
    papers = {}
    for path in sorted(glob.glob(f"{BASE}/data/raw/{prefix}-*.json")):
        year = int(path.rsplit("-", 1)[1].split(".")[0])
        with open(path) as f:
            raw = json.load(f)
        _, abbr, _ = SUBJ[subject]
        qs = [norm_question(abbr, year, q) for q in raw["questions"]]
        qs.sort(key=lambda x: x["n"])
        passages = {}
        for p in raw.get("passages", []):
            passages[p["id"]] = p.get("text", "").strip()
        papers[str(year)] = {"title": raw.get("title", ""), "passages": passages, "questions": qs}
    out = {"subject": subject, "name": SUBJ[subject][1],
           "years": sorted(papers, reverse=True, key=int), "papers": papers}
    dest = f"{BASE}/data/{SUBJ[subject][2]}"
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(p["questions"]) for p in papers.values())
    print(f"{dest}: {len(papers)}卷 {n}题")

if __name__ == "__main__":
    merge("pol", "politics")
    merge("eng", "english")
