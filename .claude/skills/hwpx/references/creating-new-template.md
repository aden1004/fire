# 새 양식 추가 가이드

이 가이드는 새 HWPX 양식을 `assets/` 에 추가하려는 사람을 위한 것이다. 양식의 placeholder 설계 원칙과 메타파일 작성법, 그리고 자주 만나는 함정을 정리한다.

---

## 1. 폴더 구조

```
assets/
└── <양식종류>/                 # 예: report, official-doc, parent-notice
    ├── template.hwpx           # 양식 본체 (필수)
    └── template.meta.json      # 양식 명세 (필수)
```

폴더 이름은 영문 + 하이픈을 권장한다(`parent-notice`, `meeting-minutes`). 한글 폴더명은 일부 환경에서 경로 처리에 문제가 생길 수 있다.

---

## 2. Placeholder 작성 원칙

### 원칙 1: 본문에 우연히 등장할 수 없는 고유 텍스트

좋은 예:
- `"기관명_여기_입력"` — 일반 문장에 절대 나오지 않음
- `"헤드라인M 폰트 16포인트(문단 위 15)"` — 양식 안내문 그대로 사용

피해야 할 예:
- `"제목"` — 본문의 "제목"이라는 단어가 다 치환될 수 있음
- `"내용"` — 본문에서 자주 등장

### 원칙 2: 자리 의미가 드러나도록

placeholder만 봐도 어떤 자리인지 알 수 있게 한다. `scan_template.py` 가 생성한 `key: "TODO_field_01"` 을 사람이 이해할 수 있는 이름으로 바꿀 때 단서가 된다.

### 원칙 3: 같은 위계의 반복 항목은 동일 placeholder N개

예를 들어 본문 1단계 항목이 8개라면 같은 placeholder 텍스트를 8번 박아두고, 메타에 `type: "sequential"`, `max_count: 8` 으로 명시한다. 사용자가 리스트로 값을 넘기면 순서대로 1회씩 치환된다.

### 원칙 4: 공백·줄바꿈 보존 주의

placeholder 앞뒤 공백도 양식과 정확히 일치해야 한다. `"  ○ 휴먼명조"` (앞 공백 2칸) 같은 경우, 메타에도 그대로 공백 2칸을 둔다.

---

## 3. 메타파일 작성 절차

### Step 1: scan_template.py 실행

```bash
python scripts/scan_template.py my-template.hwpx -o assets/my-template/template.meta.json
```

생성된 메타에는:
- 양식 안의 모든 텍스트 노드가 후보로 포함됨
- 2회 이상 등장 → `type: "sequential"` 후보
- 1회 등장 → `type: "single"` 후보
- `YYYY. M. D.` 패턴 → `type: "date"` 후보
- 1글자 이하 또는 로마숫자 단독 → 제외

### Step 2: 수동 편집

생성된 메타에서 다음을 정리한다:

1. **`name`, `description`** 작성 — 양식의 용도가 한눈에 보이게.
2. **`key`** 를 의미 있게 — `TODO_field_01` → `기관명`, `보고서_제목`, `본문_1단계` 등
3. **`required`** 설정 — 필수 필드는 `true`
4. **불필요한 후보 제거** — 양식의 일반 본문 텍스트가 후보로 잡혔다면 제거
5. **`_hint` 삭제** — 사람용 참고였으므로 정리 후 삭제

### Step 3: 검증 스크립트로 일치성 확인

다음 스크립트로 메타의 placeholder가 실제 양식과 일치하는지 점검한다:

```python
import json
from hwpx import ObjectFinder

with open("assets/my-template/template.meta.json", encoding="utf-8") as f:
    meta = json.load(f)

finder = ObjectFinder("assets/my-template/template.hwpx")
texts = [r.text for r in finder.find_all(tag="t") if r.text and r.text.strip()]

for field in meta["fields"]:
    ph = field["placeholder"]
    count = sum(1 for t in texts if t == ph)
    expected = field.get("max_count", 1) if field["type"] == "sequential" else 1
    status = "✅" if count == expected else "❌"
    print(f"{status} {field['key']}: 양식에 {count}회 (예상 {expected})")
```

❌가 하나도 없어야 한다.

---

## 4. 한글 자체 기능 활용 (코드로 만들지 말 것)

다음은 양식 단계에서 한글에서 미리 만들어 두는 것이 안전하다:

- **셀 병합·표 디자인** — 코드 조작은 깨지기 쉬움
- **그리기 객체·도형** — 양식에 미리 배치
- **차트** — placeholder 값으로 데이터를 채울 수는 있으나 구조 자체는 한글에서
- **머리글·바닥글·페이지 번호** — 한글에서 사전 설정
- **글꼴** — 시스템에 흔한 것 사용 (휴먼명조, 한컴고딕, 맑은 고딕). 임베딩 불가.

---

## 5. 양식 저장·테스트 체크리스트

| 항목 | 확인 |
|---|---|
| 한글에서 양식 저장 후 한 번 다시 열어 정상 표시 확인 | ☐ |
| `scan_template.py` 출력과 메타 placeholder 일치 | ☐ |
| `render()` 한 번 호출하여 결과물이 한글에서 열림 | ☐ |
| (가능하면) macOS 한글 Viewer에서도 열림 — 네임스페이스 검증 | ☐ |
| `evals.json` 에 이 양식용 케이스 1개 이상 추가 | ☐ |

---

## 6. 자주 만나는 함정

### 함정 1: placeholder 가 미세하게 다름

scan_template.py가 추출한 문자열을 직접 메타에 복사할 것. 손으로 타이핑하면 공백 수, 유니코드 문자(예: ` ` vs ` `), 전각/반각 차이로 실패할 수 있다.

### 함정 2: 같은 placeholder가 의도와 다르게 여러 번 매칭

`type: "single"` 인데 양식에 2회 이상 등장하면 모두 같은 값으로 치환된다. 의도가 다르다면 `sequential` 로 바꾸거나 양식의 placeholder 텍스트를 분리한다.

### 함정 3: 본문 텍스트가 placeholder로 잡힘

scan_template.py는 모든 텍스트를 후보로 만들므로, 양식 자체의 안내 문구·고정 텍스트도 후보가 된다. 이런 것들은 메타에서 제거하거나, 양식 단계에서 그 텍스트를 다른 표현으로 바꾼다.

### 함정 4: 표 안의 텍스트가 보이지 않음

`ObjectFinder` 는 표 안의 텍스트도 잘 잡지만, 일부 그리기 객체 안에 들어있는 텍스트는 잡히지 않는다. 양식 단계에서 placeholder 는 일반 본문이나 표 셀에 두는 것이 안전하다.

---

## 7. 기여 절차 (GitHub PR 기준)

1. 본 저장소를 fork
2. `assets/<양식종류>/` 폴더 생성 후 `template.hwpx` + `template.meta.json` 추가
3. `evals/evals.json` 에 케이스 추가
4. `README.md` 의 양식 카탈로그에 한 줄 추가
5. PR 시 설명에:
   - 양식의 용도
   - 어디서 가져왔는지 (저작권 명확화)
   - 테스트 결과 (한글에서 정상 표시되는 스크린샷)
