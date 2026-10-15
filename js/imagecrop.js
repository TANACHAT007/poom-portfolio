// Reusable image cropper: the user controls zoom + pan, nothing is cropped automatically.
// Usage: const dataUrl = await openImageCropper(file, { aspect: 1, outW: 320 });  // null = cancelled
// It is a `fixed inset-0` overlay, so app.js gives it focus trap + Esc (Esc clicks .ic-cancel).
export function openImageCropper(file, opts = {}) {
  const aspect = opts.aspect || 4 / 3;
  const outW = opts.outW || 800;
  const outH = Math.round(outW / aspect);
  const quality = opts.quality || 0.85;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => build(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("โหลดรูปไม่สำเร็จ")); };
    img.src = url;

    function build(img) {
      const modal = document.createElement("div");
      modal.className = "fixed inset-0 z-[999] bg-slate-900/70 backdrop-blur-sm grid place-items-center px-4";
      modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
          <h3 class="font-bold mb-1">ปรับตำแหน่งรูปภาพ</h3>
          <p class="text-xs text-slate-400 mb-3">ลากเพื่อเลื่อน • ใช้แถบเลื่อนเพื่อซูมเข้า-ออก</p>
          <div class="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 mx-auto" style="width:100%;max-width:360px;">
            <canvas class="block w-full" style="aspect-ratio:${aspect};touch-action:none;cursor:grab;"></canvas>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <span class="text-slate-400 text-sm" aria-hidden="true">−</span>
            <input type="range" min="0" max="100" value="0" class="ic-zoom flex-1 accent-brand-600" aria-label="ซูม" />
            <span class="text-slate-400 text-sm" aria-hidden="true">+</span>
          </div>
          <div class="flex gap-2 mt-4">
            <button type="button" class="ic-cancel flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:border-slate-400">ยกเลิก</button>
            <button type="button" class="ic-use flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700">ใช้รูปนี้</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      const canvas = modal.querySelector("canvas");
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext("2d");
      const zoomInput = modal.querySelector(".ic-zoom");

      const minScale = Math.max(outW / img.width, outH / img.height);
      const maxScale = minScale * 3;
      let scale = minScale;
      let offX = (outW - img.width * scale) / 2;
      let offY = (outH - img.height * scale) / 2;

      const clamp = () => {
        offX = Math.min(0, Math.max(outW - img.width * scale, offX));
        offY = Math.min(0, Math.max(outH - img.height * scale, offY));
      };
      const draw = () => { ctx.clearRect(0, 0, outW, outH); ctx.drawImage(img, offX, offY, img.width * scale, img.height * scale); };
      clamp(); draw();

      zoomInput.oninput = () => {
        const t = Number(zoomInput.value) / 100;
        // keep the image point under the canvas centre stable while zooming
        const cx = (outW / 2 - offX) / scale, cy = (outH / 2 - offY) / scale;
        scale = minScale + t * (maxScale - minScale);
        offX = outW / 2 - cx * scale; offY = outH / 2 - cy * scale;
        clamp(); draw();
      };

      // pointer coordinates are CSS pixels; the canvas is drawn in output pixels
      const ratio = () => outW / (canvas.getBoundingClientRect().width || outW);
      let dragging = false, sx = 0, sy = 0, sox = 0, soy = 0;
      const down = (x, y) => { dragging = true; sx = x; sy = y; sox = offX; soy = offY; canvas.style.cursor = "grabbing"; };
      const move = (x, y) => { if (!dragging) return; const r = ratio(); offX = sox + (x - sx) * r; offY = soy + (y - sy) * r; clamp(); draw(); };
      const up = () => { dragging = false; canvas.style.cursor = "grab"; };
      const onMove = (e) => move(e.clientX, e.clientY);
      canvas.addEventListener("mousedown", (e) => down(e.clientX, e.clientY));
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", up);
      canvas.addEventListener("touchstart", (e) => { const t = e.touches[0]; down(t.clientX, t.clientY); }, { passive: true });
      canvas.addEventListener("touchmove", (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
      canvas.addEventListener("touchend", up);

      const cleanup = () => {
        URL.revokeObjectURL(url);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", up);
        modal.remove();
      };
      modal.querySelector(".ic-cancel").onclick = () => { cleanup(); resolve(null); };
      modal.querySelector(".ic-use").onclick = () => { const d = canvas.toDataURL("image/jpeg", quality); cleanup(); resolve(d); };
      modal.addEventListener("click", (e) => { if (e.target === modal) { cleanup(); resolve(null); } });
    }
  });
}
