// Small animated "sent" payoff — a checkmark that pops in, reused wherever
// something just went out (voice-triggered review request, sending a
// contract into an approval chain) so that moment reads as confirmed
// rather than just silently continuing to the next page.
export default function SentConfirmationCard({ title }: { title: string }) {
  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-[16px] px-6 py-6 text-center"
      style={{ background: "var(--success-soft)", animation: "send-pop 0.3s ease-out" }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "var(--success)", animation: "send-fly 0.8s ease-out" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M22 2 11 13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 2 15 22l-4-9-9-4 20-7Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-[13px] font-medium" style={{ color: "var(--success)" }}>{title}</p>
    </div>
  );
}
