const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const labels = (items) => JSON.stringify(items);
const daysFromNow = (days) => {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

async function main() {
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.status.deleteMany();
  await prisma.member.deleteMany();
  await prisma.project.deleteMany();

  const project = await prisma.project.create({
    data: {
      key: "SFL",
      name: "SprintFlow",
      summary: "작업, 일정, 하위작업, 진행률을 한 곳에서 운영하는 로컬 프로젝트 허브",
      leadName: "Product Owner",
      color: "#2563eb",
      startDate: daysFromNow(-12),
      targetDate: daysFromNow(48)
    }
  });

  const statusData = [
    { name: "할 일", category: "TODO", color: "#64748b" },
    { name: "진행 중", category: "IN_PROGRESS", color: "#2563eb" },
    { name: "검토 중", category: "IN_PROGRESS", color: "#d97706" },
    { name: "완료", category: "DONE", color: "#15a46b" }
  ];

  const statuses = {};
  for (const [index, status] of statusData.entries()) {
    const created = await prisma.status.create({
      data: {
        ...status,
        sortOrder: index,
        projectId: project.id
      }
    });
    statuses[status.name] = created;
  }

  const memberData = [
    { name: "김하린", initials: "HR", role: "기획", color: "#2563eb" },
    { name: "박도윤", initials: "DY", role: "프론트엔드", color: "#15a46b" },
    { name: "이서준", initials: "SJ", role: "백엔드", color: "#7c3aed" },
    { name: "최민아", initials: "MA", role: "QA", color: "#e11d48" }
  ];

  const members = {};
  for (const member of memberData) {
    const created = await prisma.member.create({
      data: {
        ...member,
        projectId: project.id
      }
    });
    members[member.initials] = created;
  }

  const activeSprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "스프린트 1",
      goal: "핵심 보드, 백로그, 이슈 상세 흐름을 사용할 수 있게 만든다.",
      status: "ACTIVE",
      startDate: daysFromNow(-5),
      endDate: daysFromNow(9)
    }
  });

  const nextSprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "스프린트 2",
      goal: "필터, 일정, 보고서 품질을 끌어올린다.",
      status: "PLANNED",
      startDate: daysFromNow(10),
      endDate: daysFromNow(24)
    }
  });

  const createIssue = (data) =>
    prisma.issue.create({
      data: {
        projectId: project.id,
        reporterId: members.HR.id,
        ...data
      }
    });

  const epic = await createIssue({
    sprintId: activeSprint.id,
    statusId: statuses["진행 중"].id,
    assigneeId: members.HR.id,
    issueKey: "SFL-1",
    type: "EPIC",
    summary: "Jira형 작업관리 핵심 경험 구축",
    description: "프로젝트 운영자가 보드, 백로그, 스프린트, 일정, 진행률을 한 화면 흐름에서 관리할 수 있게 만든다.",
    priority: "HIGH",
    labels: labels(["core", "ux"]),
    storyPoints: 13,
    estimateHours: 48,
    loggedHours: 15,
    rank: 10,
    startDate: daysFromNow(-5),
    dueDate: daysFromNow(14)
  });

  const board = await createIssue({
    sprintId: activeSprint.id,
    parentId: epic.id,
    statusId: statuses["진행 중"].id,
    assigneeId: members.DY.id,
    issueKey: "SFL-2",
    type: "STORY",
    summary: "상태 컬럼 기반 보드에서 작업을 이동한다",
    description: "드래그 앤 드롭으로 작업 상태를 바꾸고, 카드에서 우선순위와 하위작업 진행률을 바로 확인한다.",
    priority: "HIGH",
    labels: labels(["board", "workflow"]),
    storyPoints: 8,
    estimateHours: 18,
    loggedHours: 7,
    rank: 20,
    startDate: daysFromNow(-4),
    dueDate: daysFromNow(5)
  });

  const backlog = await createIssue({
    sprintId: activeSprint.id,
    parentId: epic.id,
    statusId: statuses["검토 중"].id,
    assigneeId: members.SJ.id,
    issueKey: "SFL-3",
    type: "STORY",
    summary: "백로그에서 스프린트 계획을 조정한다",
    description: "활성 스프린트, 다음 스프린트, 백로그를 나누어 보고 작업을 빠르게 추가하거나 이동한다.",
    priority: "MEDIUM",
    labels: labels(["backlog", "planning"]),
    storyPoints: 5,
    estimateHours: 14,
    loggedHours: 10,
    rank: 30,
    startDate: daysFromNow(-3),
    dueDate: daysFromNow(3)
  });

  const calendar = await createIssue({
    sprintId: nextSprint.id,
    statusId: statuses["할 일"].id,
    assigneeId: members.MA.id,
    issueKey: "SFL-4",
    type: "TASK",
    summary: "마감일 기반 일정 보기를 제공한다",
    description: "캘린더에서 마감 예정 작업과 지연 위험 작업을 빠르게 파악한다.",
    priority: "MEDIUM",
    labels: labels(["calendar"]),
    storyPoints: 3,
    estimateHours: 8,
    rank: 40,
    startDate: daysFromNow(2),
    dueDate: daysFromNow(12)
  });

  const bug = await createIssue({
    sprintId: activeSprint.id,
    statusId: statuses["할 일"].id,
    assigneeId: members.DY.id,
    issueKey: "SFL-5",
    type: "BUG",
    summary: "긴 제목 카드가 좁은 화면에서 넘치지 않게 처리한다",
    description: "모바일 보드와 상세 패널에서 긴 한국어 문장이 자연스럽게 줄바꿈되어야 한다.",
    priority: "HIGH",
    labels: labels(["responsive", "qa"]),
    storyPoints: 2,
    estimateHours: 5,
    rank: 50,
    isFlagged: true,
    dueDate: daysFromNow(2)
  });

  await createIssue({
    statusId: statuses["할 일"].id,
    assigneeId: members.SJ.id,
    issueKey: "SFL-6",
    type: "TASK",
    summary: "릴리즈 노트 초안을 작성한다",
    description: "첫 내부 테스트에서 확인할 기능 목록과 알려진 제한사항을 정리한다.",
    priority: "LOW",
    labels: labels(["release"]),
    storyPoints: 1,
    estimateHours: 3,
    rank: 60,
    dueDate: daysFromNow(18)
  });

  const subTasks = [
    {
      parentId: board.id,
      issueKey: "SFL-7",
      summary: "카드 드래그 이벤트 연결",
      statusId: statuses["완료"].id,
      assigneeId: members.DY.id,
      loggedHours: 3
    },
    {
      parentId: board.id,
      issueKey: "SFL-8",
      summary: "컬럼별 작업 수와 진행률 표시",
      statusId: statuses["진행 중"].id,
      assigneeId: members.DY.id,
      loggedHours: 2
    },
    {
      parentId: backlog.id,
      issueKey: "SFL-9",
      summary: "빠른 작업 생성 폼 구현",
      statusId: statuses["완료"].id,
      assigneeId: members.SJ.id,
      loggedHours: 4
    },
    {
      parentId: backlog.id,
      issueKey: "SFL-10",
      summary: "스프린트 이동 액션 구현",
      statusId: statuses["검토 중"].id,
      assigneeId: members.SJ.id,
      loggedHours: 2
    },
    {
      parentId: bug.id,
      issueKey: "SFL-11",
      summary: "모바일 상세 패널 줄바꿈 확인",
      statusId: statuses["할 일"].id,
      assigneeId: members.MA.id
    }
  ];

  for (const [index, subTask] of subTasks.entries()) {
    await createIssue({
      ...subTask,
      sprintId: activeSprint.id,
      type: "SUBTASK",
      description: "",
      priority: "MEDIUM",
      labels: labels([]),
      storyPoints: 0,
      estimateHours: 2,
      rank: 100 + index
    });
  }

  await prisma.comment.createMany({
    data: [
      {
        issueId: board.id,
        authorId: members.HR.id,
        body: "보드에서는 카드 안에서 핵심 정보가 바로 보이는 것이 중요합니다."
      },
      {
        issueId: backlog.id,
        authorId: members.SJ.id,
        body: "백로그 이동은 새로고침 없이 반영되도록 API를 먼저 붙였습니다."
      },
      {
        issueId: bug.id,
        authorId: members.MA.id,
        body: "작은 화면에서 제목과 버튼 텍스트가 겹치지 않는지 확인이 필요합니다."
      }
    ]
  });

  await prisma.attachment.createMany({
    data: [
      {
        issueId: board.id,
        fileName: "board-flow-notes.md",
        url: "https://example.local/board-flow-notes.md",
        fileSize: 2450
      },
      {
        issueId: backlog.id,
        fileName: "planning-checklist.pdf",
        url: "https://example.local/planning-checklist.pdf",
        fileSize: 82000
      }
    ]
  });

  console.log("Seed complete: SprintFlow sample workspace is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
