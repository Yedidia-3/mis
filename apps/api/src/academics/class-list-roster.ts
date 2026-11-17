export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface RosterRow {
  name: string;
  studentIdNumber?: string;
}

export interface RosterPerson {
  id: number;
  name: string;
  studentIdNumber?: string | null;
  classId: number | null;
}

export interface RosterPlan<T extends RosterRow = RosterRow> {
  kept: { id: number; row: T }[];
  moved: { id: number; row: T }[];
  added: T[];
  removedIds: number[];
}

function codeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * The file is the class. A pupil already known by student code, or else by
 * name, stays and is moved onto this class when they sat somewhere else.
 * Anyone still on this class who is not on the file is taken off.
 */
export function assignClassList<T extends RosterRow>(
  classId: number,
  rows: T[],
  people: RosterPerson[],
): RosterPlan<T> {
  const used = new Set<number>();
  const byCode = new Map<string, RosterPerson[]>();
  const byName = new Map<string, RosterPerson[]>();

  for (const person of people) {
    const code = codeKey(person.studentIdNumber);
    if (code) {
      const list = byCode.get(code) ?? [];
      list.push(person);
      byCode.set(code, list);
    }
    const name = normalizeName(person.name);
    if (name) {
      const list = byName.get(name) ?? [];
      list.push(person);
      byName.set(name, list);
    }
  }

  const pick = (candidates: RosterPerson[] | undefined): RosterPerson | undefined => {
    if (!candidates) return undefined;
    const free = candidates.filter((person) => !used.has(person.id));
    return free.find((person) => person.classId === classId)
      ?? free.find((person) => person.classId != null)
      ?? free[0];
  };

  const kept: RosterPlan<T>['kept'] = [];
  const moved: RosterPlan<T>['moved'] = [];
  const added: T[] = [];

  for (const row of rows) {
    const match = pick(row.studentIdNumber ? byCode.get(codeKey(row.studentIdNumber)) : undefined)
      ?? pick(byName.get(normalizeName(row.name)));
    if (!match) {
      added.push(row);
      continue;
    }
    used.add(match.id);
    if (match.classId === classId) kept.push({ id: match.id, row });
    else moved.push({ id: match.id, row });
  }

  const removedIds = people
    .filter((person) => person.classId === classId && !used.has(person.id))
    .map((person) => person.id);

  return { kept, moved, added, removedIds };
}
