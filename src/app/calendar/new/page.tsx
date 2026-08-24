import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createEvent } from "../actions";

export default function NewEventPage() {
  return (
    <AppShell active="/calendar" screenLabel="New event">
      <Link href="/calendar" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>
        ← Calendar
      </Link>

      <div className="mb-6 max-w-[480px]">
        <h1 className="text-[25px] font-medium" style={{ letterSpacing: "-0.8px" }}>New event</h1>
        <div className="mt-1 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          Once Google Calendar is connected, these show up automatically — for now, add them manually.
        </div>
      </div>

      <form action={createEvent} className="card flex max-w-[480px] flex-col gap-4 p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Title</span>
          <input name="title" required placeholder="Discovery call — Acme Fitness" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Client (optional)</span>
          <input name="clientName" placeholder="Acme Fitness" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Date &amp; time</span>
          <input name="startTime" type="datetime-local" required className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Meeting link (optional)</span>
          <input name="meetingUrl" placeholder="https://zoom.us/j/... or meet.google.com/..." className="input" />
          <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
            Add this to schedule a notetaker bot that joins automatically at the start time.
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Duration (min)</span>
            <input name="durationMinutes" type="number" defaultValue={30} min={5} step={5} className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Platform</span>
            <select name="platform" defaultValue="zoom" className="input">
              <option value="zoom" style={{ background: "var(--surface-1)" }}>Zoom</option>
              <option value="meet" style={{ background: "var(--surface-1)" }}>Google Meet</option>
            </select>
          </label>
        </div>
        <button type="submit" className="btn btn-primary mt-2 w-full justify-center">
          Add event
        </button>
      </form>
    </AppShell>
  );
}
