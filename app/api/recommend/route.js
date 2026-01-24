const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY || "2e033ec7";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "about",
  "like",
  "want",
  "watch",
  "movie",
  "something",
  "feel",
  "looking",
  "into",
  "from",
  "have",
  "would",
  "really",
  "kind"
]);

const GENRES = [
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "history",
  "horror",
  "music",
  "mystery",
  "romance",
  "sci-fi",
  "science fiction",
  "thriller",
  "war",
  "western"
];

const MOODS = [
  "dark",
  "funny",
  "emotional",
  "inspiring",
  "mind-bending",
  "romantic",
  "suspenseful",
  "hopeful",
  "gritty",
  "heartwarming",
  "uplifting",
  "tense"
];

const FALLBACK_LIBRARY = {
  "sci-fi": ["Interstellar", "Arrival", "Blade Runner 2049", "Ex Machina"],
  emotional: [
    "Eternal Sunshine of the Spotless Mind",
    "Interstellar",
    "Her"
  ],
  funny: ["Game Night", "Palm Springs", "The Nice Guys", "Booksmart"],
  comedy: ["Game Night", "The Nice Guys", "Spy", "The Grand Budapest Hotel"],
  uplift: ["The Secret Life of Walter Mitty", "Chef", "Paddington 2"],
  lift: ["The Secret Life of Walter Mitty", "Chef", "Paddington 2"],
  uplifting: ["The Secret Life of Walter Mitty", "Chef", "Paddington 2"],
  "feel-good": ["Chef", "Paddington 2", "The Secret Life of Walter Mitty"],
  feelgood: ["Chef", "Paddington 2", "The Secret Life of Walter Mitty"],
  happy: ["The Secret Life of Walter Mitty", "About Time", "Sing Street"],
  sad: ["Eternal Sunshine of the Spotless Mind", "Her", "The Fault in Our Stars"],
  romance: ["About Time", "The Notebook", "La La Land"],
  teen: ["The Fault in Our Stars", "To All the Boys I've Loved Before", "Love, Simon"],
  light: ["Chef", "Julie & Julia", "The Grand Budapest Hotel"],
  friendship: ["Paddington 2", "The Intouchables", "Toy Story"],
  cozy: ["Paddington 2", "Chef", "Julie & Julia"],
  dark: ["Gone Girl", "Prisoners", "Zodiac"],
  suspenseful: ["Shutter Island", "Se7en", "The Prestige"],
  twist: ["The Prestige", "The Sixth Sense", "Fight Club"],
  inspiring: ["The Pursuit of Happyness", "Hidden Figures", "The Blind Side"],
  hopeful: ["The Pursuit of Happyness", "The Martian", "The Blind Side"],
  "true story": ["The Imitation Game", "Spotlight", "A Beautiful Mind"]
};

const normalize = (value) => value.toLowerCase();

const extractKeywordsFallback = (prompt) => {
  const lower = normalize(prompt);
  const genre =
    GENRES.find((item) => lower.includes(item)) ||
    GENRES.find((item) => lower.includes(item.replace("-", " ")));
  const mood =
    MOODS.find((item) => lower.includes(item)) ||
    MOODS.find((item) => lower.includes(item.replace("-", " ")));

  const themes = lower
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOPWORDS.has(word))
    .slice(0, 4);

  return {
    genre,
    mood,
    themes,
    keywords: [genre, mood, ...themes].filter(Boolean)
  };
};

const extractSearchTerms = (prompt) => {
  return normalize(prompt)
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    .slice(0, 4);
};

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const callOpenAI = async (prompt) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Suggest ONE movie title based on the prompt and extract keywords. Respond ONLY with valid JSON matching: {\"title\":\"\", \"year\":\"\", \"genre\":\"\", \"mood\":\"\", \"themes\":[\"\"], \"keywords\":[\"\"]}."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error("OpenAI request failed");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned no content");
  }
  const parsed = parseJson(content);
  if (!parsed) {
    throw new Error("OpenAI returned invalid JSON");
  }
  return parsed;
};

const buildQuery = (analysis, prompt, year) => {
  const keywords = analysis?.keywords?.length ? analysis.keywords : [];
  if (keywords.length) {
    return keywords.slice(0, 5).join(" ");
  }
  const terms = extractSearchTerms(prompt);
  const trimmed = terms.length ? terms.join(" ") : prompt.trim().slice(0, 60);
  return year ? `${trimmed} ${year}` : trimmed;
};

const uniqueList = (items) => [...new Set(items.filter(Boolean))];

