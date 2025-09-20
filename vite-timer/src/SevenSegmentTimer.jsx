import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Seven-Segment Countdown Timer
 *  표기: MM:SS:h (h = 1자리, 1/10초)
 *  Space: 시작/일시정지 | R: 리셋 | F: 전체화면 | H: 컨트롤 숨김/표시(부드러운 슬라이드)
 */

function useRAF(running, onFrame) {
  const rafRef = useRef(null);
  useEffect(() => {
    if (!running) return;
    const loop = (t) => { onFrame(t); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [running, onFrame]);
}

async function beep(times = 5) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 1100; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      o.start(); o.stop(ctx.currentTime + 0.18);
      await new Promise(r => setTimeout(r, 250));
    }
    ctx.close();
  } catch {}
}

function SmallDoubleDot({ on = true, colorOn = "#fff", colorOff = "#101010", height = "28vh" }) {
  const color = on ? colorOn : colorOff;
  return (
    <svg viewBox="0 0 120 900" style={{ height, width: "auto" }}>
      <circle cx="60" cy="350" r="40" fill={color} />
      <circle cx="60" cy="550" r="40" fill={color} />
    </svg>
  );
}

export default function SevenSegmentTimer() {
  // 기본 10분
  const [minIn, setMinIn]     = useState(0);
  const [secIn, setSecIn]     = useState(0);
  const [initialMs, setInit]  = useState(0);
  const [remainMs, setRemain] = useState(0);
  const [running, setRunning] = useState(false);
  const [alerting, setAlert]  = useState(false);
  const [showControls, setShowControls] = useState(true);  // ✅ 숨김 상태
  const endRef = useRef(null);

  // 폰트/크기
  const MAIN_FONT  = "min(17.6vw, 61.6vh)";
  const SMALL_FONT = "min(8.8vw, 30.8vh)";
  const GAP_GROUP  = "1vw";
  const GAP_DIGIT  = "0.6vw";
  const baseColor  = alerting ? "#ff3b30" : "#ffffff";

  const FONT_STYLE = {
    fontFamily: "DSEG7, monospace",
    fontWeight: 700,
    fontSize: MAIN_FONT,
    letterSpacing: "0.005em",
    lineHeight: 1,
    color: baseColor,
  };
  const SMALL_FONT_STYLE = { ...FONT_STYLE, fontSize: SMALL_FONT };

  // 진행률
  const pct = initialMs > 0
    ? Math.min(100, Math.max(0, ((initialMs - remainMs) / initialMs) * 100))
    : 0;

  // 조작
  const apply = useCallback(() => {
    const m = Math.max(0, Math.min(99, Number(minIn) || 0));
    const s = Math.max(0, Math.min(59, Number(secIn) || 0));
    const ms = (m * 60 + s) * 1000;
    setInit(ms); setRemain(ms); setRunning(false); setAlert(false); endRef.current = null;
  }, [minIn, secIn]);

  const start = useCallback(() => {
    const base = remainMs <= 0 ? initialMs : remainMs;
    if (base <= 0) return;            // ★ 0이면 아무 것도 하지 않음
    if (remainMs <= 0) setRemain(initialMs);
    setRunning(true); setAlert(false); endRef.current = performance.now() + base;
  }, [remainMs, initialMs]);

  const pause  = useCallback(() => setRunning(false), []);
  const reset  = useCallback(() => { setRunning(false); setAlert(false); setRemain(initialMs); endRef.current = null; }, [initialMs]);
  const toggle = useCallback(() => { if (running) pause(); else start(); }, [running, start, pause]);

  // 키보드: Space / R / F / H
  useEffect(() => {
    const onKey = (e) => {
      const key = (e.key || "").toLowerCase();
      const code = e.code;
      const prevent = () => e.preventDefault();

      if (code === "Space" || key === " ") { prevent(); toggle(); }
      else if (key === "r") { reset(); }
      else if (key === "f") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
      else if (key === "h") { setShowControls(v => !v); }  // ✅ 부드러운 숨김 토글
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, reset]);

  // 카운트다운
  useRAF(running, (now) => {
    const left = Math.max(0, Math.round(endRef.current - now));
    setRemain(left);
    if (left <= 0) { setRunning(false); setAlert(true); beep(5); }
  });

  // 표시값 (MM:SS:h)
  const { mm, ss, d } = useMemo(() => {
    const deci = Math.floor(remainMs / 100) % 10;
    const s    = Math.floor(remainMs / 1000) % 60;
    const m    = Math.floor(remainMs / 60000);
    const p2   = (n) => String(n).padStart(2, "0");
    return { mm: p2(m), ss: p2(s), d: String(deci) };
  }, [remainMs]);

  const blinkColon = running || Math.floor((remainMs / 500) % 2) === 0;
  const blinkAlert = alerting && Math.floor((Date.now() / 300) % 2) === 0;

  return (
    <div style={{ width:"100vw", height:"100vh", background:"#000", color:"#fff", display:"flex", flexDirection:"column" }}>

      {/* 상단 진행바 */}
      <div className="timer-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`fill ${alerting ? "alert" : (running ? "running" : "paused")}`}
             style={{ transform: `scaleX(${initialMs > 0 ? (pct / 100) : 0})` }} />
      </div>

      {/* 중앙 숫자 */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ display:"flex", alignItems:"flex-end", gap:GAP_GROUP, opacity: blinkAlert ? 0.6 : 1, transition:"opacity .12s linear" }}>
          <div style={{ display:"flex", gap:GAP_DIGIT, alignItems:"flex-end" }}>
            <span style={FONT_STYLE}>{mm[0]}</span><span style={FONT_STYLE}>{mm[1]}</span>
          </div>
          <span style={{ ...FONT_STYLE, alignSelf:"flex-end", opacity:(blinkColon && !blinkAlert) ? 1 : .15 }}>:</span>
          <div style={{ display:"flex", gap:GAP_DIGIT, alignItems:"flex-end" }}>
            <span style={FONT_STYLE}>{ss[0]}</span><span style={FONT_STYLE}>{ss[1]}</span>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:GAP_DIGIT }}>
            <div style={{ transform:"translateY(5vh)" }}>
              <SmallDoubleDot on={!blinkAlert} colorOn={baseColor} colorOff="#101010" height="28vh" />
            </div>
            <span style={{ ...SMALL_FONT_STYLE, alignSelf:"flex-end" }}>{d}</span>
          </div>
        </div>
      </div>

      {/* 하단 컨트롤바 — 항상 렌더링, 클래스만 토글 */}
      <div className={`timer-bar ${showControls ? "" : "is-hidden"}`}>
        <div className="timer-hint">
          MM:SS:h — Space 시작/일시정지 · R 리셋 · F 전체화면 · H 숨김/표시
        </div>

        <div className="timer-controls">
          <div className="unit-field">
            <input className="timer-input" type="number" min={0} max={99}
                   value={minIn} onChange={(e)=>setMinIn(e.target.value)} aria-label="분"/>
            <span className="unit">분</span>
          </div>
          <div className="unit-field">
            <input className="timer-input" type="number" min={0} max={59}
                   value={secIn} onChange={(e)=>setSecIn(e.target.value)} aria-label="초"/>
            <span className="unit">초</span>
          </div>
          <button className="timer-btn accent" onClick={apply}>Set</button>
          <button className={`timer-btn ${running ? "warning" : "primary"}`} onClick={toggle}
          disabled={!running && initialMs <= 0 && remainMs <= 0}  // ★
          >
            {running ? "Pause" : "Start"}
          </button>
          <button className="timer-btn" onClick={reset}>Reset</button>
        </div>
      </div>
            {/* 워터마크 */}
      <div
        className="copyleft"
        style={{ bottom: showControls ? 56 : 14 }}  // 컨트롤 보일 땐 겹치지 않게 위로
      >
        No rights reserved — CC0 1.0 · <strong>BirdieAlgorithm</strong>
      </div>
    </div>
  );
}
