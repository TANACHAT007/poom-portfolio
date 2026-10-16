// Hero photo trio, stat chips, photo marquee and scroll progress bar — driven by data attributes.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function initWow() {
  const bar = document.createElement("div");
  bar.id = "wow-progress";
  document.body.appendChild(bar);
  const onScroll = () => {
    const h = document.documentElement;
    bar.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100 + "%";
  };
  addEventListener("scroll", onScroll, { passive: true });

  const hero = document.getElementById("wow-hero");
  if (hero) {
    const photos = hero.dataset.photos.split(",");
    const stats = (hero.dataset.stats || "").split(";").filter(Boolean).map((x) => x.split("|"));
    hero.innerHTML =
      `<div class="wow-stats">${stats.map(([n, l]) => `<div class="wow-stat"><b data-count="${esc(n)}">${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}</div>` +
      `<div class="wow-photos">${photos.map((p) => `<div class="wow-photo"><img src="${esc(p)}" alt="" loading="eager" /></div>`).join("")}</div>`;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, m = el.dataset.count.match(/^(\d+)(.*)$/);
      if (!m || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const to = Number(m[1]), t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 1100);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + m[2];
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.5 });
    hero.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
  }

  const mq = document.getElementById("wow-marquee");
  if (mq) {
    const imgs = mq.dataset.photos.split(",").map((p) => `<img src="${esc(p)}" alt="" loading="lazy" />`).join("");
    mq.className = "wow-marquee";
    mq.innerHTML = `<div class="wow-track">${imgs}${imgs}</div>`;
  }
}
