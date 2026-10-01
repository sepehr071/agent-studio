"use client";

import {
  MoreVerticalIcon,
  PencilIcon,
  PlugZapIcon,
  PlusIcon,
  ServerIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createMcpServerAction,
  deleteMcpServerAction,
  testMcpServerAction,
  toggleMcpServerEnabledAction,
  updateMcpServerAction,
} from "@/lib/actions";
import type { McpServerRow } from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";

type Transport = McpServerRow["transport"];

const TRANSPORT_LABELS: Record<Transport, string> = {
  http: "HTTP",
  sse: "SSE",
  stdio: "stdio",
};

const TRANSPORTS: Transport[] = ["http", "sse", "stdio"];

const FIELD_LABEL = "text-xs font-medium text-fg-3";

/** One editable key/value pair; `id` is a stable React key across removals. */
interface KvRow {
  id: string;
  key: string;
  value: string;
}

const newKvRow = (key = "", value = ""): KvRow => ({
  id: crypto.randomUUID(),
  key,
  value,
});

interface ServerForm {
  name: string;
  transport: Transport;
  url: string;
  /** bare token — sent as `Authorization: Bearer <token>` */
  bearerToken: string;
  /** non-Authorization headers as editable pairs */
  headerRows: KvRow[];
  command: string;
  /** whitespace/newline-separated args */
  argsText: string;
  envRows: KvRow[];
}

function emptyForm(): ServerForm {
  return {
    name: "",
    transport: "http",
    url: "",
    bearerToken: "",
    headerRows: [],
    command: "",
    argsText: "",
    envRows: [],
  };
}

function rowToForm(row: McpServerRow): ServerForm {
  const { token, rest } = splitBearer(row.headers);
  return {
    name: row.name,
    transport: row.transport,
    url: row.url ?? "",
    bearerToken: token,
    headerRows: rest,
    command: row.command ?? "",
    argsText: (row.args ?? []).join("\n"),
    envRows: recordToRows(row.env),
  };
}

function recordToRows(record: Record<string, string> | null): KvRow[] {
  return Object.entries(record ?? {}).map(([k, v]) => newKvRow(k, v));
}

/** Pairs → record; blank keys dropped. Returns null when nothing remains. */
function rowsToRecord(rows: KvRow[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) out[key] = row.value.trim();
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Pull a `Authorization: Bearer <token>` header out into the dedicated token
 * field; everything else (including non-Bearer Authorization) stays a row.
 */
function splitBearer(headers: Record<string, string> | null): {
  token: string;
  rest: KvRow[];
} {
  const entries = Object.entries(headers ?? {});
  const bearer = entries.find(
    ([k, v]) =>
      k.toLowerCase() === "authorization" && /^bearer\s+/i.test(v.trim()),
  );
  return {
    token: bearer ? bearer[1].trim().replace(/^bearer\s+/i, "") : "",
    rest: entries
      .filter(([k]) => k !== bearer?.[0])
      .map(([k, v]) => newKvRow(k, v)),
  };
}

function parseArgs(text: string): string[] {
  return text
    .split(/\s+/)
    .map((a) => a.trim())
    .filter(Boolean);
}

const isStdio = (t: Transport) => t === "stdio";

/**
 * Icon-tile tone keyed to server state, mirroring the StatusBadge tone ramp:
 * an enabled server reads as connected (--ok), a disabled one stays neutral.
 * `err` is wired for parity with the badge tones (transient test failures).
 */
const SERVER_TILE_TONE = {
  ok: "bg-ok/15 text-ok border border-ok/25",
  err: "bg-err/15 text-err border border-err/25",
  muted: "bg-muted text-fg-3 border border-transparent",
} as const;

export function McpServersSection({ servers }: { servers: McpServerRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McpServerRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (server: McpServerRow) => {
    setEditing(server);
    setDialogOpen(true);
  };

  return (
    <section className="glass space-y-5 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading font-bold text-base text-foreground">
            سرورهای MCP
          </h2>
          <p className="text-fg-4 text-xs">
            سرورهای ابزار خارجی که می‌توانید به دستیارها متصل کنید.
          </p>
        </div>
        <Button className="gap-1.5" onClick={openCreate} size="sm" type="button">
          <PlusIcon className="size-4" />
          سرور جدید
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 border-dashed px-6 py-8 text-center">
          <ServerIcon className="size-5 text-fg-4" />
          <p className="text-fg-3 text-sm">هنوز سروری اضافه نکرده‌اید</p>
          <p className="text-fg-4 text-xs">
            یک سرور MCP اضافه کنید تا ابزارهای آن در دسترس دستیارها قرار گیرد.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {servers.map((server) => (
            <ServerRow
              key={server.id}
              onEdit={() => openEdit(server)}
              server={server}
            />
          ))}
        </ul>
      )}

      <ServerDialog
        key={editing?.id ?? "new"}
        onOpenChange={setDialogOpen}
        onSaved={() => router.refresh()}
        open={dialogOpen}
        server={editing}
      />
    </section>
  );
}

