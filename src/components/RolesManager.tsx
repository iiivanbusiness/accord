"use client";

import { useState, useTransition } from "react";

type Role = {
  id: string;
  name: string;
  isOwner: boolean;
  canManageWorkspace: boolean;
  canManageTeam: boolean;
  canManageTemplates: boolean;
  canApproveContracts: boolean;
  canApproveTemplates: boolean;
  canViewAllDeals: boolean;
  memberCount: number;
};

const PERMISSIONS: { field: keyof Role; label: string; hint: string }[] = [
  { field: "canManageWorkspace", label: "Manage workspace settings", hint: "Workspace name, logo, sending domain, integrations" },
  { field: "canManageTeam", label: "Manage team & roles", hint: "Invite/remove teammates, create/edit/delete roles, assign roles" },
  { field: "canManageTemplates", label: "Manage contract templates", hint: "Create, edit, and delete unlocked templates" },
  { field: "canApproveContracts", label: "Approve contracts", hint: "Eligible to be a step in the approval chain" },
  { field: "canApproveTemplates", label: "Approve & lock templates", hint: "Lock templates as approved wording, and edit/delete a locked one" },
  { field: "canViewAllDeals", label: "View all deals", hint: "See every deal and client in the workspace — without it, only deals this person started" },
];

function PermissionCheckboxes({ role }: { role?: Role }) {
  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {PERMISSIONS.map((p) => (
        <label key={p.field} className="flex items-start gap-2.5">
          <input type="checkbox" name={p.field} defaultChecked={role ? Boolean(role[p.field]) : false} className="mt-0.5" />
          <span>
            <span className="block text-[12.5px] font-medium">{p.label}</span>
            <span className="block text-[11.5px]" style={{ color: "var(--ink-muted)" }}>{p.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function RolesManager({
  roles,
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
}: {
  roles: Role[];
  createRoleAction: (formData: FormData) => Promise<void>;
  updateRoleAction: (roleId: string, formData: FormData) => Promise<void>;
  deleteRoleAction: (roleId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setEditingId(null);
        setAdding(false);
        setConfirmingDeleteId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="px-[22px] py-2">
      {error && (
        <div className="mb-2 mt-2 rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {roles.map((role) => (
        <div key={role.id} className="border-b py-3" style={{ borderColor: "var(--hairline-soft)" }}>
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium">{role.name}</span>
              {role.isOwner && <span className="chip chip-neutral" style={{ fontSize: 10.5 }}>Owner</span>}
              <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                {role.memberCount} {role.memberCount === 1 ? "member" : "members"}
              </span>
            </div>
            {!role.isOwner && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingId(editingId === role.id ? null : role.id); setError(null); }}
                  className="text-[12px] font-medium"
                  style={{ color: "var(--accent-blue)" }}
                >
                  {editingId === role.id ? "Close" : "Edit"}
                </button>
                {confirmingDeleteId === role.id ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(() => deleteRoleAction(role.id))}
                      className="text-[12px] font-medium"
                      style={{ color: "#c0392b" }}
                    >
                      Confirm delete
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)} className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setConfirmingDeleteId(role.id); setError(null); }}
                    className="text-[12px] font-medium"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {editingId === role.id && (
            <form
              action={(formData) => runAction(() => updateRoleAction(role.id, formData))}
              className="mt-2.5 rounded-[10px] p-3.5"
              style={{ background: "var(--surface-2)" }}
            >
              <input name="name" defaultValue={role.name} className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
              <PermissionCheckboxes role={role} />
              <button type="submit" disabled={isPending} className="btn btn-primary btn-sm mt-3">Save role</button>
            </form>
          )}
        </div>
      ))}

      {adding ? (
        <form
          action={(formData) => runAction(() => createRoleAction(formData))}
          className="my-3 rounded-[10px] p-3.5"
          style={{ background: "var(--surface-2)" }}
        >
          <input name="name" placeholder="Role name" required className="input" style={{ fontSize: "13px", padding: "8px 11px" }} />
          <PermissionCheckboxes />
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">Create role</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-secondary btn-sm">Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setAdding(true); setError(null); }} className="my-3 text-[12.5px] font-medium" style={{ color: "var(--accent-blue)" }}>
          + Add role
        </button>
      )}
    </div>
  );
}
