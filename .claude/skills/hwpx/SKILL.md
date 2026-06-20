---
name: hwpx
description: "HWPX 한글 문서를 양식 기반으로 생성·편집한다. '한글 문서', 'hwpx', '한글파일', '보고서', '공문', '기안문', '계획서', '안내문', '회의록' 등 양식이 정해진 한국식 문서 요청 시 사용. 사용자 업로드 .hwpx가 있으면 그것을 우선 사용. 없으면 assets/[양식종류]/template.hwpx 중 가장 맞는 것을 선택. 일반 Word(.docx) 문서에는 docx 스킬을 사용할 것."
---

# HWPX 양식 기반 문서 생성 스킬

## 개요

이 스킬은 **양식(template) + 메타파일(meta.json) 기반**으로 HWPX 한글 문서를 만든다. 양식 파일과 그 양식의 placeholder 명세(meta.json)만 있으면, 단일 진입점 `render.py`로 어떤 양식이든 동일하게 처리한다.

HWPX는 ZIP + XML 구조이므로 ZIP-level 텍스트 치환으로 안전하게 편집한다. `python-hwpx`의 `HwpxDocument.open()`은 복잡한 양식에서 파싱 실패가 잦으므로 사용하지 않는다.

## 설치

```bash
pip install python-hwpx --break-system-packages
# image_text 필드(학교명을 로고 자리에 이미지로 표시)를 사용하려면:
pip install Pillow --break-system-packages
```

macOS 시스템 Python에서 설치가 막히면 가상환경(`python3 -m venv .venv && source .venv/bin/activate`)을 먼저 만들거나 `uv pip install --system python-hwpx Pillow` 사용.

---

## ⚠️ 최우선 규칙: 양식 선택 정책

### 1단계: 사용자 업로드 양식이 있는가?

`/mnt/user-data/uploads/` 에 `.hwpx` 파일이 있다면 **반드시 그것을 우선 사용**한다. 등록된 기본 양식보다 항상 우선이다.

```bash
ls /mnt/user-data/uploads/*.hwpx 2>/dev/null
```

업로드 양식 처리는 아래 "B. 사용자 업로드 양식 사용" 워크플로우를 따른다.

### 2단계: 등록 양식 사용

`assets/` 하위 양식 폴더 중 사용자 요청과 가장 맞는 것을 고른다. 각 폴더의 `template.meta.json`에 있는 `name` 과 `description` 을 읽어 판단한다.

### 3단계: 적합한 양식이 없으면?

빈 문서를 만들지 말고 **사용자에게 양식 업로드를 요청**한다. 빈 hwpx를 만들어 한 줄씩 텍스트를 채우는 방식은 양식·스타일이 깨져 보고용으로 부적합하다.

---

## 핵심 사용법 — `render.py` 한 줄

```python
import sys
sys.path.insert(0, "scripts")  # 또는 스킬 루트
from render import render

render(
    template_dir="assets/report",
    output_path="/mnt/user-data/outputs/result.hwpx",
    data={
        "기관명": "○○고등학교",
        "보고서_제목": "AI 활용 교사 연수 결과",
        "작성일": "today",
        "본문_1단계": ["추진 배경", "추진 경과", "성과", "향후 계획"],
        # ... 메타파일의 fields 키들
    },
)
```

`render()`가 하는 일:
1. `template_dir/template.meta.json` 로드
2. `template.hwpx` 를 `output_path` 로 복사
3. 메타의 각 필드 타입(single/sequential/date)에 맞춰 치환
4. 네임스페이스 후처리(fix_namespaces) 자동 호출
5. 결과 경로 반환

---

## 워크플로우

### A. 등록 양식 사용

```
[1] 사용자 요청에서 양식 종류 추론 (보고서? 공문? 안내문?)
     ↓
[2] assets/<양식종류>/template.meta.json 로드
     ↓
[3] meta의 fields 를 보고 필요 데이터 수집
      - 사용자 메시지에서 추출
      - 부족한 필수 항목은 사용자에게 한 번에 모아서 질문
     ↓
[4] render() 호출
     ↓
[5] verify.py 로 잔존 placeholder 점검 (선택)
     ↓
[6] /mnt/user-data/outputs/ 에 복사 → present_files
```

### B. 사용자 업로드 양식 사용

```
[1] /mnt/user-data/uploads/<양식>.hwpx 를 작업 디렉토리로 복사
     ↓
[2] scan_template.py 로 placeholder 후보 메타파일 자동 생성
       python scripts/scan_template.py uploaded.hwpx -o uploaded.meta.json
     ↓
[3] 사용자에게 후보를 보여주고 "각 자리에 어떤 값을 넣을지" 확인
       (key 이름을 의미 있게 변경하도록 안내)
     ↓
[4] 확정된 meta.json + 양식 + 데이터로 render() 호출
     ↓
[5] verify.py 로 검증 → outputs/ 복사 → present_files
```

