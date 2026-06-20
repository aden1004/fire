# python-hwpx 로 양식 만들기 (한컴오피스 없이)

> 한컴오피스가 없는 환경(Linux, Docker, GitHub Actions 등)에서 양식을 만들 때 사용하는 방법. 결과물은 단순한 구조의 양식이므로, 한컴오피스가 있다면 한글에서 직접 디자인하는 것이 훨씬 빠르고 결과가 좋다.

이 저장소의 `report` 양식을 제외한 4종(공문서, 학부모 안내문, 회의록, 운영 계획서)은 이 방법으로 만들어졌다.

---

## 기본 패턴

```python
import os, sys
from hwpx import HwpxDocument

# fix_namespaces 호출 가능하게 경로 설정
sys.path.insert(0, "scripts")
from fix_namespaces import fix_hwpx_namespaces

OUTPUT = "assets/<양식종류>/template.hwpx"
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = HwpxDocument.new()

# 단락 추가
doc.add_paragraph("◆placeholder_1◆")
doc.add_paragraph("일반 텍스트")

# 반복 항목: 같은 placeholder를 N번
PH = "◆본문 항목◆"
for prefix in ["1. ", "2. ", "3. "]:
    doc.add_paragraph(prefix + PH)

# 표 추가 (행, 열)
table = doc.add_table(rows=3, cols=2)
table.set_cell_text(0, 0, "헤더1")
table.set_cell_text(0, 1, "헤더2")
table.set_cell_text(1, 0, "◆값1◆")
table.set_cell_text(1, 1, "◆값2◆")

# 저장 + 네임스페이스 후처리
doc.save_to_path(OUTPUT)
fix_hwpx_namespaces(OUTPUT)
```

---

## Placeholder 작성 규칙

### 규칙 1: `◆…◆` 마커 사용

placeholder는 본문에서 우연히 등장할 수 없는 고유 문자열이어야 한다. `◆` 같은 특수 문자로 감싸면 안전하다.

```python
# ✅ 좋은 예
"◆수신처를 여기에 입력◆"
"◆회의 일시 (예: 2026. 5. 30.(목) 14:00~16:00)◆"

# ❌ 피해야 할 예
"제목"      # 본문에서 우연히 등장 가능
"여기 입력"  # 너무 일반적
```

### 규칙 2: 같은 위계의 반복 항목은 동일한 placeholder

본문 항목이 여러 개 반복되는 경우, **모든 자리에 동일한 placeholder 텍스트**를 박는다. `render.py`의 `sequential` 타입이 이를 순서대로 1개씩 치환한다.

```python
# ✅ 좋은 예 (모두 같은 PH 사용)
PH = "◆본문 항목◆"
for prefix in ["1. ", "2. ", "3. "]:
    doc.add_paragraph(prefix + PH)

# ❌ 잘못된 예 (각 자리가 다른 PH)
doc.add_paragraph("1. ◆본문 항목 1◆")
doc.add_paragraph("2. ◆본문 항목 2◆")
# → sequential 치환이 동작하지 않음 (각각 별도 placeholder가 됨)
```

### 규칙 3: 안내 텍스트는 placeholder 안에 포함

placeholder에 어떤 값이 들어가야 하는지 힌트를 넣으면 좋다.

```python
"◆회의 일시 (예: 2026. 5. 30.(목) 14:00~16:00)◆"
"◆발송일 (예: 2026. 5. 30.)◆"
```

이렇게 하면 사용자가 양식만 봐도 어떻게 채워야 할지 알 수 있다.

---

## 양식 만든 후 메타파일 작성

1. 양식의 텍스트 노드 확인:
   ```python
   from hwpx import ObjectFinder
   from collections import Counter

   finder = ObjectFinder("template.hwpx")
   texts = [r.text for r in finder.find_all(tag="t") if r.text and r.text.strip()]
   for t, c in Counter(texts).most_common():
       print(f"  [{c}회] {t!r}")
   ```

2. `scripts/scan_template.py` 자동 추출:
   ```bash
   python scripts/scan_template.py template.hwpx -o template.meta.json
   ```

3. 생성된 `template.meta.json` 의 `key`, `name`, `description`, `required` 를 수동 편집.

4. 메타-양식 일치성 검증 스크립트 실행 (`references/creating-new-template.md` 의 Step 3 참고).

---

## python-hwpx 의 한계

`HwpxDocument.new()` 로 만든 빈 문서는 다음 같은 디자인 요소가 **기본값**으로 들어간다:

- 글꼴: 한컴 기본 글꼴 (사용자 환경에 따라 다름)
- 글자 크기: 기본 (보통 10pt)
- 머리글/바닥글: 없음
- 페이지 번호: 없음
- 표 디자인: 단순 테두리

이런 요소들은 코드로 세밀하게 제어하기 어렵다. 따라서:

**권장 흐름**:
1. python-hwpx로 placeholder가 박힌 기본 골격 양식 생성 (이 단계)
2. 한컴오피스에서 양식을 열어 디자인 보완 — 머리글, 워터마크, 글꼴 통일, 표 디자인 등
3. 다시 저장 → 이게 마스터 양식이 됨

이후로는 양식 빌드 스크립트는 더 이상 실행하지 않고, 마스터 양식을 그대로 사용한다.

---

## 양식 추가 — 빠른 절차

새 양식을 추가할 때의 4단계:

1. **빌드 스크립트 작성** (예: `/tmp/build_my_template.py`) — 위의 기본 패턴 참고
2. **양식 생성** (`python /tmp/build_my_template.py`) → `assets/<양식종류>/template.hwpx` 생성됨
3. **메타파일 작성** (`assets/<양식종류>/template.meta.json`) — placeholder를 정확히 매핑
4. **테스트** (`render()` 호출하여 데이터 채워보기)

빌드 스크립트는 저장소에 포함하지 않아도 된다 (일회용). 메타파일과 양식 hwpx만 커밋한다.

---

## 자주 만나는 함정

### 함정 1: 표 셀의 placeholder가 본문에서 치환 안 됨

`render.py` 의 sequential 치환은 `section*.xml` 파일만 본다. 표는 보통 section에 들어가지만, header 영역에 있는 표는 다른 XML 파일에 있다. 표 placeholder가 치환되지 않으면 위치를 확인.

### 함정 2: `◆` 문자가 본문에서 충돌

매우 드물지만 사용자가 본문에 `◆` 문자를 넣으면 placeholder와 충돌 가능. 이 경우 placeholder를 더 고유한 문자열(예: `◆◆◆`)로 변경.

### 함정 3: HTML/XML 이스케이프

`<`, `>`, `&` 같은 문자가 데이터에 들어가면 자동으로 이스케이프되므로 (`render.py`가 처리), 사용자는 신경 쓰지 않아도 됨.