function ServerRow({
  server,
  onEdit,
}: {
  server: McpServerRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = (on: boolean) => {
    startTransition(async () => {
      await toggleMcpServerEnabledAction(server.id, on);
      router.refresh();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteMcpServerAction(server.id);
      toast.success(`سرور «${server.name}» حذف شد`);
      router.refresh();
    });
  };

  const tileTone = server.isEnabled
    ? SERVER_TILE_TONE.ok
    : SERVER_TILE_TONE.muted;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${tileTone}`}
      >
        <ServerIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="truncate font-medium text-fg-1 text-sm"
            dir={detectDir(server.name)}
          >
            {server.name}
          </span>
          <Badge className="shrink-0 font-mono text-[10px]" variant="secondary">
            {TRANSPORT_LABELS[server.transport]}
          </Badge>
        </div>
        <p
          className="truncate text-right font-mono text-[11px] text-fg-4"
          dir="ltr"
        >
          {server.transport === "stdio"
            ? [server.command, ...(server.args ?? [])].join(" ")
            : server.url}
        </p>
      </div>

      <Switch
        aria-label={server.isEnabled ? "غیرفعال کردن سرور" : "فعال کردن سرور"}
        checked={server.isEnabled}
        disabled={isPending}
        onCheckedChange={handleToggle}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="size-7 shrink-0 text-fg-3"
            disabled={isPending}
            size="icon-sm"
            variant="ghost"
          >
            <MoreVerticalIcon className="size-4" />
            <span className="sr-only">گزینه‌ها</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem onSelect={onEdit}>
            <PencilIcon className="size-4" />
            ویرایش
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
            variant="destructive"
          >
            <Trash2Icon className="size-4" />
            حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hoisted OUTSIDE the DropdownMenu so it survives the menu unmount. */}
      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سرور MCP؟</AlertDialogTitle>
            <AlertDialogDescription>
              سرور «{server.name}» حذف می‌شود و از دستیارهایی که از آن استفاده
              می‌کنند برداشته خواهد شد. این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isPending}
              onClick={handleDelete}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function ServerDialog({
  open,
  onOpenChange,
  server,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null ⇒ create, a row ⇒ edit */
  server: McpServerRow | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ServerForm>(() =>
    server ? rowToForm(server) : emptyForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const patch = (next: Partial<ServerForm>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const stdio = isStdio(form.transport);

  /** Validate + shape the form into the action payload. */
  const buildPayload = ():
    | { ok: true; value: ServerPayload }
    | { ok: false; error: string } => {
    const name = form.name.trim();
    if (!name) return { ok: false, error: "نام سرور الزامی است." };

    if (stdio) {
      const command = form.command.trim();
      if (!command) return { ok: false, error: "دستور اجرا الزامی است." };
      return {
        ok: true,
        value: {
          name,
          transport: "stdio",
          url: null,
          headers: null,
          command,
          args: parseArgs(form.argsText),
          env: rowsToRecord(form.envRows),
        },
      };
    }

    const url = form.url.trim();
    if (!url) return { ok: false, error: "نشانی سرور الزامی است." };
    const headers = rowsToRecord(form.headerRows) ?? {};
    const token = form.bearerToken.trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    return {
      ok: true,
      value: {
        name,
        transport: form.transport,
        url,
        headers: Object.keys(headers).length ? headers : null,
        command: null,
        args: null,
        env: null,
      },
    };
  };

  const test = async () => {
    if (testing) return;
    const built = buildPayload();
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    setTesting(true);
    try {
      const result = await testMcpServerAction({
        transport: built.value.transport,
        url: built.value.url ?? undefined,
        headers: built.value.headers ?? undefined,
        command: built.value.command ?? undefined,
        args: built.value.args ?? undefined,
        env: built.value.env ?? undefined,
      });
      if (result.ok) {
        const names = result.toolNames;
        const shown = names.slice(0, 6).join("، ");
        const more = names.length > 6 ? ` و ${names.length - 6} ابزار دیگر` : "";
        toast.success(
          names.length
            ? `اتصال موفق — ابزارها: ${shown}${more}`
            : "اتصال موفق — این سرور ابزاری ارائه نمی‌دهد",
        );
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "آزمایش اتصال ناموفق بود.",
      );
    } finally {
      setTesting(false);
    }
  };

  const submit = () => {
    const built = buildPayload();
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (server) {
          await updateMcpServerAction(server.id, built.value);
        } else {
          await createMcpServerAction(built.value);
        }
        onSaved();
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ذخیره ناموفق بود.");
      }
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {server ? "ویرایش سرور MCP" : "سرور MCP جدید"}
          </DialogTitle>
          <DialogDescription className="text-fg-4 text-xs">
            یک سرور ابزار خارجی را برای استفاده در دستیارها پیکربندی کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL} htmlFor="mcp-name">
              نام
            </Label>
            <Input
              className="text-sm"
              dir={detectDir(form.name)}
              id="mcp-name"
              maxLength={80}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="مثلاً جستجوی وب، فایل‌سیستم"
              value={form.name}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={FIELD_LABEL}>نوع اتصال</Label>
            <Select
              onValueChange={(v) => patch({ transport: v as Transport })}
              value={form.transport}
            >
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              {/* Primitive already carries glass-strong; a glass-popover here
                  would double the (non-mergeable) glass class. */}
              <SelectContent>
                {TRANSPORTS.map((t) => (
                  <SelectItem className="text-sm" key={t} value={t}>
                    {TRANSPORT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {stdio ? (
            <>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL} htmlFor="mcp-command">
                  دستور اجرا
                </Label>
                <Input
                  className="font-mono text-sm"
                  dir="ltr"
                  id="mcp-command"
                  onChange={(e) => patch({ command: e.target.value })}
                  placeholder="npx"
                  value={form.command}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL} htmlFor="mcp-args">
                  آرگومان‌ها
                </Label>
                <Textarea
                  className="min-h-16 font-mono text-sm"
                  dir="ltr"
                  id="mcp-args"
                  onChange={(e) => patch({ argsText: e.target.value })}
                  placeholder={"-y\n@modelcontextprotocol/server-filesystem"}
                  value={form.argsText}
                />
                <p className="text-fg-4 text-xs">
                  هر آرگومان در یک خط یا با فاصله جدا شود.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL}>متغیرهای محیطی</Label>
                <KeyValueRows
                  addLabel="افزودن متغیر"
                  keyPlaceholder="API_KEY"
                  onChange={(envRows) => patch({ envRows })}
                  rows={form.envRows}
                  valuePlaceholder="…"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL} htmlFor="mcp-url">
                  نشانی سرور
                </Label>
                <Input
                  className="font-mono text-sm"
                  dir="ltr"
                  id="mcp-url"
                  onChange={(e) => patch({ url: e.target.value })}
                  placeholder="https://example.com/mcp"
                  value={form.url}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL} htmlFor="mcp-token">
                  کلید API
                </Label>
                <Input
                  className="font-mono text-sm"
                  dir="ltr"
                  id="mcp-token"
                  onChange={(e) =>
                    // Pasting "Bearer xxx" must not double the prefix.
                    patch({
                      bearerToken: e.target.value.replace(/^bearer\s+/i, ""),
                    })
                  }
                  placeholder="sk-…"
                  value={form.bearerToken}
                />
                <p className="text-fg-4 text-xs">
                  اختیاری — به صورت سرآیند «Authorization: Bearer …» ارسال
                  می‌شود.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL}>سرآیندهای دیگر</Label>
                <KeyValueRows
                  addLabel="افزودن سرآیند"
                  keyPlaceholder="X-Api-Key"
                  onChange={(headerRows) => patch({ headerRows })}
                  rows={form.headerRows}
                  valuePlaceholder="…"
                />
              </div>
            </>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            className="gap-1.5"
            disabled={testing || isPending}
            onClick={test}
            type="button"
            variant="outline"
          >
            <PlugZapIcon className="size-4" />
            {testing ? "در حال آزمایش…" : "آزمایش اتصال"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              انصراف
            </Button>
            <Button disabled={isPending} onClick={submit} type="button">
              {isPending ? "در حال ذخیره…" : "ذخیره"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Editable key/value pair list — replaces the old raw `key: value` textarea. */
function KeyValueRows({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
}) {
  const patchRow = (id: string, partial: Partial<KvRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...partial } : r)));

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div className="flex items-center gap-1.5" key={row.id}>
          <Input
            aria-label="نام"
            className="h-8 flex-1 font-mono text-xs"
            dir="ltr"
            onChange={(e) => patchRow(row.id, { key: e.target.value })}
            placeholder={keyPlaceholder}
            value={row.key}
          />
          <Input
            aria-label="مقدار"
            className="h-8 flex-[1.6] font-mono text-xs"
            dir="ltr"
            onChange={(e) => patchRow(row.id, { value: e.target.value })}
            placeholder={valuePlaceholder}
            value={row.value}
          />
          <Button
            className="size-7 shrink-0 text-fg-3"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-3.5" />
            <span className="sr-only">حذف</span>
          </Button>
        </div>
      ))}
      <Button
        className="h-7 gap-1 px-2 text-fg-3 text-xs"
        onClick={() => onChange([...rows, newKvRow()])}
        size="sm"
        type="button"
        variant="ghost"
      >
        <PlusIcon className="size-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

/** Shape passed to create/update actions (mirrors McpServerRow columns). */
interface ServerPayload {
  name: string;
  transport: Transport;
  url: string | null;
  headers: Record<string, string> | null;
  command: string | null;
  args: string[] | null;
  env: Record<string, string> | null;
}