const pickFallbackTitles = (prompt, analysis) => {
  const tags = uniqueList([
    analysis?.genre,
    analysis?.mood,
    ...(analysis?.themes || []),
    ...normalize(prompt).split(/\s+/)
  ]);

  const candidates = [];
  tags.forEach((tag) => {
    const normalized = normalize(tag);
    if (FALLBACK_LIBRARY[normalized]) {
      candidates.push(...FALLBACK_LIBRARY[normalized]);
    }
    if (normalized.includes("feel") && normalized.includes("good")) {
      candidates.push(...FALLBACK_LIBRARY["feel-good"]);
    }
    if (normalized.startsWith("uplift") || normalized.startsWith("lift")) {
      candidates.push(...FALLBACK_LIBRARY.uplifting);
    }
    if (normalized.includes("funny") || normalized.includes("comedy")) {
      candidates.push(...FALLBACK_LIBRARY.comedy);
    }
    if (normalized.includes("happy")) {
      candidates.push(...FALLBACK_LIBRARY.happy);
    }
    if (normalized.includes("sad")) {
      candidates.push(...FALLBACK_LIBRARY.sad);
    }
    if (normalized.includes("teen")) {
      candidates.push(...FALLBACK_LIBRARY.teen);
    }
    if (normalized.includes("romance") || normalized.includes("love")) {
      candidates.push(...FALLBACK_LIBRARY.romance);
    }
    if (normalized === "sci-fi" || normalized === "science fiction") {
      candidates.push(...FALLBACK_LIBRARY["sci-fi"]);
    }
    if (normalized.includes("friend")) {
      candidates.push(...FALLBACK_LIBRARY.friendship);
    }
    if (normalized.includes("twist")) {
      candidates.push(...FALLBACK_LIBRARY.twist);
    }
  });

  return uniqueList(candidates).slice(0, 6);
};

const searchOmdb = async (query, excludeIds, year) => {
  const searchUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(
    query
  )}&type=movie${year ? `&y=${encodeURIComponent(year)}` : ""}`;
  const response = await fetch(searchUrl);
  const data = await response.json();
  if (data.Response === "False") {
    return null;
  }
  const results = (data.Search || []).filter(
    (item) => !excludeIds.includes(item.imdbID)
  );
  return results[0] || null;
};

const fetchByTitle = async (title, year) => {
  const titleUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(
    title
  )}${year ? `&y=${encodeURIComponent(year)}` : ""}&plot=short`;
  const response = await fetch(titleUrl);
  return response.json();
};

const fetchMovieDetails = async (imdbID) => {
  const detailsUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbID}&plot=short`;
  const response = await fetch(detailsUrl);
  return response.json();
};

export async function POST(request) {
  if (!OMDB_API_KEY) {
    return Response.json(
      { message: "Missing OMDb API key. Set OMDB_API_KEY." },
      { status: 500 }
    );
  }

  const { prompt, year, excludeIds = [] } = await request.json();
  if (!prompt || !prompt.trim()) {
    return Response.json(
      { message: "Please provide a short movie description." },
      { status: 400 }
    );
  }

  let analysis = null;
  try {
    if (OPENAI_API_KEY) {
      analysis = await callOpenAI(prompt);
    } else {
      analysis = extractKeywordsFallback(prompt);
    }
  } catch (error) {
    analysis = extractKeywordsFallback(prompt);
  }

  let movie = null;
  let yearRelaxed = false;
  if (analysis?.title) {
    const preferredYear = year || analysis.year;
    const titleResult = await fetchByTitle(analysis.title, preferredYear);
    if (titleResult?.Response !== "False") {
      if (!excludeIds.includes(titleResult.imdbID)) {
        movie = titleResult;
      }
    }
    if (!movie && preferredYear) {
      const retryTitle = await fetchByTitle(analysis.title);
      if (retryTitle?.Response !== "False") {
        if (!excludeIds.includes(retryTitle.imdbID)) {
          movie = retryTitle;
          yearRelaxed = true;
        }
      }
    }
  }

  if (!movie) {
    const fallbackTitles = pickFallbackTitles(prompt, analysis);
    for (const title of fallbackTitles) {
      const titleResult = await fetchByTitle(title, year);
      if (titleResult?.Response !== "False") {
        if (!excludeIds.includes(titleResult.imdbID)) {
          movie = titleResult;
          break;
        }
      }
    }
    if (!movie && year) {
      for (const title of fallbackTitles) {
        const titleResult = await fetchByTitle(title);
        if (titleResult?.Response !== "False") {
          if (!excludeIds.includes(titleResult.imdbID)) {
            movie = titleResult;
            yearRelaxed = true;
            break;
          }
        }
      }
    }
  }

  if (!movie) {
    const query = buildQuery(analysis, prompt, year);
    let match = await searchOmdb(query, excludeIds, year);
    if (!match && query !== prompt) {
      match = await searchOmdb(prompt, excludeIds, year);
    }
    if (!match && year) {
      match = await searchOmdb(query, excludeIds);
      if (!match && query !== prompt) {
        match = await searchOmdb(prompt, excludeIds);
      }
      if (match) {
        yearRelaxed = true;
      }
    }
    if (match) {
      movie = await fetchMovieDetails(match.imdbID);
    }
  }

  if (!movie) {
    return Response.json(
      { message: "No matching movie found. Try a new prompt." },
      { status: 404 }
    );
  }

  return Response.json({
    movie,
    meta: {
      yearRelaxed
    },
    analysis: {
      title: analysis?.title || null,
      year: analysis?.year || null,
      genre: analysis?.genre || null,
      mood: analysis?.mood || null,
      themes: analysis?.themes || [],
      keywords: analysis?.keywords || []
    }
  });
}
