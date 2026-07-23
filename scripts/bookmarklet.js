/**
 * Serializd Chrono-Feed Bookmarklet (v0.2 - Autopagination)
 * 
 * Pobiera automatycznie kolejne strony (page=1, page=2...) z Serializd w tle,
 * zbiera wszystkie unikalne ID seriali i przekierowuje do Chrono-Feed.
 */
(async function () {
  const TARGET_URL = "https://chrono-feed-app.vercel.app/";
  const MAX_PAGES = 10; // Bezpiecznik: maksymalnie 10 stron (ok. 270 seriali)
  const DELAY_MS = 250; // Krótkie opóźnienie między zapytaniami (ms)

  if (!window.location.hostname.includes("serializd.com")) {
    alert("Uruchom ten skrypt będąc na stronie Serializd!");
    return;
  }

  // 1. Nakładka wizualna ze statusem dla użytkownika
  const statusDiv = document.createElement("div");
  statusDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 999999;
    background: #0f172a; color: #38bdf8; border: 2px solid #3b82f6;
    padding: 12px 18px; border-radius: 12px; font-family: system-ui, sans-serif;
    font-size: 13px; font-weight: 600; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    transition: all 0.3s ease;
  `;
  statusDiv.innerHTML = "⏳ Chrono-Feed: Skanowanie strony 1...";
  document.body.appendChild(statusDiv);

  const ids = new Set();

  function safeScan(obj, depth) {
    if (!obj || depth > 6 || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < Math.min(obj.length, 200); i++) safeScan(obj[i], depth + 1);
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

  // 2. Skanowanie bieżącego DOM i pamięci Reacta (Strona 1)
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

  document.querySelectorAll("*").forEach((el) => {
    for (const key in el) {
      if (key.startsWith("__reactProps") || key.startsWith("__reactEventHandlers")) {
        safeScan(el[key], 0);
      }
    }
  });

  if (window.__NEXT_DATA__) {
    safeScan(window.__NEXT_DATA__, 0);
  }

  // 3. Pętla pobierająca kolejne strony w tle (Strona 2, 3...)
  const urlObj = new URL(window.location.href);
  urlObj.searchParams.delete("page");
  const baseUrl = urlObj.toString();

  let currentPage = 2;
  let hasMore = true;

  while (hasMore && currentPage <= MAX_PAGES) {
    statusDiv.innerHTML = `⏳ Pobieranie strony ${currentPage}... (znaleziono: ${ids.size} seriali)`;
    
    await new Promise((r) => setTimeout(r, DELAY_MS));

    try {
      const fetchUrl = baseUrl + (baseUrl.includes("?") ? "&" : "?") + `page=${currentPage}`;
      const res = await fetch(fetchUrl);

      if (!res.ok) {
        hasMore = false;
        break;
      }

      const htmlText = await res.text();
      const initialSize = ids.size;

      // Wyciąganie __NEXT_DATA__ z pobranego kodu HTML podstrony
      const nextDataMatch = htmlText.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (nextDataMatch && nextDataMatch[1]) {
        try {
          const parsed = JSON.parse(nextDataMatch[1]);
          safeScan(parsed, 0);
        } catch (e) {}
      }

      // Skanowanie po kluczach ID w surowym tekście HTML
      const matches = htmlText.matchAll(/"(?:id|showId|tmdbId)":\s*(\d+)/g);
      for (const m of matches) {
        const num = parseInt(m[1], 10);
        if (num > 10 && num < 2000000) ids.add(num);
      }

      const showMatches = htmlText.matchAll(/\/show\/[^\/]*?(\d{2,7})/gi);
      for (const m of showMatches) {
        const num = parseInt(m[0].replace(/\D/g, ""), 10);
        if (num > 10 && num < 2000000) ids.add(num);
      }

      // Jeśli na nowej stronie nie przybył żaden nowy ID, dotarliśmy do końca listy
      if (ids.size === initialSize) {
        hasMore = false;
      } else {
        currentPage++;
      }
    } catch (err) {
      console.error("Błąd pobierania strony " + currentPage, err);
      hasMore = false;
    }
  }

  // 4. Podsumowanie i przekierowanie
  const showIds = Array.from(ids);
  if (showIds.length === 0) {
    statusDiv.style.borderColor = "#ef4444";
    statusDiv.style.color = "#f87171";
    statusDiv.innerHTML = "❌ Nie znaleziono seriali!";
    setTimeout(() => statusDiv.remove(), 3000);
    return;
  }

  statusDiv.style.borderColor = "#10b981";
  statusDiv.style.color = "#34d399";
  statusDiv.innerHTML = `✅ Sukces! Znaleziono ${showIds.length} seriali z ${currentPage - 1} stron. Przekierowuję...`;

  setTimeout(() => {
    window.location.href = `${TARGET_URL}?shows=${showIds.join(",")}`;
  }, 600);
})();