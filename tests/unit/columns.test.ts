import { expect, test } from "vitest";
import { COLUMNS } from "../../src/domain/columns";

test("columns are in board order", () => {
  expect(COLUMNS.map((c) => c.title)).toEqual(["Backlog", "Design approach", "Preparation", "Execution", "Delivered"]);
  expect(COLUMNS.map((c) => c.status)).toEqual(["backlog", "design", "preparation", "execution", "delivered"]);
});
