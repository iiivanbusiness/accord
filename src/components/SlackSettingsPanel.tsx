"use client";

import { useState, useTransition } from "react";

type Channel = { id: string; name: string };

export default function SlackSettingsPanel({
  configured,
  connected,
  teamName,
  currentChannelId,
  currentChannelName,
  channels,
  channelsError,
  enabled,
  setChannelAction,
  toggleAction,
  disconnectAction,
}: {
  configured: boolean;
  connected: boolean;
  teamName: string | null;
  currentChannelId: string | null;
  currentChannelName: string | null;
  channels: Channel[];
  channelsError: string | null;
  enabled: boolean;
  setChannelAction: (formData: FormData) => Promise<void>;
  toggleAction: () => Promise<void>;
  disconnectAction: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (!configured) {
    return (
      <div className="px-[22px] py-[18px] text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
        Slack isn&apos;t set up for this deployment yet — a SLACK_CLIENT_ID/SECRET needs to be configured first.
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="px-[22px] py-[18px]">
        <a href="/api/slack/connect" className="btn btn-secondary btn-sm inline-flex">Connect Slack</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-[22px] py-[18px]">
      {error && (
        <div className="rounded-[8px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "#c0392b" }}>
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="text-[12.5px]">
          Connected to <span className="font-medium">{teamName}</span>
          {currentChannelName && <span style={{ color: "var(--ink-muted)" }}> · posting to #{currentChannelName}</span>}
        </div>
        <button type="button" disabled={isPending} onClick={() => run(toggleAction)} className={`btn btn-sm flex-none ${enabled ? "btn-secondary" : "btn-primary"}`}>
          {enabled ? "Pause" : "Resume"}
        </button>
      </div>

      {channelsError ? (
        <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Couldn&apos;t load channels: {channelsError}</div>
      ) : (
        <form
          action={(formData) => {
            const select = formData.get("channelId");
            const channel = channels.find((c) => c.id === select);
            if (channel) formData.set("channelName", channel.name);
            run(() => setChannelAction(formData));
          }}
          className="flex items-center gap-2"
        >
          <select name="channelId" defaultValue={currentChannelId ?? ""} className="input flex-1" style={{ fontSize: "12.5px", padding: "7px 10px" }}>
            <option value="" disabled>Choose a channel</option>
            {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
          </select>
          <button type="submit" disabled={isPending} className="btn btn-secondary btn-sm flex-none">Save</button>
        </form>
      )}

      <button type="button" disabled={isPending} onClick={() => run(disconnectAction)} className="self-start text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
        Disconnect Slack
      </button>
    </div>
  );
}
