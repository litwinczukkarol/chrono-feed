import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const DEFAULT_SHOW_IDS = [
  138502, // X-Men '97
  103516, // Star Trek: Strange New Worlds
  292108, // Ann Droid
  94997,  // House of the Dragon
  125909, // Batman: Caped Crusader
  615,    // Futurama
  236450, // 1670
  95350,  // Lanterns
];

function processChronoFeed(shows) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const categories = {
    today: [],
    overdue: [],
    thisWeek: [],
    upcoming: [],
    pastOrPending: [],
  };

  shows.forEach((show) => {
    let diffDaysNext = null;
    let diffDaysLast = null;

    if (show.nextEpisode && show.nextEpisode.airDate) {
      const nextDate = new Date(show.nextEpisode.airDate);
      nextDate.setHours(0, 0, 0, 0);
      diffDaysNext = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));
    }

    if (show.lastEpisode && show.lastEpisode.airDate) {
      const lastDate = new Date(show.lastEpisode.airDate);
      lastDate.setHours(0, 0, 0, 0);
      diffDaysLast = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
    }

    const enrichedShow = { 
      ...show, 
      daysUntilNext: diffDaysNext,
      daysSinceLast: diffDaysLast 
    };

    if (diffDaysNext === 0 || diffDaysLast === 0) {
      categories.today.push(enrichedShow);
    } else if (diffDaysLast !== null && diffDaysLast >= 1 && diffDaysLast <= 7) {
      categories.overdue.push(enrichedShow);
    } else if (diffDaysNext !== null && diffDaysNext > 0 && diffDaysNext <= 7) {
      categories.thisWeek.push(enrichedShow);
    } else if (diffDaysNext !== null && diffDaysNext > 7) {
      categories.upcoming.push(enrichedShow);
    } else {
      categories.pastOrPending.push(enrichedShow);
    }
  });

  const sortByNextDate = (a, b) => 
    new Date(a.nextEpisode.airDate) - new Date(b.nextEpisode.airDate);

  categories.today.sort(sortByNextDate);
  categories.overdue.sort((a, b) => a.daysSinceLast - b.daysSinceLast);
  categories.thisWeek.sort(sortByNextDate);
  categories.upcoming.sort(sortByNextDate);

  categories.pastOrPending.sort((a, b) => {
    const dateA = a.lastEpisode?.airDate ? new Date(a.lastEpisode.airDate) : new Date(0);
    const dateB = b.lastEpisode?.airDate ? new Date(b.lastEpisode.airDate) : new Date(0);
    return dateB - dateA;
  });

  return categories;
}

export async function GET(request) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Brak klucza TMDB_API_KEY w pliku .env.local' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  // Pobieramy parametr 'shows' lub ewentualnie 'ids'
  const rawParam = searchParams.get('shows') || searchParams.get('ids');

  let showIds = [];
  let isFallback = false;
  let fallbackReason = null;

  if (rawParam && rawParam.trim().length > 0) {
    try {
      // 1. Próba sparsowania jako tablica JSON (np. ["94997", "138502"])
      const parsed = JSON.parse(rawParam);
      if (Array.isArray(parsed)) {
        showIds = parsed
          .map((id) => parseInt(String(id).replace(/\D/g, ''), 10))
          .filter((id) => !isNaN(id) && id > 0);
      }
    } catch (e) {
      // 2. Jeśli to nie JSON, dzielimy po przecinkach i czyścimy ze śmieciowych znaków
      showIds = rawParam
        .split(',')
        .map((id) => parseInt(id.replace(/[\[\]"'\s]/g, ''), 10))
        .filter((id) => !isNaN(id) && id > 0);
    }
  }

  // Jeśli brak poprawnych ID – przełączamy na listę domyślną (Fallback)
  if (showIds.length === 0) {
    showIds = DEFAULT_SHOW_IDS;
    isFallback = true;
    fallbackReason = 'Brak danych z zakładki (użyto listy domyślnej)';
  }

  try {
    const limitedIds = showIds.slice(0, 25);

    const showPromises = limitedIds.map(async (id) => {
      const res = await fetch(
        `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=pl-PL`,
        { next: { revalidate: 3600 } }
      );

      if (!res.ok) return null;
      const data = await res.json();

      return {
        id: data.id,
        title: data.name,
        originalTitle: data.original_name,
        posterPath: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
        backdropPath: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
        status: data.status,
        numberOfSeasons: data.number_of_seasons,
        lastEpisode: data.last_episode_to_air ? {
          season: data.last_episode_to_air.season_number,
          episode: data.last_episode_to_air.episode_number,
          name: data.last_episode_to_air.name,
          airDate: data.last_episode_to_air.air_date,
          overview: data.last_episode_to_air.overview,
        } : null,
        nextEpisode: data.next_episode_to_air ? {
          season: data.next_episode_to_air.season_number,
          episode: data.next_episode_to_air.episode_number,
          name: data.next_episode_to_air.name,
          airDate: data.next_episode_to_air.air_date,
          overview: data.next_episode_to_air.overview,
        } : null,
      };
    });

    const rawShows = (await Promise.all(showPromises)).filter(Boolean);
    const feed = processChronoFeed(rawShows);

    return NextResponse.json({
      success: true,
      isFallback,
      fallbackReason,
      totalCount: rawShows.length,
      feed,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}