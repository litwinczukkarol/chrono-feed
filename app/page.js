'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Kod Bookmarkletu z obsługą akumulacji stron (sessionStorage)
const BOOKMARKLET_CODE = `javascript:(function(){const s=Array.from(document.querySelectorAll('a[href*="/show/"]')).map(a=>{const m=a.href.match(/\\/show\\/(\\d+)/);return m?m[1]:null}).filter(Boolean);const u=[...new Set(s)];if(!u.length){alert('Nie znaleziono seriali na tej stronie! Upewnij się, że jesteś na Serializd.');return;}let acc=[];try{acc=JSON.parse(sessionStorage.getItem('chrono_feed_shows')||'[]')}catch(e){}const c=[...new Set([...acc,...u])];sessionStorage.setItem('chrono_feed_shows',JSON.stringify(c));if(confirm('Zebrano '+c.length+' seriali! Przejść do Chrono-Feed?\\n\\n(Kliknij Anuluj, jeśli chcesz przejść na kolejną stronę i zebrać więcej)')){sessionStorage.removeItem('chrono_feed_shows');window.location.href='https://chrono-feed-app.vercel.app/?shows='+c.join(',');}})();`;

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [feed, setFeed] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(process.env.NEXT_PUBLIC_DEFAULT_SERIALIZD_USER || 'WyrdHamster');
  const [inputUser, setInputUser] = useState('WyrdHamster');
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState(null);
  const [rawApiResponse, setRawApiResponse] = useState(null);

  const rawShows = searchParams.get('shows') || searchParams.get('ids');

  useEffect(() => {
    let isMounted = true;

    async function fetchFeed() {
      setLoading(true);
      setError(null);
      try {
        let cleanShows = rawShows;
        if (rawShows) {
          try {
            const parsed = JSON.parse(rawShows);
            if (Array.isArray(parsed)) {
              cleanShows = parsed.join(',');
            }
          } catch (e) {
            cleanShows = rawShows.replace(/[\[\]"'\s]/g, '');
          }
        }

        const query = cleanShows ? `?shows=${encodeURIComponent(cleanShows)}` : '';
        const res = await fetch(`/api/feed${query}`);
        const data = await res.json();

        if (isMounted) {
          setRawApiResponse(data);

          if (data.success) {
            setFeed(data.feed);
            setTotalCount(data.totalCount);
            setIsFallback(data.isFallback);
            setFallbackReason(data.fallbackReason || null);
          } else {
            setError('Nie udało się pobrać danych.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Błąd połączenia z serwerem.');
          setRawApiResponse({ error: err.message });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFeed();

    return () => {
      isMounted = false;
    };
  }, [rawShows]);

  const serializdDirectUrl = `https://www.serializd.com/user/${encodeURIComponent(username)}/currently_watching`;

  const handleUserSubmit = (e) => {
    e.preventDefault();
    if (inputUser.trim()) {
      setUsername(inputUser.trim());
    }
  };

  const resetToFallback = () => {
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <header className="max-w-7xl mx-auto mb-8 border-b border-slate-800 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              Serializd Chrono-Feed
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Chronologiczny chronometraż Twoich seriali
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleUserSubmit} className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
              <span className="text-xs text-slate-400 pl-2 font-medium">Użytkownik:</span>
              <input 
                type="text" 
                value={inputUser} 
                onChange={(e) => setInputUser(e.target.value)}
                placeholder="np. WyrdHamster"
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-2.5 py-1 rounded-lg focus:outline-none focus:border-indigo-500 w-32"
              />
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded-lg font-medium transition-colors"
              >
                Zmień
              </button>
            </form>

            {rawShows && (
              <button
                onClick={resetToFallback}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 px-3 py-2 rounded-xl transition-colors"
              >
                Przywróć domyślne
              </button>
            )}

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-ping' : isFallback ? 'bg-amber-500' : 'bg-emerald-400'}`} />
              <span>
                {loading 
                  ? 'Pobieranie...' 
                  : isFallback 
                    ? `Fallback (${totalCount} seriali)` 
                    : `Załadowano: ${totalCount} seriali`}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto mb-10 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-xl flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 text-xs font-semibold w-fit">
              <span>⚡ Wczytywanie danych na żywo</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              Szybka aktualizacja listy z Serializd
            </h2>
            <div className="text-sm text-slate-300 leading-relaxed space-y-1.5">
              <p>
                1. Przeciągnij ten przycisk na swój pasek zakładek:{' '}
                <a
                  href={BOOKMARKLET_CODE}
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Przeciągnij ten przycisk myszką na swój pasek zakładek w przeglądarce!');
                  }}
                  className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-2.5 py-0.5 rounded-md text-xs shadow cursor-grab active:cursor-grabbing font-mono transition-transform hover:scale-105 border border-amber-300"
                  title="Przeciągnij mnie na pasek zakładek!"
                >
                  📌 Do Chrono-Feed
                </a>
              </p>
              <p>
                2. Kliknij duży przycisk obok, aby przejść do swojego profilu na Serializd.
              </p>
              <p>
                3. Ustaw sortowanie na <strong className="text-indigo-300">Last Aired Date</strong> lub <strong className="text-indigo-300">Premiere Date</strong> i kliknij zapisaną zakładkę!
              </p>
            </div>
          </div>

          <a
            href={serializdDirectUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 w-full flex items-center justify-center gap-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xl lg:text-2xl px-8 py-8 rounded-2xl transition-all shadow-2xl hover:shadow-indigo-500/30 border-2 border-indigo-400/40 text-center leading-tight"
          >
            <span>↗️ Przejdź na profil Serializd ({username})</span>
          </a>
        </div>
      </div>

      {/* 🔍 Rozszerzony Panel Diagnostyczny (Zakomentowany - zachowany do debugowania) */}
      {/* 
      <div className="max-w-7xl mx-auto mb-10 bg-slate-900/90 border border-amber-500/40 p-5 rounded-xl text-xs font-mono space-y-4 shadow-lg">
        <div className="text-amber-400 font-bold text-sm flex items-center justify-between border-b border-slate-800 pb-2">
          <span>🔍 Rozszerzony Panel Diagnostyczny:</span>
          <span className="text-slate-500 text-[10px] font-normal">Wersja testowa</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300 border-b border-slate-800 pb-3">
          <div>
            • Parametr URL (<code className="text-indigo-400">rawShows</code>):<br />
            <span className="text-indigo-300 font-bold break-all">{rawShows || 'BRAK'}</span>
          </div>
          <div>
            • Tryb API (<code className="text-indigo-400">isFallback</code>):<br />
            <span className={isFallback ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {isFallback ? 'TAK (Fallback)' : 'NIE (Na Żywo)'}
            </span>
          </div>
          <div>
            • Powód (<code className="text-indigo-400">fallbackReason</code>):<br />
            <span className="text-red-400 font-bold">{fallbackReason || 'Sukces / Brak'}</span>
          </div>
        </div>

        <div>
          <span className="text-amber-300 font-bold block mb-1">📦 Pełny Payload z API (/api/feed):</span>
          <pre className="bg-slate-950 p-4 rounded-lg text-emerald-400 overflow-x-auto text-[11px] max-h-72 border border-slate-800 font-mono leading-tight">
            {rawApiResponse ? JSON.stringify(rawApiResponse, null, 2) : 'Czekanie na odpowiedź API...'}
          </pre>
        </div>
      </div>
      */}

      {loading && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl h-80 animate-pulse p-4" />
          ))}
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto bg-red-950/40 border border-red-800 text-red-200 p-4 rounded-xl text-center">
          {error}
        </div>
      )}

      {!loading && !error && feed && (
        <div className="max-w-7xl mx-auto">
          <Section title="Premiera Dzisiaj" icon="🔥" shows={feed.today} badgeColor="bg-red-500/10 text-red-400 border-red-500/20" />
          <Section title="Zaległe (Do nadrobienia)" icon="⏳" shows={feed.overdue} badgeColor="bg-amber-500/10 text-amber-400 border-amber-500/20" isOverdue={true} />
          <Section title="W tym tygodniu" icon="⚡" shows={feed.thisWeek} badgeColor="bg-indigo-500/10 text-indigo-400 border-indigo-500/20" />
          <Section title="Nadchodzące" icon="🗓️" shows={feed.upcoming} badgeColor="bg-slate-800 text-slate-300 border-slate-700" />
          <Section title="Oczekujące / Archiwum" icon="📦" shows={feed.pastOrPending} badgeColor="bg-slate-900 text-slate-500 border-slate-800" />
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-400 p-10">Ładowanie...</div>}>
      <FeedContent />
    </Suspense>
  );
}

function Section({ title, icon, shows, badgeColor, isOverdue = false }) {
  if (!shows || shows.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800/60 pb-3">
        <span className="text-xl">{icon}</span>
        <h2 className="text-xl font-bold text-slate-200">{title}</h2>
        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
          {shows.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} isOverdue={isOverdue} />
        ))}
      </div>
    </section>
  );
}

