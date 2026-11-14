export const COLUMNS = [
  { status: "backlog", title: "Backlog" },
  { status: "design", title: "Design approach" },
  { status: "preparation", title: "Preparation" },
  { status: "execution", title: "Execution" },
  { status: "delivered", title: "Delivered" },
] as const;

export type Status = (typeof COLUMNS)[number]["status"];
