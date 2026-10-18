export type DiffRow = {
  kind: "same" | "changed" | "removed" | "added";
  leftLine?: number;
  rightLine?: number;
  left?: string;
  right?: string;
};

type Operation = { kind: "same" | "removed" | "added"; line: string; number: number; rightNumber?: number };

function fallback(left: string[], right: string[]): DiffRow[] {
  return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
    const before = left[index];
    const after = right[index];
    if (before === after) return { kind: "same", left: before, right: after, leftLine: index + 1, rightLine: index + 1 };
    if (before === undefined) return { kind: "added", right: after, rightLine: index + 1 };
    if (after === undefined) return { kind: "removed", left: before, leftLine: index + 1 };
    return { kind: "changed", left: before, right: after, leftLine: index + 1, rightLine: index + 1 };
  });
}

export function buildLineDiff(before: string, after: string): DiffRow[] {
  const left = before.replace(/\r\n/g, "\n").split("\n");
  const right = after.replace(/\r\n/g, "\n").split("\n");
  if (left.length * right.length > 1_000_000) return fallback(left, right);
  const rows = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) rows[i][j] = left[i] === right[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  }
  const operations: Operation[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      operations.push({ kind: "same", line: left[i], number: i + 1, rightNumber: j + 1 });
      i++;
      j++;
    } else if (i < left.length && (j >= right.length || rows[i + 1][j] >= rows[i][j + 1])) {
      operations.push({ kind: "removed", line: left[i], number: i + 1 });
      i++;
    } else {
      operations.push({ kind: "added", line: right[j], number: j + 1 });
      j++;
    }
  }
  const result: DiffRow[] = [];
  for (let cursor = 0; cursor < operations.length;) {
    const operation = operations[cursor];
    if (operation.kind === "same") {
      result.push({ kind: "same", left: operation.line, right: operation.line, leftLine: operation.number, rightLine: operation.rightNumber });
      cursor++;
      continue;
    }
    const removed: Operation[] = [];
    const added: Operation[] = [];
    while (cursor < operations.length && operations[cursor].kind !== "same") {
      (operations[cursor].kind === "removed" ? removed : added).push(operations[cursor]);
      cursor++;
    }
    for (let index = 0; index < Math.max(removed.length, added.length); index++) {
      const oldLine = removed[index];
      const newLine = added[index];
      result.push({
        kind: oldLine && newLine ? "changed" : oldLine ? "removed" : "added",
        left: oldLine?.line,
        right: newLine?.line,
        leftLine: oldLine?.number,
        rightLine: newLine?.number,
      });
    }
  }
  return result;
}
