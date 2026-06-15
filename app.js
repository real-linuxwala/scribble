(() => {
  "use strict";

  const bgCanvas = document.getElementById("bgCanvas");
  const drawCanvas = document.getElementById("drawCanvas");
  const wrap = document.getElementById("canvasWrap");
  const stage = document.getElementById("stage");
  const bgCtx = bgCanvas.getContext("2d");
  const ctx = drawCanvas.getContext("2d");

  // ---- State ----
  const state = {
    tool: "pen",
    color: "#1a1a1a",
    size: 6,
    opacity: 1,
    bg: "#ffffff",
    dpr: Math.max(1, Math.min(window.devicePixelRatio || 1, 3)),
  };

  let drawing = false;
  let start = null;          // start point for shapes
  let snapshot = null;       // ImageData of draw layer at gesture start (for live shape preview)
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 50;

  // ---- Sizing ----
  function fitCanvas() {
    // Available area inside the stage (minus padding).
    const cs = getComputedStyle(stage);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availW = Math.max(200, stage.clientWidth - padX);
    const availH = Math.max(200, stage.clientHeight - padY);

    // Preserve existing drawing while resizing.
    const prev = drawCanvas.width
      ? ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height)
      : null;
    const prevW = drawCanvas.width;
    const prevH = drawCanvas.height;

    const cssW = Math.floor(availW);
    const cssH = Math.floor(availH);
    const dpr = state.dpr;

    [bgCanvas, drawCanvas].forEach((c) => {
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
      c.width = Math.floor(cssW * dpr);
      c.height = Math.floor(cssH * dpr);
    });
    wrap.style.width = cssW + "px";
    wrap.style.height = cssH + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    paintBackground();

    // Re-draw previous content scaled to the new buffer (best-effort).
    if (prev) {
      const tmp = document.createElement("canvas");
      tmp.width = prevW;
      tmp.height = prevH;
      tmp.getContext("2d").putImageData(prev, 0, 0);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(tmp, 0, 0, drawCanvas.width, drawCanvas.height);
      ctx.restore();
    }
  }

  function paintBackground() {
    bgCtx.setTransform(1, 0, 0, 1, 0, 0);
    bgCtx.fillStyle = state.bg;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  }

  // ---- History ----
  function pushHistory() {
    undoStack.push(ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }

  function restore(imageData) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height));
    restore(undoStack.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height));
    restore(redoStack.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    document.getElementById("undo").disabled = undoStack.length === 0;
    document.getElementById("redo").disabled = redoStack.length === 0;
  }

  // ---- Pointer helpers ----
  function getPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function applyStrokeStyle() {
    ctx.lineWidth = state.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (state.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = state.color;
      ctx.fillStyle = state.color;
      ctx.globalAlpha = state.opacity;
    }
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    drawing = true;
    try { drawCanvas.setPointerCapture(e.pointerId); } catch (_) {}
    pushHistory();
    start = getPos(e);
    snapshot = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    applyStrokeStyle();

    if (state.tool === "pen" || state.tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      // Draw a dot so single clicks register.
      ctx.lineTo(start.x + 0.01, start.y + 0.01);
      ctx.stroke();
    }
  }

  function onMove(e) {
    if (!drawing) return;
    const p = getPos(e);

    if (state.tool === "pen" || state.tool === "eraser") {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }

    // Shapes: restore snapshot then draw preview each frame.
    restore(snapshot);
    applyStrokeStyle();
    ctx.beginPath();
    if (state.tool === "line") {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (state.tool === "rect") {
      ctx.strokeRect(
        Math.min(start.x, p.x),
        Math.min(start.y, p.y),
        Math.abs(p.x - start.x),
        Math.abs(p.y - start.y)
      );
    } else if (state.tool === "ellipse") {
      const cx = (start.x + p.x) / 2;
      const cy = (start.y + p.y) / 2;
      const rx = Math.abs(p.x - start.x) / 2;
      const ry = Math.abs(p.y - start.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function onUp(e) {
    if (!drawing) return;
    drawing = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    try { drawCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    snapshot = null;
  }

  // ---- UI wiring ----
  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll(".tool").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.tool === tool)
    );
  }

  document.querySelectorAll(".tool").forEach((btn) => {
    btn.addEventListener("click", () => setTool(btn.dataset.tool));
  });

  document.querySelectorAll(".bg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.bg = btn.dataset.bg;
      document.querySelectorAll(".bg-btn").forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
      paintBackground();
    });
  });

  const colorInput = document.getElementById("color");
  colorInput.addEventListener("input", (e) => {
    state.color = e.target.value;
    if (state.tool === "eraser") setTool("pen");
  });

  const sizeInput = document.getElementById("size");
  const sizeVal = document.getElementById("sizeVal");
  sizeInput.addEventListener("input", (e) => {
    state.size = +e.target.value;
    sizeVal.textContent = state.size;
  });

  const opacityInput = document.getElementById("opacity");
  const opacityVal = document.getElementById("opacityVal");
  opacityInput.addEventListener("input", (e) => {
    state.opacity = +e.target.value / 100;
    opacityVal.textContent = e.target.value + "%";
  });

  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);

  document.getElementById("clear").addEventListener("click", () => {
    pushHistory();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    ctx.restore();
  });

  document.getElementById("download").addEventListener("click", () => {
    // Composite background + drawing onto an export canvas.
    const out = document.createElement("canvas");
    out.width = drawCanvas.width;
    out.height = drawCanvas.height;
    const octx = out.getContext("2d");
    octx.drawImage(bgCanvas, 0, 0);
    octx.drawImage(drawCanvas, 0, 0);
    const link = document.createElement("a");
    link.download = "scribble-" + Date.now() + ".png";
    link.href = out.toDataURL("image/png");
    link.click();
  });

  // Color swatches
  const PALETTE = [
    "#000000", "#5f6368", "#9aa0a6", "#ffffff",
    "#e0556b", "#ff8a3d", "#ffd23f", "#3ddc84",
    "#1aa3ff", "#4f8cff", "#7c5cff", "#ff5cc8",
    "#8b5a2b", "#1a1a1a", "#0f9d58", "#d93025",
  ];
  const swatchWrap = document.getElementById("swatches");
  PALETTE.forEach((c) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = c;
    b.title = c;
    b.addEventListener("click", () => {
      state.color = c;
      colorInput.value = c;
      if (state.tool === "eraser") setTool("pen");
    });
    swatchWrap.appendChild(b);
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (mod) return;
    const map = { b: "pen", e: "eraser", l: "line", r: "rect", o: "ellipse" };
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
  });

  // Pointer events
  drawCanvas.addEventListener("pointerdown", onDown);
  drawCanvas.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  drawCanvas.addEventListener("pointercancel", onUp);

  // Resize (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitCanvas, 120);
  });

  // Init
  fitCanvas();
  updateHistoryButtons();
})();
