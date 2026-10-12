/* Dentro i Classici — animazioni a scatti, come una stampa o un cartone fatto a mano. */
(() => {
  "use strict";

  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));

  // Lo sconto vale fino al 31 ottobre 2026 compreso, ora italiana.
  const PROMO_END = Date.parse("2026-11-01T00:00:00+01:00");
  if (Date.now() >= PROMO_END) root.classList.add("promo-over");

  /* ---------------------------------------------------------- Lettere a timbro */

  // Le righe di uno stesso blocco condividono il conto, così le lettere cadono in fila.
  function splitLetters(scope, startDelay = 0) {
    let i = 0;
    scope.querySelectorAll("[data-stamp]").forEach((el) => {
      const text = el.textContent;
      el.textContent = "";
      for (const char of text) {
        if (char === " ") {
          el.append(" ");
          continue;
        }
        const span = document.createElement("span");
        span.className = "ch";
        span.textContent = char;
        span.style.setProperty("--i", i++);
        span.style.setProperty("--d", `${startDelay}ms`);
        el.append(span);
      }
    });
  }

  /* ---------------------------------------------------------- Stampa a retino */

  const INK = [23, 18, 15];
  const RED = [226, 67, 29];
  const FRAME = 110; // ms per fotogramma
  const PITCH = 4.4; // passo del retino in pixel CSS

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Prepara un'immagine: lastra del nero, punti del retino e immagine finale.
  function makePrint(img) {
    const mode = img.dataset.print;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const shown = img.getBoundingClientRect().height || H;
    const pitch = Math.max(4, Math.round((PITCH * H) / shown));

    const source = document.createElement("canvas");
    source.width = W;
    source.height = H;
    const sctx = source.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, W, H).data; // fallisce da file://: si resta sull'immagine

    // Lastra del nero: contorni e campiture scure.
    const lines = document.createElement("canvas");
    lines.width = W;
    lines.height = H;
    const lctx = lines.getContext("2d");
    const plate = lctx.createImageData(W, H);
    for (let p = 0; p < data.length; p += 4) {
      const a = data[p + 3];
      if (a < 40) continue;
      const l = luminance(data[p], data[p + 1], data[p + 2]);
      const k = Math.min(1, Math.max(0, (118 - l) / 42));
      if (k <= 0) continue;
      plate.data[p] = INK[0];
      plate.data[p + 1] = INK[1];
      plate.data[p + 2] = INK[2];
      plate.data[p + 3] = Math.round(k * a);
    }
    lctx.putImageData(plate, 0, 0);

    // Retino ruotato di 45°, come nella stampa a punti dei vecchi fumetti.
    const dots = [];
    const c = Math.SQRT1_2;
    const n = Math.ceil(Math.hypot(W, H) / pitch / 2) + 1;
    const half = Math.max(1, Math.floor(pitch / 3));
    for (let u = -n; u <= n; u++) {
      for (let v = -n; v <= n; v++) {
        const x = W / 2 + (u - v) * pitch * c;
        const y = H / 2 + (u + v) * pitch * c;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let dy = -half; dy <= half; dy += half) {
          for (let dx = -half; dx <= half; dx += half) {
            const sx = Math.min(W - 1, Math.max(0, Math.round(x + dx)));
            const sy = Math.min(H - 1, Math.max(0, Math.round(y + dy)));
            const q = (sy * W + sx) * 4;
            const qa = data[q + 3];
            r += data[q] * qa;
            g += data[q + 1] * qa;
            b += data[q + 2] * qa;
            a += qa;
            count++;
          }
        }
        if (a / count < 60) continue;
        r /= a;
        g /= a;
        b /= a;
        const dark = 1 - luminance(r, g, b) / 255;
        dots.push({ x, y, dark, cover: a / count / 255, fill: `rgb(${r | 0},${g | 0},${b | 0})` });
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.className = img.className.replace(/\bprint\b/, "printed");
    if (img.alt) {
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", img.alt);
    } else {
      canvas.setAttribute("aria-hidden", "true");
    }
    const ctx = canvas.getContext("2d");

    function inkDots(scale, color = INK, flat = false) {
      ctx.fillStyle = `rgb(${color})`;
      ctx.beginPath();
      for (const d of dots) {
        const size = flat ? 0.36 : 0.12 + 0.62 * Math.sqrt(d.dark);
        const radius = pitch * size * scale * d.cover;
        if (radius < 0.4) continue;
        ctx.moveTo(d.x + radius, d.y);
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    function colorDots(scale) {
      for (const d of dots) {
        const radius = pitch * (0.42 + 0.3 * Math.sqrt(d.dark)) * scale * d.cover;
        ctx.fillStyle = d.fill;
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ogni modo è una sequenza di fotogrammi; l'ultimo resta.
    const frames = {
      color: [
        () => ctx.drawImage(lines, 0, 0),
        () => { inkDots(0.55); ctx.drawImage(lines, 0, 0); },
        () => { colorDots(0.7); ctx.drawImage(lines, 0, 0); },
        () => { colorDots(1); ctx.drawImage(lines, 0, 0); },
        () => ctx.drawImage(img, 0, 0),
      ],
      ink: [
        () => ctx.drawImage(lines, 0, 0),
        () => { inkDots(0.6); ctx.drawImage(lines, 0, 0); },
        () => { inkDots(1); ctx.drawImage(lines, 0, 0); },
      ],
      ghost: [
        () => inkDots(0.45, RED, true),
        () => inkDots(0.75, RED, true),
        () => inkDots(1, RED, true),
      ],
    }[mode];

    img.after(canvas);
    img.hidden = true;

    function show(index) {
      ctx.clearRect(0, 0, W, H);
      frames[index]();
    }
    return {
      canvas,
      async play(delay = 0) {
        if (still) return show(frames.length - 1);
        await wait(delay);
        for (let k = 0; k < frames.length; k++) {
          show(k);
          await wait(FRAME);
        }
        const target = canvas.closest(".reader-anim") || canvas;
        target.classList.add("boil");
        target.style.setProperty("--bd", `${-Math.random().toFixed(2)}s`);
      },
    };
  }

  function loaded(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise((done, fail) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", fail, { once: true });
    });
  }

  // Se la stampa non si può fare, l'immagine originale torna visibile.
  async function printer(img) {
    try {
      await loaded(img);
      if (img.decode) await img.decode().catch(() => {});
      return makePrint(img);
    } catch {
      img.style.visibility = "visible";
      return null;
    }
  }

  /* ---------------------------------------------------------- La lettrice, a passo uno */

  // Tre disegni: posa base, gambe che dondolano, pagina che si gira.
  function animateReader(wrap) {
    if (still || !wrap) return;
    const show = (frame) => (wrap.dataset.show = frame);
    const swing = [["legs", 240], ["base", 240], ["legs", 240], ["base", 240]];
    const page = [["page", 560], ["base", 0]];
    async function loop() {
      for (;;) {
        await wait(1400 + Math.random() * 1600);
        const seq = Math.random() < 0.6 ? swing : page;
        for (const [frame, ms] of seq) {
          show(frame);
          await wait(ms);
        }
      }
    }
    loop();
  }

  /* ---------------------------------------------------------- Comparsa allo scroll */

  function onEnter(elements, callback, threshold = 0.25) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          callback(entry.target);
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    elements.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------- Video */

  function setupVideo() {
    const video = document.querySelector(".phone-video");
    const button = document.querySelector(".sound");
    if (!video || !button) return;
    let heard = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.preload = "auto";
          if (!still || heard) video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(video);

    button.addEventListener("click", () => {
      const on = video.muted;
      video.muted = !on;
      if (on && !heard) {
        heard = true;
        video.currentTime = 0;
      }
      if (on) video.play().catch(() => {});
      button.textContent = on ? "Disattiva l’audio" : "Attiva l’audio";
      button.setAttribute("aria-pressed", String(on));
    });
  }

  /* ---------------------------------------------------------- Copia indirizzo */

  function setupCopy() {
    document.querySelectorAll("[data-copy]").forEach((button) => {
      const label = button.textContent;
      button.addEventListener("click", async () => {
        const text = button.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const field = document.createElement("textarea");
          field.value = text;
          field.setAttribute("readonly", "");
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.append(field);
          field.select();
          document.execCommand("copy");
          field.remove();
        }
        button.textContent = "Copiato ✓";
        setTimeout(() => (button.textContent = label), 2200);
      });
    });
  }

  /* ---------------------------------------------------------- Avvio */

  async function start() {
    const hero = document.querySelector(".hero");
    const cta = document.querySelector(".cta");
    splitLetters(hero);
    splitLetters(cta);

    // Le lettere partono solo con il font giusto, altrimenti "salterebbero" due volte.
    await Promise.race([document.fonts.ready, wait(1500)]);
    root.classList.add("is-ready");
    hero.classList.add("is-in");
    hero.querySelectorAll("[data-stamp]").forEach((el) => el.classList.add("is-in"));
    const reader = document.querySelector(".reader");
    if (reader) {
      printer(reader).then(async (p) => {
        if (!p) return;
        await p.play(still ? 0 : 1420);
        animateReader(document.querySelector(".reader-anim"));
      });
    }

    setupVideo();
    setupCopy();

    // Passi e telefono: uno dopo l'altro.
    const reveals = [...document.querySelectorAll("[data-reveal]")];
    reveals.forEach((el, k) => el.style.setProperty("--d", `${(k % 4) * 110}ms`));
    onEnter(reveals, (el) => el.classList.add("is-in"), 0.2);

    // La coppia del pubblico si stampa quando entra nello schermo.
    const couple = document.querySelector(".couple");
    if (couple) {
      const print = printer(couple);
      onEnter([couple.parentElement], async () => {
        const p = await print;
        if (p) p.play(150);
      }, 0.25);
    }

    if (cta) {
      const writer = cta.querySelector("img.print");
      const print = writer ? printer(writer) : Promise.resolve(null);
      onEnter([cta], async () => {
        cta.querySelectorAll("[data-stamp]").forEach((el) => el.classList.add("is-in"));
        const p = await print;
        if (p) p.play(420);
      }, 0.3);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
