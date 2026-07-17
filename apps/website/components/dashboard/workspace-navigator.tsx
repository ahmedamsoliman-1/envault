import type { WorkspaceOverview } from "@envault/redis/repositories";
import { Boxes, ChevronRight, Folder, KeyRound } from "lucide-react";
import Link from "next/link";

export function WorkspaceNavigator({
  overview,
}: {
  overview: WorkspaceOverview;
}) {
  return (
    <section className="rounded-2xl border bg-[var(--surface)]">
      <div className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="font-semibold">Workspace navigator</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Open an environment directly without stepping through each page.
          </p>
        </div>
        <Link
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          href="/app/projects"
        >
          Manage projects
        </Link>
      </div>

      {overview.projects.length ? (
        <div className="divide-y">
          {overview.projects.map((project, index) => (
            <details className="group" key={project.id} open={index < 3}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-hover)] sm:px-6 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Folder className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {project.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {project.environments.length}{" "}
                    {project.environments.length === 1
                      ? "environment"
                      : "environments"}
                  </span>
                </span>
              </summary>

              <div className="bg-[var(--app-background)]/45 border-t px-5 py-2 sm:pl-[5.75rem] sm:pr-6">
                {project.environments.length ? (
                  project.environments.map((environment) => (
                    <Link
                      className="group/environment flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[var(--surface)]"
                      href={`/app/environments/${environment.id}?projectId=${project.id}`}
                      key={environment.id}
                    >
                      <Boxes className="size-4 shrink-0 text-[var(--muted)] group-hover/environment:text-indigo-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {environment.name}
                        </span>
                        <span className="mt-0.5 block text-xs capitalize text-[var(--muted)]">
                          {environment.kind} · version {environment.version}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)]">
                        <KeyRound className="size-3" />
                        {environment.variableCount}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-5 text-sm text-[var(--muted)]">
                    No environments in this project yet.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <Folder className="mx-auto size-6 text-[var(--muted)]" />
          <h4 className="mt-4 text-sm font-medium">No projects yet</h4>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a project to start organizing environments.
          </p>
          <Link
            className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            href="/app/projects"
          >
            Open projects
          </Link>
        </div>
      )}
    </section>
  );
}
