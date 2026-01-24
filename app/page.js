"use client";

import { useEffect, useMemo, useState } from "react";

const suggestions = [
  "I want a mind-bending sci-fi that feels emotional.",
  "Give me a cozy feel-good movie about friendship.",
  "Something dark and suspenseful with twists.",
  "An inspiring true story that feels hopeful."
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [year, setYear] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [movie, setMovie] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I’m here to listen. How are you feeling today, and what kind of movie vibe do you want?"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatConnected, setChatConnected] = useState(false);
  const [chatEngine, setChatEngine] = useState("gemini");
  const [backgroundPosters, setBackgroundPosters] = useState([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initial = stored || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", initial === "dark");
    setTheme(initial);
  }, []);

  useEffect(() => {
    const fetchPosters = async () => {
      try {
        const response = await fetch("/api/posters");
        const payload = await response.json();
        if (response.ok && payload?.posters?.length) {
          setBackgroundPosters(payload.posters);
        }
      } catch (error) {
        // Ignore background errors
      }
    };
    fetchPosters();
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("theme", next);
  };

  const keywordChips = useMemo(() => {
    if (!analysis) return [];
    return [
      analysis.genre,
      analysis.mood,
      ...(analysis.themes || [])
    ].filter(Boolean);
  }, [analysis]);

  const posterUrls = useMemo(() => {
    const posters = [
      ...backgroundPosters,
      ...[movie, ...history].map((item) => item?.Poster)
    ].filter((poster) => poster && poster !== "N/A");
    const uniquePosters = [...new Set(posters)];
    if (uniquePosters.length < 4) return [];
    const repeated = [...uniquePosters, ...uniquePosters, ...uniquePosters];
    return repeated.slice(0, 18);
  }, [movie, history, backgroundPosters]);

  const fetchRecommendation = async (promptText, yearOverride = year) => {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        year: yearOverride || null,
        excludeIds: history.map((item) => item.imdbID)
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "We could not find a match.");
    }
    return payload;
  };

  const applyRecommendation = (payload, promptText) => {
    setMovie(payload.movie);
    setAnalysis(payload.analysis);
    setHistory((prev) => [payload.movie, ...prev].slice(0, 5));
    setLastPrompt(promptText);
  };

  const requestRecommendation = async (promptText) => {
    if (!promptText) {
      setError("Please describe the kind of movie you want.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await fetchRecommendation(promptText);
      applyRecommendation(payload, promptText);
    } catch (err) {
      setError(err.message || "Unable to reach the recommendation service.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    requestRecommendation(prompt.trim());
  };

  const handleRetry = () => {
    requestRecommendation(lastPrompt);
  };

  const extractYearFromText = (text) => {
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  };

  const sendChatMessage = async (message) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const detectedYear = extractYearFromText(trimmed);
    if (detectedYear) {
      setYear(detectedYear);
    }

    const nextMessages = [...chatMessages, { role: "user", content: trimmed }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-8)
        })
      });

      const payloadText = await response.text();
      const payload = payloadText ? JSON.parse(payloadText) : null;
      if (!response.ok) {
        const detail = payload?.details ? ` (${payload.details})` : "";
        setChatError(
          `${payload?.message || "Gemini is unavailable right now."}${detail}`
        );
        setChatConnected(false);
        setChatLoading(false);
        return;
      }

      setChatConnected(true);
      setChatEngine(payload?.engine || "gemini");
      if (payload?.reply) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: payload.reply }
        ]);
      }

      if (payload?.year) {
        setYear(payload.year);
      }

      if (payload?.action === "recommend" && payload.prompt) {
        try {
          const recommendation = await fetchRecommendation(
            payload.prompt,
            payload.year || detectedYear || year
          );
          applyRecommendation(recommendation, payload.prompt);
          const relaxedYearNote =
            recommendation.meta?.yearRelaxed && (payload.year || detectedYear || year)
              ? " I couldn’t find an exact match for that year, so I picked the closest fit."
              : "";
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Based on that, I recommend “${recommendation.movie.Title}” (${recommendation.movie.Year}).${relaxedYearNote} Want another suggestion?`
            }
          ]);
        } catch (error) {
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "I couldn’t find a great match just now. Want to try a different mood or add a year?"
            }
          ]);
        }
      }
    } catch (err) {
      setChatError("Unable to reach the chat service.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-black dark:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(229,9,20,0.12),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(229,9,20,0.25),_transparent_55%)]" />
      {posterUrls.length > 0 && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="poster-row top-8">
            <div className="poster-track">
              {posterUrls.map((url, index) => (
                <img
                  key={`row-one-${url}-${index}`}
                  src={url}
                  alt=""
                  className="poster-image"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
          <div className="poster-row top-1/3">
            <div className="poster-track reverse">
              {posterUrls.map((url, index) => (
                <img
                  key={`row-two-${url}-${index}`}
                  src={url}
                  alt=""
                  className="poster-image"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
          <div className="poster-row bottom-6">
            <div className="poster-track">
              {posterUrls.map((url, index) => (
                <img
                  key={`row-three-${url}-${index}`}
                  src={url}
                  alt=""
                  className="poster-image"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="relative z-10 mx-auto flex min-h-screen w-[min(1280px,94%)] flex-col gap-10 py-10 md:gap-14 md:py-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-red-600 dark:text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            AI-powered movie finder
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-500 hover:text-slate-900 dark:border-white/20 dark:text-white/80 dark:hover:border-red-500 dark:hover:text-white"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white md:text-5xl">
              CineSense
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-white/70 md:text-lg">
              Describe your mood, vibe, or storyline. The AI extracts keywords
              and fetches a matching movie from the OMDb database.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {["AI keyword analysis", "OMDb movie data", "Smart fallback picks"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/20 dark:text-white/70"
                  >
                    {item}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500 dark:text-red-400">
              How it works
            </p>
            <ol className="mt-5 space-y-4 text-sm text-slate-600 dark:text-white/70">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-bold dark:border-white/20">
                  1
                </span>
                Describe what you want to watch in natural language.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-bold dark:border-white/20">
                  2
                </span>
                AI extracts genre, mood, and themes from your prompt.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-bold dark:border-white/20">
                  3
                </span>
                OMDb returns a movie match and full details.
              </li>
            </ol>
          </div>
        </section>

        <section className="glass rounded-3xl p-8 shadow-2xl shadow-red-500/10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="text-sm font-semibold text-slate-600 dark:text-white/70">
              What do you feel like watching?
            </label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              placeholder="I feel like watching something mind-bending and emotional..."
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-red-500/30 transition focus:ring-2 dark:border-white/15 dark:bg-black/60 dark:text-white"
            />
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-600 dark:text-white/70">
                  Release year
                </label>
                <span className="text-xs text-slate-500 dark:text-white/50">
                  Optional
                </span>
              </div>
              <div className="relative">
                <select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-base text-slate-900 outline-none ring-red-500/30 transition focus:ring-2 dark:border-white/15 dark:bg-black/60 dark:text-white"
                >
                  <option value="">Any year</option>
                  {Array.from({ length: 45 }, (_, index) => {
                    const value = `${new Date().getFullYear() - index}`;
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-white/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Recommend a Movie
              </button>
              <button
                type="button"
                onClick={handleRetry}
                disabled={!lastPrompt || loading}
                className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-red-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:text-white/80 dark:hover:border-red-500 dark:hover:text-white"
              >
                Try Another Movie
              </button>
              {loading && <div className="spinner" aria-label="Loading" />}
            </div>
            {error && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-300">
                {error}
              </p>
            )}
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/40">
              Try a prompt
            </span>
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPrompt(item);
                  requestRecommendation(item);
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:border-red-500 hover:text-slate-900 dark:border-white/20 dark:text-white/70 dark:hover:border-red-500 dark:hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="glass rounded-3xl p-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Recommended Movie
            </h2>
            {!movie && (
              <p className="mt-4 text-sm text-slate-600 dark:text-white/70">
                Submit a prompt to receive a personalized movie recommendation.
              </p>
            )}
            {movie && (
              <div className="mt-6 grid gap-6 md:grid-cols-[0.45fr_0.55fr]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black/60">
                  <img
                    src={
                      movie.Poster && movie.Poster !== "N/A"
                        ? movie.Poster
                        : "/poster-placeholder.svg"
                    }
                    alt={`${movie.Title} poster`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-sm uppercase tracking-[0.2em] text-red-500 dark:text-red-400">
                    {movie.Genre}
                  </p>
                  <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {movie.Title}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-white/70">
                    <span className="rounded-full border border-slate-300 px-3 py-1 dark:border-white/20">
                      {movie.Year}
                    </span>
                    <span className="rounded-full border border-slate-300 px-3 py-1 dark:border-white/20">
                      ⭐ {movie.imdbRating}
                    </span>
                    <span className="rounded-full border border-slate-300 px-3 py-1 dark:border-white/20">
                      {movie.Runtime}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-white/75">
                    {movie.Plot}
                  </p>
                  {keywordChips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {keywordChips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-300"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="glass rounded-3xl p-6 lg:sticky lg:top-6">
            <div className="space-y-5">
              <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 shadow-lg shadow-red-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Mood Chat
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 dark:text-white/70">
                      Talk to the AI about how you feel.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                      Live
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                        chatConnected
                          ? "bg-emerald-500 text-white"
                          : "bg-white/60 text-slate-700 dark:bg-white/10 dark:text-white/70"
                      }`}
                    >
                      {chatConnected
                        ? chatEngine === "local"
                          ? "Local"
                          : "Gemini"
                        : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm shadow-inner shadow-red-500/10 dark:border-white/10 dark:bg-black/60">
                {chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role === "user"
                        ? "ml-auto w-fit max-w-[85%] rounded-2xl bg-red-600 px-3 py-2 text-white"
                        : "mr-auto w-fit max-w-[85%] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 dark:border-white/10 dark:bg-black/60 dark:text-white/80"
                    }
                  >
                    {message.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="mr-auto w-fit rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-500 dark:border-white/10 dark:bg-black/60 dark:text-white/60">
                    Typing...
                  </div>
                )}
              </div>
              {chatError && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-300">
                  {chatError}
                </p>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendChatMessage(chatInput);
                }}
              >
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type how you feel..."
                  className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none ring-red-500/30 transition focus:ring-2 dark:border-white/15 dark:bg-black/60 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </div>

            <div className="mt-8">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Previous Picks
              </h2>
              {history.length === 0 && (
                <p className="mt-4 text-sm text-slate-600 dark:text-white/70">
                  Your recommendations will appear here.
                </p>
              )}
              <ul className="mt-4 flex flex-col gap-4">
                {history.map((item) => (
                  <li
                    key={item.imdbID}
                    className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm dark:border-white/10 dark:bg-black/60"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {item.Title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-white/50">
                      {item.Year} · ⭐ {item.imdbRating}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