---

## 메타파일(`template.meta.json`) 스키마

```json
{
  "name": "양식 이름",
  "description": "양식 용도·구조 설명 (AI가 양식 선택 시 참고)",
  "fields": [
    {
      "key": "기관명",
      "placeholder": "양식에 박혀있는 원본 텍스트",
      "type": "single",
      "required": true,
      "description": "(선택) 사람용 설명"
    },
    {
      "key": "작성일",
      "placeholder": "2024. 5. 23.",
      "type": "date",
      "format": "YYYY. M. D.",
      "default": "today"
    },
    {
      "key": "본문_1단계",
      "placeholder": "헤드라인M 폰트 16포인트(문단 위 15)",
      "type": "sequential",
      "max_count": 8,
      "description": "□ 항목 (대분류). 양식에 8자리."
    }
  ]
}
```

**타입별 동작**:

| type | 동작 | 데이터 형태 |
|------|------|-------------|
| `single` | placeholder 등장 위치 **모두** 같은 값으로 치환 | 문자열 |
| `sequential` | placeholder 등장 위치를 **순서대로** 다른 값으로 치환 | 리스트 |
| `date` | 날짜 객체·"today"·문자열을 `format` 으로 자동 변환 | 문자열/date/`"today"` |
| `image_text` | 텍스트를 PNG 이미지로 렌더링해 ZIP 내 이미지를 교체 (학교명을 로고 영역에 표시할 때 사용). placeholder 값은 ZIP 내부 이미지 경로 (예: `BinData/image1.png`). Pillow 필요. | 문자열 |

**중요**: `placeholder` 는 양식 안에 실제로 들어있는 텍스트와 **글자 한 자도 다르지 않아야** 한다. 공백 포함. `scan_template.py` 로 추출한 값을 그대로 쓰는 것이 안전하다.

---

## 새 양식 추가 절차

1. **양식 작성**: 한글에서 양식을 만든다. 채워질 자리에는 그 자리의 **용도가 드러나는 고유 placeholder 텍스트**를 넣는다 (예: `"기관명_여기_입력"`, `"본문 1단계 자리"`). 일반 본문에 우연히 등장할 수 있는 짧은 단어는 피한다.

2. **scan_template.py 실행**:
   ```bash
   python scripts/scan_template.py my-new-template.hwpx -o template.meta.json
   ```

3. **메타파일 수동 편집**: 생성된 `template.meta.json` 의 `key`, `name`, `description`, `required` 를 의미 있게 채운다. `_hint` 필드는 참고용이므로 삭제해도 좋다.

4. **폴더 배치**:
   ```
   assets/<양식종류>/
     template.hwpx
     template.meta.json
   ```

5. **테스트 렌더**: 샘플 데이터로 `render()` 호출 후 한글에서 열어 확인.

자세한 가이드는 `references/creating-new-template.md` 참고.

---

## 검증 — `verify.py`

```bash
python scripts/verify.py result.hwpx assets/report/template.meta.json
```

잔존 placeholder가 있으면 출력한다. 단, 사용자가 placeholder와 동일한 텍스트를 데이터로 넣은 경우 false positive가 나올 수 있다 (의도된 동작이면 무시).

---

## 양식 카탈로그 (assets/)

각 양식의 정확한 사용법은 해당 폴더의 `template.meta.json` 의 `description` 을 참조한다.

| 양식 종류 | 폴더 | 주 용도 |
|---|---|---|
| 내부 보고서 | `assets/report/` | 학교·기관 내부 보고서, 추진계획서, 결과보고서 등 |
| 공문서(기안문) | `assets/official-doc/` | 대외 공문, 기안문, 행정 공문 등 표준 공문 |
| 학부모 안내문 | `assets/parent-notice/` | 가정통신문, 학부모 대상 안내·협조 요청 |
| 운영 계획서 | `assets/plan/` | 사업·프로그램 운영 계획, 학년도 운영 계획 |
| 회의록 | `assets/meeting-minutes/` | 학년부/부서/위원회 회의 기록 (정보표 + 안건/논의/결정) |

양식 선택 시 사용자 요청과 각 양식의 `name`·`description` 을 비교한다. 예: "기안문 만들어줘" → `official-doc`, "회의 결과 정리해줘" → `meeting-minutes`.

(추가 양식은 위 절차대로 PR/issue로 기여 가능)

---

## 문서 유형별 스타일 가이드

깊이 있는 양식 규약(글꼴·기호 체계·여백 등)은 `references/` 참고:

