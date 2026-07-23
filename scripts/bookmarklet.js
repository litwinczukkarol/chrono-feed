/**
 * Serializd Chrono-Feed Bookmarklet (v0.1)
 * 
 * Wyciąga ID seriali ze strony Serializd (DOM + React Props + __NEXT_DATA__)
 * i przesyła je jako parametry URL do aplikacji Chrono-Feed.
 */
(function () {
  const TARGET_URL = "https://chrono-feed-app.vercel.app/";

  if (!window.location.hostname.includes("serializd.com")) {
    alert("Uruchom ten skrypt będąc na stronie Serializd!");
    return;
  }

  const ids = new Set();

  // 1. Skanowanie adresów URL w odnośnikach HTML <a>
  document.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || a.href || "";
    if (href.includes("/show/")) {
      const matches = href.match(/\/show\/[^\/]*?(\d{2,7})/gi) || href.match(/(\d{2,7})/g);
      if (matches) {
        matches.forEach((m) => {
          const num = parseInt(m.replace(/\D/g, ""), 10);
          if (num > 10 && num < 2000000) ids.add(num);
        });
      }
    }
  });

  // 2. Bezpieczne przeszukiwanie obiektów JavaScript w pamięci
  function safeScan(obj, depth) {
    if (!obj || depth > 6 || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < Math.min(obj.length, 200); i++) {
        safeScan(obj[i], depth + 1);
      }
      return;
    }

    for (const k in obj) {
      if (k === "return" || k === "child" || k === "sibling" || k === "alternate") continue;

      try {
        const val = obj[k];
        if ((k === "id" || k === "showId" || k === "tmdbId") && typeof val === "number" && val > 10 && val < 2000000) {
          ids.add(val);
        } else if ((k === "id" || k === "showId" || k === "tmdbId") && typeof val === "string" && /^\d+$/.test(val)) {
          ids.add(parseInt(val, 10));
        } else if (typeof val === "object" && val !== null) {
          safeScan(val, depth + 1);
        }
      } catch (e) {}
    }
  }

  // 3. Skanowanie pamięci React Props oraz __NEXT_DATA__
  document.querySelectorAll("*").forEach((el) => {
    for (const key in el) {
      if (key.startsWith("__reactProps") || key.startsWith("__reactEventHandlers")) {
        safeScan(el[key], 0);
      }
    }
  });

  if (window.__NEXT_DATA__) {
    safeScan(window.__NEXT_DATA__, 0);
    const jsonStr = JSON.stringify(window.__NEXT_DATA__);
    const matches = jsonStr.matchAll(/"(?:id|showId|tmdbId)":\s*(\d+)/g);
    for (const m of matches) {
      const num = parseInt(m[1], 10);
      if (num > 10 && num < 2000000) ids.add(num);
    }
  }

  // 4. Przekazanie zgromadzonych ID do aplikacji Chrono-Feed
  const showIds = Array.from(ids);
  if (showIds.length === 0) {
    alert("Nie znaleziono identyfikatorów seriali na tej stronie!");
    return;
  }

  window.location.href = `${TARGET_URL}?shows=${showIds.join(",")}`;
})();