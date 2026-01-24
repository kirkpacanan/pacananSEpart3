const OMDB_API_KEY = process.env.OMDB_API_KEY || "2e033ec7";

const SEED_TITLES = [
  "Inception",
  "Interstellar",
  "The Dark Knight",
  "La La Land",
  "Parasite",
  "Avatar",
  "The Social Network",
  "The Grand Budapest Hotel",
  "Coco",
  "Everything Everywhere All at Once"
];

const fetchPoster = async (title) => {
  const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(
    title
  )}`;
  const response = await fetch(url);
  const data = await response.json();
  return data?.Poster && data?.Poster !== "N/A" ? data.Poster : null;
};

export async function GET() {
  if (!OMDB_API_KEY) {
    return Response.json({ posters: [] }, { status: 200 });
  }

  const posters = [];
  for (const title of SEED_TITLES) {
    try {
      const poster = await fetchPoster(title);
      if (poster) posters.push(poster);
    } catch (error) {
      // ignore failures
    }
  }

  return Response.json({ posters });
}
