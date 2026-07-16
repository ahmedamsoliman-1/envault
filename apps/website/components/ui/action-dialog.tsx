"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-[var(--surface)] p-6 shadow-2xl outline-none">
          <div className="pr-10">
            <Dialog.Title className="text-lg font-semibold tracking-[-0.02em]">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          <Dialog.Close className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </Dialog.Close>
          {children ? <div className="mt-6">{children}</div> : null}
          {footer ? (
            <div className="mt-7 flex justify-end gap-3">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  pending = false,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <ActionDialog
      description={description}
      footer={
        <>
          <button
            className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-indigo-600 hover:bg-indigo-500"
            }`}
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "Please wait…" : confirmLabel}
          </button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  );
}
