# SprintFlow

SprintFlow는 소규모 그룹의 작업·일정을 관리하는 도구입니다. 관리자 계정 하나로 그룹을 만들고, 참여자는 그룹 코드로 입장해 해당 워크스페이스의 이슈·하위작업·스프린트·일정을 공유합니다. 기존 프로젝트 데이터는 유지하며 백업·복원과 그룹 관리는 관리자에게 제한합니다. 초기 인증 설정과 권한 범위는 [그룹 접근 안내](docs/group-access.md)를 참고하세요.

## 기술 스택

- Next.js 16.2.7
- React 19.2.7
- TypeScript
- Tailwind CSS
- Prisma 6
- SQLite

## 주요 기능

- 대시보드: 전체 작업 수, 완료율, 스프린트 포인트, 주의 작업 요약
- 보드: 상태 컬럼 기반 이슈 관리, 드래그로 상태 변경
- 백로그: 스프린트별 작업 계획, 새 작업 생성, 스프린트 이동
- 일정: 마감일 기준 월간 캘린더
- 이슈 상세: 설명, 상태, 담당자, 우선순위, 라벨, 일정, 추정치, 댓글, 첨부 관리
- 하위작업: 부모 이슈의 하위작업 생성 및 진행률 반영
- 사용자 관리: 담당자 목록 추가, 수정, 삭제
- 백업/복원: SQLite 데이터를 JSON 스냅샷으로 저장하고 복원

## 로컬 실행

Windows 환경에서 Node가 PATH에 없다면 portable Node 경로를 먼저 추가합니다.

```powershell
$nodeDir="$env:USERPROFILE\.cache\codex-runtimes\node-v24.16.0-win-x64"
$env:PATH="$nodeDir;$env:PATH"
```

의존성 설치 후 DB와 인증 설정을 준비합니다. 기존 데이터가 있으면 `db:reset`을 사용하지 않습니다.

```powershell
npm install
npm run db:push
node scripts/create-admin.cjs
# .env.example을 .env로 복사하고 생성 파일의 environment 값을 설정
npm run dev
```

프로덕션 빌드와 실행:

```powershell
npm run build
npm run start -- -p 3000
```

## 데이터와 백업

기본 DB는 `prisma/sprintflow.db`입니다. DB 파일과 백업 파일은 git에 포함하지 않습니다.

- 서버 백업 저장: 선택한 그룹 데이터를 `prisma/backups/<projectId>`에 JSON으로 저장 (관리자 전용)
- 최신 백업 복원: 해당 그룹 디렉터리의 가장 최근 백업으로 선택한 그룹만 교체
- 파일 다운로드: 현재 데이터를 브라우저에서 JSON 파일로 다운로드
- 파일로 복원: 같은 그룹 ID의 JSON 백업만 허용하며 다른 그룹은 보존. 인증 정보는 복원하지 않고 해당 그룹 참여자 세션을 만료

## 문서

- [제품 기획서](docs/product-plan.md)
- [기능 정의서](docs/functional-spec.md)
- [요구사항 관리 문서](docs/requirements-log.md)

## 빈 데이터베이스에서 시작

첫 접속은 로그인 화면으로 이동합니다. 프로젝트가 없으면 관리자가 그룹을 생성하며, 새 그룹에는 할 일·진행 중·완료 상태가 만들어집니다. 기존 프로젝트·작업·상태는 보존하며 샘플 일정은 생성하지 않습니다. 운영 장애 복구에 `db:reset`이나 `db:seed`를 사용하지 마세요. 두 명령은 기존 데이터를 삭제합니다.

회귀 검증: `npx prisma generate && npm test`. 임시 SQLite DB에서 동시 첫 접속과 기존 데이터 보존을 검증합니다.
