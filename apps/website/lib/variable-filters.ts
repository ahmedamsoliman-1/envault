import type { VariableDto } from "@envault/api-contract";

export type ModifiedFilter = "all" | "today" | "week" | "month";

export interface VariableFilters {
  search: string;
  visibility: "all" | VariableDto["visibility"];
  tag: string;
  modified: ModifiedFilter;
}

export function filterVariables(
  variables: VariableDto[],
  filters: VariableFilters,
  now = Date.now(),
) {
  const query = filters.search.trim().toLocaleLowerCase();
  const modifiedAfter =
    filters.modified === "today"
      ? now - 86_400_000
      : filters.modified === "week"
        ? now - 7 * 86_400_000
        : filters.modified === "month"
          ? now - 30 * 86_400_000
          : null;

  return variables.filter(
    (variable) =>
      (filters.visibility === "all" ||
        variable.visibility === filters.visibility) &&
      (filters.tag === "all" || variable.tags.includes(filters.tag)) &&
      (modifiedAfter === null ||
        new Date(variable.updatedAt).getTime() >= modifiedAfter) &&
      (!query ||
        variable.key.toLocaleLowerCase().includes(query) ||
        variable.tags.some((tag) => tag.toLocaleLowerCase().includes(query))),
  );
}
