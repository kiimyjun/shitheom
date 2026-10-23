# 시혐지 3D

시험지 + 혐오. 과목 이름을 입력하고 입체 책상에서 시험지를 구기거나 파쇄하고 책상을 엎는 브라우저 게임입니다.

## 실행

Node.js **24 이상**을 권장합니다.

```sh
npm ci
npm run dev
```

- `npm test`: 입력 규칙과 게임 상태 전환 검사
- `npm run build`: 타입 검사와 배포 파일 생성 (`dist/`)
- `npm run preview`: 배포 파일을 로컬에서 확인

## 플레이

1. 시험 과목을 1~8개 추가하고 **책상에 앉기**를 누릅니다.
2. 목록 또는 3D 시험지를 클릭해 선택합니다. 선택 클릭은 처리 횟수에 포함되지 않습니다.
3. **구기기**는 게임 화면을 6번, **파쇄기**는 8번 클릭하면 완료됩니다.
4. **책상 엎기**를 선택하고 스페이스바를 1.5초 이상 누른 뒤 놓습니다.
5. **전체 보기**로 카메라 시점을 바꿀 수 있습니다.
6. **책상 다시 세팅하기**로 같은 과목을 다시 플레이합니다.

터치 환경에서는 책상 엎기를 선택하고 게임 화면을 길게 누른 뒤 놓을 수 있습니다. PC 플레이를 우선으로 설계했습니다.
과목과 소리 설정은 각 브라우저에 저장됩니다. 온라인 계정이나 서버 저장 기능은 없습니다.

## 수정할 파일 찾기

| 바꾸고 싶은 부분                 | 파일                                 |
| -------------------------------- | ------------------------------------ |
| 클릭 횟수·충전 시간·최대 과목 수 | `src/domain/rules.mjs`               |
| 과목·선택·처리 완료·초기화 규칙  | `src/domain/GameStore.ts`            |
| 카메라 위치·책상 크기·화면 품질  | `src/config.ts`                      |
| 화면 구성·문구                   | `src/ui/template.ts`                 |
| 화면 색상·간격·반응형 배치       | `src/style.css`                      |
| 화면 버튼과 상태 표시            | `src/ui/GameUI.ts`                   |
| 키보드·마우스·터치와 충전 취소   | `src/input/InteractionController.ts` |
| 책상과 소품의 모양               | `src/three/Desk.ts`                  |
| 방·창문·조명                     | `src/three/Room.ts`                  |
| 시험지 인쇄와 과목 이름          | `src/three/PaperTexture.ts`          |
| 종이 구기기·파쇄 모양            | `src/three/PaperModel.ts`            |
| 파쇄기 모양                      | `src/three/Shredder.ts`              |
| 중력·충돌·물리 물체 수명         | `src/physics/PhysicsSystem.ts`       |
| 효과음                           | `src/services/audio.ts`              |

전체 흐름과 확장 방법은 [구조 설명](docs/ARCHITECTURE.md)에 정리했습니다.

## GitHub Pages 배포

배포 파일은 브라우저만으로 실행됩니다. Three.js와 Rapier 모두 빌드 결과에 포함되며 별도 백엔드는 필요하지 않습니다.

1. 이 폴더의 코드를 본인의 GitHub 저장소에 올립니다. `.github/` 폴더도 포함합니다.
2. 저장소 **Settings → Pages → Source**에서 **GitHub Actions**를 선택합니다.
3. `main` 브랜치로 푸시하면 제공된 배포 워크플로가 테스트·빌드·배포를 실행합니다.
4. Pages에 표시되는 `https://아이디.github.io/저장소이름/` 주소로 접속합니다.

`vite.config.ts`의 상대 경로 설정이 프로젝트 하위 경로를 지원합니다. 브랜치 이름이 `main`이 아니면 `.github/workflows/pages.yml`의 브랜치 설정을 맞춰 주세요.
이 소스에는 GitHub 저장소를 만들거나 공개하는 작업이 포함되어 있지 않습니다.

## 사용 기술

Three.js / Rapier 3D / TypeScript / Vite. 그림은 3D 기본 도형과 Canvas 텍스처로 생성하고 소리는 Web Audio로 합성합니다.
