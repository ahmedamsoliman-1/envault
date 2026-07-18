"use client";

import { KeepClient } from "@keephq/api-client";
import type {
  ClipboardItemContentDto,
  ClipboardItemDto,
  ClipboardPersistenceMode,
} from "@keephq/api-contract";
import {
  Braces,
  Check,
  Clipboard,
  Code2,
  Copy,
  Eye,
  FileText,
  Link2,
  Pin,
  PinOff,
  Search,
  ShieldAlert,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/action-dialog";
import { getUserFacingError } from "@/lib/user-errors";

const client = new KeepClient({ baseUrl: "" });

const CONTENT_ICON: Record<
  ClipboardItemDto["contentType"],
  ComponentType<{ className?: string }>
> = {
  text: FileText,
  url: Link2,
  code: Code2,
  json: Braces,
  command: TerminalSquare,
};

const PERSISTENCE_OPTIONS: {
  value: ClipboardPersistenceMode;
  label: string;
}[] = [
  { value: "temporary", label: "Keep temporarily" },
  { value: "once", label: "Send once" },
  { value: "pinned", label: "Pin" },
];

function relativeTime(iso: string): string {
  const deltaSeconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const abs = Math.abs(deltaSeconds);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (abs >= seconds || unit === "second")
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
  }
  return "just now";
}

