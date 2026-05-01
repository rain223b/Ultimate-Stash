import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Helper to get Google Drive folder ID from link
  function extractDriveId(url: string) {
    if (!url) return null;
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
  }

  // API Route: get seasons or episodes from a Google Drive folder
  app.get("/api/drive-folder/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const response = await axios.get(`https://drive.google.com/embeddedfolderview?id=${id}#list`);
      
      const $ = cheerio.load(response.data);
      const items: any[] = [];
      
      $('.flip-entry-title').each((i, el) => {
        let title = $(el).text();
        let parentA = $(el).closest('a');
        let url = parentA.attr('href') || '';
        let thumbUrl = parentA.find('img.flip-entry-thumb').attr('src');
        if (!thumbUrl) {
          thumbUrl = parentA.find('img[src*="drive-storage"]').attr('src');
        }
        
        let isFolder = url.includes('/folders/');
        let itemId = '';
        if (isFolder) {
            const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
            if (m) itemId = m[1];
        } else {
            const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (m) itemId = m[1];
        }

        if (itemId) {
            items.push({
                id: itemId,
                title: title,
                type: isFolder ? 'folder' : 'file',
                thumbnail: thumbUrl || null,
                url: url
            });
        }
      });
      
      res.json({ status: 'ok', items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: get extracted media playlists/links from a Google Doc
  app.get("/api/doc-media/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.get(`https://docs.google.com/document/d/${id}/export?format=txt`);
        const txt = response.data as string;
        
        const lines = txt.split('\n');
        const items: any[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith('season') || trimmed.toLowerCase().startsWith('episode')) {
                const parts = trimmed.split('http');
                if (parts.length > 1) {
                    const title = parts[0].replace(/:$/, '').trim();
                    const url = 'http' + parts[1].trim().split(' ')[0]; // Basic URL extraction
                    items.push({
                        id: url, // use URL as ID for custom doc items
                        title: title,
                        type: 'youtube_playlist',
                        url: url
                    });
                }
            }
        }
        res.json({ status: 'ok', items });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // API Route: get YouTube playlist items
  app.get("/api/youtube-playlist/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.get(`https://www.youtube.com/playlist?list=${id}`);
        // Extract ytInitialData inside HTML
        const html = response.data;
        let items: any[] = [];
        const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (match) {
            const ytData = JSON.parse(match[1]);
            const contents = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];
            
            for (const item of contents) {
                if (item.playlistVideoRenderer) {
                    const video = item.playlistVideoRenderer;
                    items.push({
                        id: video.videoId,
                        title: video.title?.runs?.[0]?.text || '',
                        type: 'youtube_video',
                        thumbnail: video.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
                        url: `https://www.youtube.com/watch?v=${video.videoId}`
                    });
                }
            }
        } else {
            console.log("No ytInitialData found");
        }
        res.json({ status: 'ok', items });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
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

startServer().catch(console.error);
