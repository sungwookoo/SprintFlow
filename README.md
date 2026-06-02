# SprintFlow

SprintFlow는 Atlassian Jira의 핵심 작업 관리 흐름을 참고해 만든 로컬 단일 사용자용 프로젝트 관리 도구입니다. 현재 버전은 계정/권한 없이 프로젝트, 이슈, 하위작업, 스프린트, 일정, 진행률, 담당자, 백업/복원을 관리하는 데 집중합니다.

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

의존성 설치 후 DB를 준비합니다.

```powershell
npm install
npm run db:reset
npm run dev
```

프로덕션 빌드와 실행:

```powershell
npm run build
npm run start -- -p 3000
```

## 데이터와 백업

기본 DB는 `prisma/sprintflow.db`입니다. DB 파일과 백업 파일은 git에 포함하지 않습니다.

- 서버 백업 저장: 현재 데이터를 `prisma/backups`에 JSON으로 저장
- 최신 백업 복원: `prisma/backups`의 가장 최근 백업으로 현재 데이터 교체
- 파일 다운로드: 현재 데이터를 브라우저에서 JSON 파일로 다운로드
- 파일로 복원: JSON 백업 파일을 업로드해 현재 데이터 교체

## 문서

- [제품 기획서](docs/product-plan.md)
- [기능 정의서](docs/functional-spec.md)
- [요구사항 관리 문서](docs/requirements-log.md)
