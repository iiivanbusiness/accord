"use client";

import { useRef, useState } from "react";

export default function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [dataUrl, setDataUrl] = useState("");

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function moveStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1d1d1f";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke.current = true;
    setIsEmpty(false);
  }

  function endStroke() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasStroke.current) setDataUrl(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    setIsEmpty(true);
    setDataUrl("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">Signature</span>
      <div className="relative overflow-hidden rounded-[10px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
        <canvas
          ref={canvasRef}
          width={480}
          height={140}
          className="block w-full touch-none"
          style={{ height: 140, cursor: "crosshair" }}
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
        />
        {isEmpty && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--ink-muted)" }}>
            Draw your signature here
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px]" style={{ color: "var(--ink-muted)" }}>Use your mouse or finger to sign.</span>
        <button type="button" onClick={clear} className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
          Clear
        </button>
      </div>
      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}
