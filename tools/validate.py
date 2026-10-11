"""校验转录产出的试卷JSON：schema、题号连续、答案齐全、选项数量。"""
import json, glob, sys, re

POL_TYPES = {"single", "analysis", "short", "essay"}
ENG_TYPES = {"phonetics", "single", "cloze", "reading", "dialogue", "composition"}
CHOICE = {"single", "phonetics", "cloze", "reading", "dialogue"}

def check(path):
    issues = []
    with open(path) as f:
        data = json.load(f)
    subj, year = data["subject"], data["year"]
    valid_types = POL_TYPES if subj == "politics" else ENG_TYPES
    qs = data["questions"]
    nums = [q["number"] for q in qs]
    if nums != sorted(nums):
        issues.append(f"题号乱序: {nums[:5]}...")
    expect = list(range(1, len(qs) + 1))
    if nums != expect:
        missing = sorted(set(expect) - set(nums))
        extra = sorted(set(nums) - set(expect))
        if missing: issues.append(f"缺题号: {missing}")
        if extra: issues.append(f"多出题号: {extra}")
    no_ans, bad_opt = [], []
    counts = {}
    for q in qs:
        t = q["type"]
        counts[t] = counts.get(t, 0) + 1
        if t not in valid_types:
            issues.append(f"题{q['number']} type非法: {t}")
        if t in CHOICE:
            if not re.fullmatch(r"[A-H]", str(q.get("answer", ""))):
                no_ans.append(q["number"])
            opts = q.get("options") or []
            n_exp = 8 if t == "dialogue" else 4
            if len(opts) < 4 or len(opts) > n_exp or any(not str(o).strip() for o in opts):
                bad_opt.append(q["number"])
            if t in {"cloze", "reading", "dialogue"} and not q.get("passageId"):
                issues.append(f"题{q['number']} {t} 缺passageId")
        else:
            if not str(q.get("answer", "")).strip():
                no_ans.append(q["number"])
            if subj == "politics" and not str(q.get("stem", "")).strip():
                issues.append(f"题{q['number']} 主观题缺题干")
    if no_ans: issues.append(f"缺答案: {no_ans}")
    if bad_opt: issues.append(f"选项异常: {bad_opt}")
    return subj, year, counts, issues

def main(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        print("未找到文件:", pattern); sys.exit(1)
    total_issues = 0
    for p in files:
        try:
            subj, year, counts, issues = check(p)
        except Exception as e:
            print(f"{p}: 解析失败 {e}"); total_issues += 1; continue
        tag = "OK " if not issues else "BAD"
        print(f"[{tag}] {p.split('/')[-1]}  {counts}")
        for i in issues:
            print(f"      - {i}")
        total_issues += len(issues)
    print(f"\n共 {len(files)} 份，{total_issues} 个问题")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/raw/*.json")
