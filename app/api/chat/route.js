const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "AIzaSyAnLUW8lvouNdtlPrU80p5bmdnwe9UZdLg";

const MOOD_KEYWORDS = {
  sad: [
    "sad",
    "down",
    "lonely",
    "heartbroken",
    "grief",
    "cry",
    "not good",
    "not ok",
    "bad",
    "not so great",
    "broke up",
    "break up",
    "heartbreak"
  ],
  anxious: ["anxious", "nervous", "worried", "stress", "overwhelmed"],
  angry: ["angry", "mad", "frustrated", "irritated"],
  tired: ["tired", "exhausted", "drained", "burnt"],
  happy: ["happy", "excited", "joy", "good", "great"]
};

const PREFER_MATCH = [
  "match",
  "same",
  "similar",
  "current",
  "mirror",
  "stay",
  "keep",
  "as is",
  "match my mood",
  "based on how i feel"
];
const PREFER_UPLIFT = [
  "uplift",
  "lift",
  "cheer",
  "cheer me up",
  "improve",
  "better",
  "light",
  "fun",
  "make me feel better",
  "pick me up",
  "brighten",
  "uplifting"
];
const GREETINGS = ["hi", "hello", "hey", "good morning", "good afternoon"];
const SMALL_TALK = [
  "your name",
  "who are you",
  "what are you",
  "what's your name",
  "whats your name",
  "talk to me",
  "chat"
];
const ANOTHER_REQUESTS = [
  "another",
  "one more",
  "again",
  "new one",
  "different",
  "another one"
];
const INTRO_PATTERNS = [
  "i'm ",
  "im ",
  "i am ",
  "my name is "
];

const MOOD_PROMPTS = {
  sad: {
    match: "an emotional drama about sadness and healing",
    uplift: "an uplifting, feel-good movie about hope and friendship"
  },
  anxious: {
    match: "a tense drama about overcoming anxiety",
    uplift: "a calming, lighthearted movie with warm humor"
  },
  angry: {
    match: "a gritty drama that channels anger into resilience",
    uplift: "a fun, uplifting comedy with positive energy"
  },
  tired: {
    match: "a quiet, reflective drama with a gentle pace",
    uplift: "a cozy, comforting movie that's easy to watch"
  },
  happy: {
    match: "an energetic, upbeat movie with joyful vibes",
    uplift: "a feel-good adventure that keeps the good mood going"
  },
  neutral: {
    match: "an emotional drama with heartfelt storytelling",
    uplift: "a light, funny, and uplifting movie"
  }
};

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
};

const detectMood = (text) => {
  const lower = text.toLowerCase();
  for (const [mood, words] of Object.entries(MOOD_KEYWORDS)) {
    if (words.some((word) => lower.includes(word))) {
      return mood;
    }
  }
  return null;
};

const detectPreference = (text) => {
  const lower = text.toLowerCase();
  if (PREFER_MATCH.some((word) => lower.includes(word))) return "match";
  if (PREFER_UPLIFT.some((word) => lower.includes(word))) return "uplift";
  return null;
};

const detectGreeting = (text) => {
  const lower = text.toLowerCase();
  return GREETINGS.some((word) => lower.includes(word));
};

const detectSmallTalk = (text) => {
  const lower = text.toLowerCase();
  return SMALL_TALK.some((phrase) => lower.includes(phrase));
};

const detectAnother = (text) => {
  const lower = text.toLowerCase();
  return ANOTHER_REQUESTS.some((phrase) => lower.includes(phrase));
};

const detectIntro = (text) => {
  const lower = text.toLowerCase();
  return INTRO_PATTERNS.some((pattern) => lower.startsWith(pattern));
};

const extractName = (text) => {
  const lower = text.toLowerCase();
  if (lower.startsWith("my name is ")) {
    return text.slice(11).trim();
  }
  if (lower.startsWith("i am ")) {
    return text.slice(5).trim();
  }
  if (lower.startsWith("i'm ")) {
    return text.slice(4).trim();
  }
  if (lower.startsWith("im ")) {
    return text.slice(3).trim();
  }
  return "";
};

const extractYear = (text) => {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
};

const getUserMessages = (messages) =>
  messages.filter((msg) => msg.role === "user");

const inferPreferenceFromMessages = (messages) => {
  const userMessages = getUserMessages(messages);
  return (
    userMessages
      .map((msg) => msg.content)
      .map(detectPreference)
      .find(Boolean) || ""
  );
};

const extractGenreTags = (text) => {
  const lower = text.toLowerCase();
  const tags = [];
  if (lower.includes("teen")) tags.push("teen");
  if (lower.includes("love") || lower.includes("romance")) tags.push("romance");
  if (lower.includes("coming of age")) tags.push("coming-of-age");
  if (lower.includes("comedy") || lower.includes("funny")) tags.push("comedy");
  if (lower.includes("drama")) tags.push("drama");
  if (lower.includes("sci-fi") || lower.includes("science fiction"))
    tags.push("sci-fi");
  if (lower.includes("horror")) tags.push("horror");
  if (lower.includes("thriller")) tags.push("thriller");
  return [...new Set(tags)];
};