- `references/report-style.md` — 보고서(내부 보고용) 양식 규약
- `references/official-doc-style.md` — 공문서(기안문) 양식 규약
- `references/xml-internals.md` — HWPX XML 내부 구조 (저수준 조작 시)
- `references/creating-new-template.md` — 새 양식을 만들 때의 디자인 원칙
- `references/building-template-with-python.md` — 한컴오피스 없이 python-hwpx로 양식 만들기

---

## ⚠️ 네임스페이스 후처리는 자동 수행됨

`render()` 가 마지막에 `fix_namespaces.py` 를 자동으로 호출한다. 따라서 일반 사용자는 신경 쓸 필요가 없다.

직접 ZIP 치환을 하는 경우에만:

```python
from fix_namespaces import fix_hwpx_namespaces
fix_hwpx_namespaces("output.hwpx")
```

이 단계를 빠뜨리면 macOS 한글 Viewer에서 빈 페이지로 보일 수 있다.

---

## 주의사항

1. **양식 우선**: 사용자 업로드 양식 > 등록 양식 > (양식 없이 만들지 말 것)
2. **placeholder 정확성**: 양식 텍스트와 글자 한 자도 다르면 안 됨. 공백 포함.
3. **순차 치환의 한계**: `max_count` 보다 많은 값을 넘기면 잘림. 양식 자체를 확장해야 함.
4. **부분 채움**: 일부 슬롯만 채우면 나머지는 안내 텍스트가 그대로 남음. 한글에서 직접 정리 가능.
5. **날짜 형식**: 공문서/보고서 표준은 `2026. 5. 30.` (월·일 앞 0 없음). 메타에서 `format: "YYYY. M. D."` 사용.
6. **글꼴 임베딩**: HWPX는 글꼴을 포함하지 않는다. 열람 환경에 해당 글꼴이 없으면 다른 글꼴로 대체됨.
7. **HWP(레거시) 미지원**: 이 스킬은 HWPX(.hwpx)만 다룬다. 레거시 `.hwp` 는 별도 도구 필요.

---

## ⚠️ 가상 인명 사용 절대 금지

**Claude는 회의록·공문서·보고서 등을 생성할 때 가상의 사람 이름(예: '김민준', '이서연', '박지훈')을 절대 만들어내지 말 것.**

사용자가 실명을 명시적으로 제공하지 않은 경우, 다음 원칙을 따른다:

### 원칙 1: 직위·부서로 표기

이름 자리에는 직위와 부서를 사용한다:
- ❌ `"작성자": "김민준 교사"`
- ✅ `"작성자": "정보부 담당교사"` 또는 `"정보부 서기"`
- ❌ `"참석자": "교장 김철수, 교감 이영희, 부장 박민수"`
- ✅ `"참석자": "교장, 교감, 1·2·3학년부장 (총 5명)"`

### 원칙 2: 직위를 모르면 인원수로

- ❌ `"참석자": "김민준 외 4명"`
- ✅ `"참석자": "정보부 전원 (5명)"` 또는 `"부서원 5명"`

### 원칙 3: 실명이 꼭 필요하면 placeholder 그대로

문서 양식상 실명 자리가 비워질 수 없을 때(예: 결재란 서명):
- placeholder 텍스트(예: `◆작성자 부서/직위◆`)를 그대로 두어 사용자가 한컴오피스에서 직접 채우게 함
- 또는 사용자에게 "실명이 필요한 자리가 있는데 알려주실 수 있을까요?"라고 명시적으로 물어봄

### 왜 이 원칙이 중요한가

- **개인정보 보호**: 가상의 이름이 우연히 실존 인물과 일치하면 문제 발생 가능
- **신뢰성**: 학교 행정 문서에 가짜 이름이 들어가면 문서의 공식성을 훼손
- **사용자 혼란 방지**: 사용자가 결과물을 그대로 쓰려다 가상 이름이 들어간 것을 뒤늦게 발견하는 사고 예방

이 원칙은 회의록뿐 아니라 공문서, 보고서, 안내문 등 **모든 양식**에 적용된다.

---

## Quick Reference

| 작업 | 명령/코드 |
|------|----------|
| 등록 양식으로 문서 생성 | `render("assets/report", "out.hwpx", data)` |
| 업로드 양식의 placeholder 추출 | `python scripts/scan_template.py user.hwpx -o user.meta.json` |
| 결과 검증 | `python scripts/verify.py out.hwpx meta.json` |
| 텍스트 전수 조사 | `from hwpx import ObjectFinder; finder = ObjectFinder("f.hwpx"); [r.text for r in finder.find_all(tag="t")]` |
| 네임스페이스 수동 후처리 | `from fix_namespaces import fix_hwpx_namespaces; fix_hwpx_namespaces("f.hwpx")` |
