import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Gemini Client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.use(express.json());

  // API endpoint for fetching daily affirmation from Gemini
  app.get("/api/affirmation", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not defined.");
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Generate a beautiful, unique, short daily inspirational affirmation. Return a JSON object with two fields: 'title' (a short, powerful title/phrase like 'Believe in Yourself!') and 'text' (a warm, supportive, and motivating sentence or two, around 15-25 words total, that inspires confidence and continuous learning). Do not include any JSON markdown wrapping, or if you do, return clean JSON.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              text: { type: "STRING" }
            },
            required: ["title", "text"]
          }
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        res.json(parsed);
      } else {
        throw new Error("No text returned from Gemini API");
      }
    } catch (error: any) {
      console.error("Gemini API Error:", error.message || error);
      // Clean fallback in case of errors
      res.json({
        title: "Believe in Yourself!",
        text: "Every day is a new opportunity to grow, work hard, and achieve success."
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