const buildPromptFromContext = (preference, mood, userText, tags = []) => {
  const base =
    MOOD_PROMPTS[mood]?.[preference] || MOOD_PROMPTS.neutral[preference];
  const tagLine = tags.length ? ` with ${tags.join(", ")}` : "";
  return `${base}${tagLine}. User context: "${userText}"`;
};

const inferMoodFromMessages = (messages) => {
  const userMessages = getUserMessages(messages);
  return (
    userMessages
      .map((msg) => msg.content)
      .map(detectMood)
      .find(Boolean) || "neutral"
  );
};

const buildFallbackResponse = (messages) => {
  const userMessages = getUserMessages(messages);
  const lastUser = [...userMessages].reverse()[0];
  const text = lastUser?.content || "";
  const mood = detectMood(text) || inferMoodFromMessages(messages);
  const preference = detectPreference(text);
  const year =
    extractYear(text) ||
    userMessages
      .map((msg) => msg.content)
      .map(extractYear)
      .find(Boolean);

  if (!preference) {
    if (detectSmallTalk(text)) {
      return {
        reply:
          "I’m CineSense, your movie companion. I’m here to chat and help you find something to watch. How are you feeling right now?",
        mood,
        year
      };
    }
    if (detectGreeting(text)) {
      return {
        reply:
          "Hey! I’m here to chat and help you find a movie. How are you feeling right now?",
        mood,
        year
      };
    }
    if (detectAnother(text)) {
      const lastPreference = inferPreferenceFromMessages(messages);
      if (lastPreference) {
        return {
          reply:
            lastPreference === "match"
              ? "Got it. I’ll match the mood and find something fitting."
              : "Absolutely. I’ll look for something light and uplifting.",
          mood,
          preference: lastPreference,
          year,
          action: "recommend",
          prompt:
            MOOD_PROMPTS[mood]?.[lastPreference] ||
            MOOD_PROMPTS.neutral[lastPreference]
        };
      }
    }
    return {
      reply:
        "Thanks for sharing that. Want a movie that matches how you feel, or something to lift your mood?",
      mood,
      year
    };
  }

  return {
    reply:
      preference === "match"
        ? "Got it. I’ll match the mood and find something fitting."
        : "Absolutely. I’ll look for something light and uplifting.",
    mood,
    preference,
    year,
    action: "recommend",
    prompt: MOOD_PROMPTS[mood]?.[preference] || MOOD_PROMPTS.neutral[preference]
  };
};

const callOpenAI = async (messages) => {
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
            "You are a warm, supportive movie companion. Respond with empathy, short and natural. If the user greets you or chats casually, respond naturally before asking about how they feel. Analyze mood and ask whether they want a movie that matches their mood or lifts it. If a release year is mentioned, include it. Respond ONLY with JSON: {\"reply\":\"\", \"mood\":\"\", \"preference\":\"match|uplift|\", \"action\":\"recommend|\", \"prompt\":\"\", \"year\":\"\"}."
        },
        ...messages
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error("OpenAI request failed");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  const parsed = parseJson(content || "");
  if (!parsed) {
    throw new Error("OpenAI returned invalid JSON");
  }
  return parsed;
};

const callGemini = async (messages) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are a warm, supportive movie companion named CineSense. Always return valid JSON and ALWAYS include a non-empty reply. If the user greets you or asks about you, respond naturally before asking about how they feel. Only recommend a movie AFTER the user explicitly chooses match or uplift. If a release year is mentioned, include it. If preference is set and you are recommending, you MUST include a concise prompt for the movie recommender. Respond ONLY with JSON: {\"reply\":\"\", \"mood\":\"\", \"preference\":\"match|uplift|\", \"action\":\"recommend|\", \"prompt\":\"\", \"year\":\"\"}."
            }
          ]
        },
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        })),
        generationConfig: {
          temperature: 0.4,
          response_mime_type: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorText);
    } catch (parseError) {
      // ignore parse failures
    }
    const error = new Error(
      errorJson?.error?.message || errorText || "Gemini request failed"
    );
    error.status = response.status;
    error.retryDelay =
      errorJson?.error?.details?.find(
        (detail) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
      )?.retryDelay || null;
    throw error;
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  const parsed = parseJson(content || "");
  if (!parsed) {
    throw new Error("Gemini returned invalid JSON");
  }
  return parsed;
};

const normalizeChatResult = (result) => {
  if (!result || typeof result !== "object") {
    throw new Error("Invalid Gemini response");
  }

  if (!result.reply || typeof result.reply !== "string") {
    throw new Error("Gemini response missing reply");
  }

  if (result.action === "recommend" && !result.prompt) {
    return {
      ...result,
      action: "",
      prompt: ""
    };
  }

  return result;
};

export async function POST(request) {
  const { messages } = await request.json();
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { message: "Please include chat messages." },
      { status: 400 }
    );
  }

  try {
    if (GEMINI_API_KEY) {
      const result = await callGemini(messages);
      const normalized = normalizeChatResult(result);
      return Response.json({ ...normalized, engine: "gemini" });
    }
  } catch (error) {
    // ignore and fall through to local
  }
  const fallback = buildFallbackResponse(messages);
  return Response.json({
    ...fallback,
    engine: "local"
  });
}