/** Same ordering the list API applies: pinned first, then newest first. */
function sortItems(items: ClipboardItemDto[]): ClipboardItemDto[] {
  return [...items].sort((a, b) => {
    if ((a.pinnedAt === null) !== (b.pinnedAt === null))
      return a.pinnedAt === null ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

interface ClipboardSyncMessage {
  eventId: string;
  type: "created" | "updated" | "deleted" | "consumed" | "pinned" | "unpinned";
  itemId: string;
  item: ClipboardItemDto | null;
  createdAt: string;
}

/**
 * Reconcile a real-time sync event into local state. Upserts are keyed by id so
 * an event echoing the caller's own mutation is idempotent (no duplicates).
 */
function applyClipboardEvent(
  items: ClipboardItemDto[],
  event: ClipboardSyncMessage,
): ClipboardItemDto[] {
  if (event.type === "deleted") {
    return items.filter((item) => item.id !== event.itemId);
  }
  // A consumed one-time item is no longer visible; drop it.
  if (event.type === "consumed" && event.item?.persistenceMode === "once") {
    return items.filter((item) => item.id !== event.itemId);
  }
  if (!event.item) return items;
  const next = event.item;
  const withoutItem = items.filter((item) => item.id !== next.id);
  return sortItems([next, ...withoutItem]);
}

function ItemIcon({ item }: { item: ClipboardItemDto }) {
  if (item.sensitivity !== "normal")
    return <ShieldAlert className="size-4 text-amber-500" />;
  const Icon = CONTENT_ICON[item.contentType];
  return <Icon className="size-4 text-indigo-500" />;
}

export function ClipboardWorkspace() {
  const [items, setItems] = useState<ClipboardItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [persistenceMode, setPersistenceMode] =
    useState<ClipboardPersistenceMode>("temporary");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClipboardItemContentDto | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [deleting, setDeleting] = useState<ClipboardItemDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void client.clipboard
      .list()
      .then((result) => setItems(result.items))
      .catch((error: unknown) =>
        toast.error(getUserFacingError(error, "Clipboard could not load.")),
      )
      .finally(() => setLoading(false));
  }, []);

  // Live updates: tail the server event stream so items added, pinned or
  // removed elsewhere (other tabs/devices) appear without a manual refresh.
  // EventSource reconnects on its own and resumes via Last-Event-ID.
  useEffect(() => {
    const source = new EventSource("/api/v1/clipboard/events");
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as ClipboardSyncMessage;
        setItems((current) => applyClipboardEvent(current, event));
      } catch {
        // Ignore malformed frames; the next event or reconnect reconciles.
      }
    };
    return () => source.close();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.safePreview?.toLocaleLowerCase().includes(query) ||
        item.contentType.includes(query) ||
        item.originClient.includes(query),
    );
  }, [items, search]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function selectItem(item: ClipboardItemDto) {
    setSelectedId(item.id);
    setDetail(null);
    setRevealed(false);
    try {
      setDetail(await client.clipboard.get(item.id));
    } catch (error) {
      toast.error(getUserFacingError(error, "The item could not be opened."));
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setCreating(true);
    try {
      const created = await client.clipboard.create({
        content,
        persistenceMode,
      });
      setItems((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setContent("");
      setPersistenceMode("temporary");
      toast.success("Added to clipboard");
    } catch (error) {
      toast.error(getUserFacingError(error, "The item could not be added."));
    } finally {
      setCreating(false);
    }
  }

  async function copyItem(item: ClipboardItemDto) {
    try {
      const full =
        detail && detail.id === item.id
          ? detail
          : await client.clipboard.get(item.id);
      await navigator.clipboard.writeText(full.content);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error(getUserFacingError(error, "The item could not be copied."));
    }
  }

  async function togglePin(item: ClipboardItemDto) {
    setBusy(true);
    try {
      const updated = item.pinnedAt
        ? await client.clipboard.unpin(item.id)
        : await client.clipboard.pin(item.id);
      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id ? updated : existing,
        ),
      );
      toast.success(item.pinnedAt ? "Unpinned" : "Pinned");
    } catch (error) {
      toast.error(getUserFacingError(error, "The item could not be updated."));
    } finally {
      setBusy(false);
    }
  }

  async function consumeItem(item: ClipboardItemDto) {
    setBusy(true);
    try {
      const consumed = await client.clipboard.consume(item.id);
      await navigator.clipboard.writeText(consumed.content);
      // one-time items are removed server-side once consumed
      const stillListed = (await client.clipboard.list()).items;
      setItems(stillListed);
      if (item.id === selectedId) setSelectedId(null);
      toast.success("Copied and marked consumed");
    } catch (error) {
      toast.error(getUserFacingError(error, "The item could not be consumed."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem() {
    if (!deleting) return;
    setBusy(true);
    try {
      await client.clipboard.delete(deleting.id);
      setItems((current) => current.filter((item) => item.id !== deleting.id));
      if (deleting.id === selectedId) setSelectedId(null);
      setDeleting(null);
      toast.success("Deleted");
    } catch (error) {
      toast.error(getUserFacingError(error, "The item could not be deleted."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        className="rounded-2xl border bg-[var(--surface)] p-4 sm:p-5"
        onSubmit={(event) => void addItem(event)}
      >
        <label className="text-sm font-medium" htmlFor="clipboard-content">
          New clipboard item
        </label>
        <textarea
          className="focus:ring-3 mt-2 min-h-24 w-full resize-y rounded-xl border bg-transparent px-3.5 py-3 font-mono text-sm outline-none focus:border-[var(--accent)] focus:ring-indigo-500/10"
          id="clipboard-content"
          maxLength={1_048_576}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste text, a URL, JSON, a command, or a code snippet…"
          value={content}
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <select
            aria-label="Retention"
            className="rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) =>
              setPersistenceMode(event.target.value as ClipboardPersistenceMode)
            }
            value={persistenceMode}
          >
            {PERSISTENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={creating || !content.trim()}
            type="submit"
          >
            <Clipboard className="size-4" />
            {creating ? "Adding…" : "Add item"}
          </button>
        </div>
      </form>

      <div className="relative mt-6 w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          className="focus:ring-3 w-full rounded-xl border bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-indigo-500/10"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search clipboard history"
          type="search"
          value={search}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => (
                <div
                  className="h-20 animate-pulse rounded-2xl border bg-[var(--surface)]"
                  key={key}
                />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <ul className="space-y-3">
              {filtered.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      className={`w-full rounded-2xl border bg-[var(--surface)] p-4 text-left transition hover:border-indigo-500/35 ${
                        active
                          ? "border-indigo-500/60 ring-1 ring-indigo-500/20"
                          : ""
                      }`}
                      onClick={() => void selectItem(item)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <ItemIcon item={item} />
                        <span className="truncate font-mono text-sm">
                          {item.safePreview ??
                            (item.sensitivity === "secret"
                              ? "Secret item"
                              : "Sensitive item")}
                        </span>
                        {item.pinnedAt ? (
                          <Pin className="ml-auto size-3.5 shrink-0 text-indigo-500" />
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                        <span className="capitalize">{item.originClient}</span>
                        <span aria-hidden>·</span>
                        <span className="capitalize">{item.contentType}</span>
                        <span aria-hidden>·</span>
                        <span>{relativeTime(item.createdAt)}</span>
                        {item.persistenceMode === "once" ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600">
                            once
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed bg-[var(--surface)] px-6 py-16 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border">
                <Clipboard className="size-5 text-[var(--muted)]" />
              </div>
              <h3 className="mt-5 font-semibold">Nothing here yet</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Add a clipboard item above to start your history.
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {selected ? (
            <div className="rounded-2xl border bg-[var(--surface)] p-5 lg:sticky lg:top-24">
              <div className="flex items-center gap-2">
                <ItemIcon item={selected} />
                <span className="text-sm font-semibold capitalize">
                  {selected.contentType}
                </span>
                {selected.sensitivity !== "normal" ? (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium capitalize text-amber-600">
                    {selected.sensitivity}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 max-h-64 overflow-auto rounded-xl border bg-[var(--app-background)] p-3">
                {detail ? (
                  selected.sensitivity === "normal" || revealed ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
                      {detail.content}
                    </pre>
                  ) : (
                    <button
                      className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                      onClick={() => setRevealed(true)}
                      type="button"
                    >
                      <Eye className="size-4" />
                      Reveal sensitive content
                    </button>
                  )
                ) : (
                  <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-hover)]" />
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  onClick={() => void copyItem(selected)}
                  type="button"
                >
                  <Copy className="size-4" />
                  Copy
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void togglePin(selected)}
                  type="button"
                >
                  {selected.pinnedAt ? (
                    <>
                      <PinOff className="size-4" /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="size-4" /> Pin
                    </>
                  )}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void consumeItem(selected)}
                  type="button"
                >
                  <Check className="size-4" />
                  Consume
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10"
                  onClick={() => setDeleting(selected)}
                  type="button"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>

              <dl className="mt-5 space-y-2 border-t pt-4 text-xs text-[var(--muted)]">
                <div className="flex justify-between gap-3">
                  <dt>Source</dt>
                  <dd className="capitalize text-[var(--foreground)]">
                    {selected.originClient}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Created</dt>
                  <dd className="text-[var(--foreground)]">
                    {new Date(selected.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Expires</dt>
                  <dd className="text-[var(--foreground)]">
                    {selected.expiresAt
                      ? relativeTime(selected.expiresAt)
                      : "Never (pinned)"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Size</dt>
                  <dd className="font-mono text-[var(--foreground)]">
                    {selected.byteLength.toLocaleString()} B
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="hidden rounded-2xl border border-dashed bg-[var(--surface)] px-6 py-16 text-center lg:block">
              <p className="text-sm text-[var(--muted)]">
                Select an item to view and copy its contents.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Delete item"
        description="This permanently removes the clipboard item. This action cannot be undone."
        destructive
        onConfirm={() => void deleteItem()}
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
        pending={busy}
        title="Delete clipboard item?"
      />
    </div>
  );
}
