/**
 * Serializd Chrono-Feed Bookmarklet (v0.2.1 - Session Accumulator)
 * Zbiera pozycje z kolejnych podstron do sessionStorage i wysyła zbiorczo do Chrono-Feed.
 */
(function () {
  const TARGET_URL = "https://chrono-feed-app.vercel.app/";

  if (!window.location.hostname.includes("serializd.com")) {
    alert("Uruchom ten skrypt będąc na stronie Serializd!");
    return;
  }

  // 1. Pobranie dotychczas zapisanych ID z pamięci sesji
  const STORAGE_KEY = "chrono_feed_collected_ids";
  let stored = [];
  try {
    stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    stored = [];
  }
  const ids = new Set(stored);

  // 2. Skanowanie bieżącej podstrony
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

  // 3. Zapisanie zaktualizowanej listy w sessionStorage
  const updatedList = Array.from(ids);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

  // 4. Stworzenie / Aktualizacja interfejsu powiadomienia
  let statusDiv = document.getElementById("chrono-feed-widget");
  if (!statusDiv) {
    statusDiv = document.createElement("div");
    statusDiv.id = "chrono-feed-widget";
    statusDiv.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      background: #0f172a; color: #f8fafc; border: 2px solid #3b82f6;
      padding: 14px 18px; border-radius: 14px; font-family: system-ui, sans-serif;
      font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      display: flex; flex-direction: column; gap: 10px; min-width: 260px;
    `;
    document.body.appendChild(statusDiv);
  }

  statusDiv.innerHTML = `
    <div style="display:flex; justify-between; align-items:center;">
      <span style="color:#38bdf8;">📦 Chrono-Feed Akumulator</span>
      <span style="background:#1e293b; padding:2px 8px; border-radius:6px; font-size:11px; color:#94a3b8;">
        Razem: ${updatedList.length}
      </span>
    </div>
    <div style="font-size:11px; color:#cbd5e1; font-weight:normal;">
      Zapisano nową podstronę. Przejdź do kolejnej i kliknij zakłądkę ponownie lub wyślij całość.
    </div>
    <div style="display:flex; gap:8px; margin-top:4px;">
      <button id="chrono-send-btn" style="flex:1; background:#2563eb; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer;">
        🚀 Wyślij (${updatedList.length})
      </button>
      <button id="chrono-reset-btn" style="background:#334155; color:#94a3b8; border:none; padding:8px; border-radius:8px; cursor:pointer;">
        🧹 Reset
      </button>
    </div>
  `;

  document.getElementById("chrono-send-btn").onclick = function () {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = `${TARGET_URL}?shows=${updatedList.join(",")}`;
  };

  document.getElementById("chrono-reset-btn").onclick = function () {
    sessionStorage.removeItem(STORAGE_KEY);
    statusDiv.remove();
  };
})();