function ShowCard({ show, isOverdue }) {
  return (
    <article 
      className={`bg-slate-900/80 border transition-all duration-300 rounded-2xl overflow-hidden flex flex-col shadow-lg ${
        isOverdue 
          ? 'border-amber-500/40 hover:border-amber-400 hover:shadow-amber-500/10' 
          : 'border-slate-800/80 hover:border-indigo-500/50 hover:shadow-indigo-500/10'
      }`}
    >
      <div className="relative aspect-[16/9] bg-slate-800 overflow-hidden">
        {show.backdropPath || show.posterPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={show.backdropPath || show.posterPath} 
            alt={show.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
            Brak grafiki
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        <span className="absolute bottom-2 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-slate-300 text-[11px] px-2.5 py-0.5 rounded-md font-medium">
          {show.status}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 line-clamp-1" title={show.title}>
            {show.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sezony: <span className="text-slate-400">{show.numberOfSeasons}</span>
          </p>
        </div>

        {isOverdue && show.lastEpisode ? (
          <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase block">
              ⚠️ Ostatnio wyemitowany (Zaległy)
            </span>
            <p className="text-xs font-semibold text-slate-200 line-clamp-1">
              S{show.lastEpisode.season}E{show.lastEpisode.episode} – {show.lastEpisode.name || 'Odcinek'}
            </p>
            <p className="text-[11px] text-amber-300/90 mt-0.5 font-medium">
              🗓️ {show.lastEpisode.airDate} ({show.daysSinceLast === 1 ? 'Wczoraj' : `${show.daysSinceLast} dni temu`})
            </p>
          </div>
        ) : (
          <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-3 space-y-1">
            <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase block">
              Następna premiera
            </span>
            {show.nextEpisode ? (
              <div>
                <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                  S{show.nextEpisode.season}E{show.nextEpisode.episode} – {show.nextEpisode.name || 'Odcinek'}
                </p>
                <p className="text-[11px] text-indigo-300 mt-0.5 font-medium">
                  🗓️ {show.nextEpisode.airDate} {show.daysUntilNext === 0 ? '(Dzisiaj!)' : `(za ${show.daysUntilNext} dni)`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Brak potwierdzonej daty</p>
            )}
          </div>
        )}

        <div className="border-t border-slate-800/80 pt-3">
          {isOverdue ? (
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase block">
                Kolejna premiera
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                {show.nextEpisode ? `S${show.nextEpisode.season}E${show.nextEpisode.episode} • ${show.nextEpisode.airDate}` : 'Brak daty'}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase block">
                Ostatnio wyemitowano
              </span>
              {show.lastEpisode ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  S${show.lastEpisode.season}E${show.lastEpisode.episode} <span className="text-slate-600">•</span> ${show.lastEpisode.airDate}
                </p>
              ) : (
                <p className="text-xs text-slate-600">Brak danych</p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}