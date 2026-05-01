import { useState, useMemo, useEffect } from 'react';
import { games } from './games';
import { movies } from './movies';
import { shows } from './shows';
import { Search, X, Maximize, Play, Gamepad2, Ghost, Rocket, LayoutGrid, Joystick, Film, Tv } from 'lucide-react';

function normalizeFileName(name: string) {
  if (name.includes('.') && name.lastIndexOf('.') > 0) return name;
  return name + '.html';
}

function GamePlayer({ gameId, onClose }: { gameId: string, onClose: () => void }) {
  const [iframeSrcUrl, setIframeSrcUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const gameName = useMemo(() => {
    return games.find(g => g.id === gameId)?.name || gameId.replace(/^cl/i, '').replace(/([A-Z])/g, ' $1').trim();
  }, [gameId]);

  useEffect(() => {
    // Fetch the raw HTML since jsdelivr returns text/plain for raw github files
    const encoded = encodeURIComponent(normalizeFileName(gameId));
    const url = `https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/${encoded}`;
    
    fetch(url)
      .then(res => res.text())
      .then(html => {
        // Create a blob URL to render the HTML properly
        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        setIframeSrcUrl(blobUrl);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load game", err);
        setLoading(false);
      });
      
    return () => {
      if (iframeSrcUrl) {
        URL.revokeObjectURL(iframeSrcUrl);
      }
    };
  }, [gameId]); // don't add iframeSrcUrl to deps

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-zinc-100 font-semibold tracking-wide">
            {gameName}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={iframeSrcUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium ${!iframeSrcUrl ? 'opacity-50 pointer-events-none' : ''}`}
            title="Open in new tab"
          >
            <Maximize className="w-4 h-4" />
            <span>Fullscreen</span>
          </a>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 w-full relative bg-black flex items-center justify-center">
        {loading && (
          <div className="text-zinc-400 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Loading game...</p>
          </div>
        )}
        {iframeSrcUrl && (
          <iframe
            src={iframeSrcUrl}
            className={`w-full h-full border-none absolute inset-0 ${loading ? 'opacity-0' : 'opacity-100'}`}
            allow="fullscreen; autoplay; gamepad; keyboard"
          />
        )}
      </div>
    </div>
  );
}

function MoviePlayer({ movie, onClose }: { movie: { id: string, name: string, url: string }, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-indigo-400" />
          <h2 className="text-zinc-100 font-semibold tracking-wide">
            {movie.name}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={movie.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
            title="Open in new tab"
          >
            <Maximize className="w-4 h-4" />
            <span>Fullscreen</span>
          </a>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 w-full bg-black flex items-center justify-center relative">
        <iframe
          src={movie.url}
          className="w-full h-full border-none absolute inset-0"
          allow="autoplay; fullscreen"
        />
      </div>
    </div>
  );
}

interface ShowItem {
  id: string;
  title: string;
  type: 'folder' | 'file' | 'youtube_playlist' | 'youtube_video';
  thumbnail: string | null;
  url: string;
}

function ShowPlayer({ show, onClose }: { show: { id: string, name: string, url: string, embedUrl?: string, thumbnail?: string }, onClose: () => void }) {
  const [items, setItems] = useState<ShowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{id: string, type: string, name: string}[]>([]);
  const [playingVideo, setPlayingVideo] = useState<{id: string, type: 'file'|'youtube_video'} | null>(null);

  const fetchItems = async (id: string, type: string) => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '';
      if (type === 'doc') {
        endpoint = `/api/doc-media/${id}`;
      } else if (type === 'youtube_playlist') {
        const listMatch = id.match(/list=([a-zA-Z0-9_-]+)/);
        const pid = listMatch ? listMatch[1] : id;
        endpoint = `/api/youtube-playlist/${pid}`;
      } else {
        endpoint = `/api/drive-folder/${id}`;
      }
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mode = 'drive';
    let targetId = show.id;
    if (show.url.includes('docs.google.com')) {
      mode = 'doc';
      const m = show.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) targetId = m[1];
    }
    setHistory([{ id: targetId, type: mode, name: show.name }]);
  }, [show]);

  useEffect(() => {
    if (history.length > 0) {
      const current = history[history.length - 1];
      fetchItems(current.id, current.type);
    }
  }, [history]);

  const handleItemClick = (item: ShowItem) => {
    if (item.type === 'folder' || item.type === 'youtube_playlist') {
      setHistory([...history, { id: item.id || item.url, type: item.type, name: item.title }]);
    } else {
      setPlayingVideo({ id: item.id, type: item.type as any });
    }
  };

  const handleBack = () => {
    if (playingVideo) {
       setPlayingVideo(null);
       return;
    }
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
    }
  };

  const currentLevel = history[history.length - 1];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          {history.length > 1 || playingVideo ? (
            <button
              onClick={handleBack}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors mr-2"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
          ) : (
            <Tv className="w-5 h-5 text-indigo-400" />
          )}
          <h2 className="text-zinc-100 font-semibold tracking-wide">
            {playingVideo ? "Playing Video" : currentLevel?.name}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 w-full flex flex-col relative overflow-hidden bg-zinc-950">
        {playingVideo ? (
          playingVideo.type === 'youtube_video' ? (
             <iframe
               src={`https://www.youtube.com/embed/${playingVideo.id}?autoplay=1`}
               className="w-full h-full border-none absolute inset-0"
               allow="autoplay; fullscreen"
             />
          ) : (
             <iframe
               src={`https://drive.google.com/file/d/${playingVideo.id}/preview`}
               className="w-full h-full border-none absolute inset-0"
               allow="autoplay; fullscreen"
             />
          )
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
           <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
             <p className="mb-4">Error loading content: {error}</p>
             <button onClick={() => fetchItems(currentLevel.id, currentLevel.type)} className="px-4 py-2 bg-indigo-500 text-white rounded">Retry</button>
           </div>
        ) : items.length === 0 ? (
           <div className="flex-1 flex items-center justify-center text-zinc-500">
             No items found 
           </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {items.map((item, idx) => (
                <button
                  key={item.id + idx}
                  onClick={() => handleItemClick(item)}
                  className="group relative flex flex-col items-center justify-start p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-300"
                >
                  <div className="w-full aspect-video mb-3 rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0 flex items-center justify-center">
                    {item.thumbnail ? (
                       <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : item.type === 'folder' || item.type === 'youtube_playlist' ? (
                       <svg className="w-10 h-10 text-indigo-500/50" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                    ) : (
                       <Play className="w-8 h-8 text-zinc-700" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors text-center line-clamp-2 title-text">
                    {item.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [playingGame, setPlayingGame] = useState<string | null>(null);
  const [playingMovie, setPlayingMovie] = useState<string | null>(null);
  const [playingShow, setPlayingShow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'default' | 'popular' | 'abc' | 'zyx'>('default');
  const [selectedGenre, setSelectedGenre] = useState<'all' | 'retro' | 'movies' | 'shows'>('all');

  const filteredMovies = useMemo(() => {
    let result = movies;
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(lower));
    }
    
    return [...result].sort((a, b) => {
      if (sortBy === 'zyx') return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name); // Default, popular, and abc sort alphabetically for movies
    });
  }, [searchQuery, sortBy]);

  const groupedMovies = useMemo(() => {
    const groups: { letter: string; movies: typeof movies }[] = [];
    filteredMovies.forEach(movie => {
      const firstChar = movie.name.charAt(0).toUpperCase();
      const letter = /[A-Z0-9]/.test(firstChar) ? firstChar : '#';
      
      let group = groups.find(g => g.letter === letter);
      if (!group) {
        group = { letter, movies: [] };
        groups.push(group);
      }
      group.movies.push(movie);
    });
    
    groups.sort((a, b) => {
      if (a.letter === '#') return 1;
      if (b.letter === '#') return -1;
      if (sortBy === 'zyx') return b.letter.localeCompare(a.letter);
      return a.letter.localeCompare(b.letter);
    });
    
    return groups;
  }, [filteredMovies, sortBy]);

  const filteredShows = useMemo(() => {
    let result = shows;
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(lower));
    }
    
    return [...result].sort((a, b) => {
      if (sortBy === 'zyx') return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, sortBy]);

  const groupedShows = useMemo(() => {
    const groups: { letter: string; shows: typeof shows }[] = [];
    filteredShows.forEach(show => {
      const firstChar = show.name.charAt(0).toUpperCase();
      const letter = /[A-Z0-9]/.test(firstChar) ? firstChar : '#';
      
      let group = groups.find(g => g.letter === letter);
      if (!group) {
        group = { letter, shows: [] };
        groups.push(group);
      }
      group.shows.push(show);
    });
    
    groups.sort((a, b) => {
      if (a.letter === '#') return 1;
      if (b.letter === '#') return -1;
      if (sortBy === 'zyx') return b.letter.localeCompare(a.letter);
      return a.letter.localeCompare(b.letter);
    });
    
    return groups;
  }, [filteredShows, sortBy]);

  const filteredGames = useMemo(() => {
    let result = games;
    
    if (selectedGenre === 'retro') {
      const retroKeywords = ['retro', 'mario', 'sonic', 'pacman', 'tetris', 'asteroids', 'doom', 'pong', 'pixel', 'zelda', 'pokemon', 'street fighter', 'mortal kombat', 'duck hunt', 'galaga', 'space invaders', 'frogger', 'flappy'];
      result = result.filter(g => {
        const n = g.name.toLowerCase();
        return retroKeywords.some(k => n.includes(k));
      });
    }
    
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(g => g.name.toLowerCase().includes(lower));
    }

    const isPopular = (name: string) => {
      const n = name.toLowerCase();
      return (n.includes('retro') && n.includes('bowl')) ||
             n.includes('1v1') ||
             n.includes('smash karts') ||
             n.includes('minecraft') ||
             n.includes('fnaf') ||
             n.includes('subway surfers') ||
             n.includes('geometry') ||
             n.includes('slope') ||
             n.includes('run 3') ||
             n.includes('run3') ||
             n.includes('btd') ||
             n.includes('bloons') ||
             n.includes('happy wheels') ||
             n.includes('bitlife') ||
             n.includes('among us') ||
             n.includes('mario kart') ||
             n.includes('super mario') ||
             n.includes('pokemon') ||
             (n.includes('2048') && !n.includes('cupcakes') && !n.includes('multitask')) ||
             n.includes('cookie clicker') ||
             n.includes('crossy road') ||
             n.includes('drive mad') ||
             n.includes('drift boss') ||
             n.includes('basket random') ||
             n.includes('soccer random') ||
             n.includes('tunnel rush') ||
             n.includes('doodle jump') ||
             (n.includes('duck life') && n.length < 15) ||
             (n.includes('papa') && n.length < 20) ||
             (n.includes('vex') && n.length < 8) ||
             n.includes('candy crush') ||
             n.includes('angry birds') ||
             n.includes('jetpack joyride') ||
             n.includes('sonic');
    };

    return [...result].sort((a, b) => {
      if (sortBy === 'default') {
        const aPop = isPopular(a.name) ? 1 : 0;
        const bPop = isPopular(b.name) ? 1 : 0;
        if (aPop !== bPop) return bPop - aPop;
        return 0; // maintain original roughly
      } else if (sortBy === 'popular') {
        const aPop = isPopular(a.name) ? 1 : 0;
        const bPop = isPopular(b.name) ? 1 : 0;
        if (aPop !== bPop) return bPop - aPop;
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'abc') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'zyx') {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });
  }, [searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <header className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                <Ghost className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                  Ultimate Stash
                </h1>
                <p className="text-sm text-zinc-500 mt-1 font-medium tracking-wide">
                  {games.length} Games • {movies.length} Movies • {shows.length} Shows
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search for a game, movie or show..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                />
              </div>
              
              <div className="relative min-w-[140px]">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-4 pr-10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium appearance-none cursor-pointer"
                >
                  <option value="default">Default</option>
                  <option value="popular">Popular First</option>
                  <option value="abc">Alphabetical (A-Z)</option>
                  <option value="zyx">Alphabetical (Z-A)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-xl font-bold text-zinc-100 mb-4 tracking-tight">Choose Ur Genre:</h2>
        <div className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide">
          <button
            onClick={() => setSelectedGenre('all')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
              selectedGenre === 'all' 
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700'
            }`}
          >
            <LayoutGrid className={`w-4 h-4 ${selectedGenre === 'all' ? 'text-white' : 'text-zinc-500'}`} />
            All Games
          </button>
          <button
            onClick={() => setSelectedGenre('retro')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
              selectedGenre === 'retro' 
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Joystick className={`w-4 h-4 ${selectedGenre === 'retro' ? 'text-white' : 'text-zinc-500'}`} />
            Retro Games
          </button>
          <button
            onClick={() => setSelectedGenre('movies')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
              selectedGenre === 'movies' 
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Film className={`w-4 h-4 ${selectedGenre === 'movies' ? 'text-white' : 'text-zinc-500'}`} />
            Movies
          </button>
          <button
            onClick={() => setSelectedGenre('shows')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
              selectedGenre === 'shows' 
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Tv className={`w-4 h-4 ${selectedGenre === 'shows' ? 'text-white' : 'text-zinc-500'}`} />
            Shows
          </button>
        </div>

        {selectedGenre !== 'movies' && selectedGenre !== 'shows' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredGames.map((game) => (
            <button
              key={game.id}
              onClick={() => setPlayingGame(game.id)}
              className="group relative flex flex-col items-center justify-start p-4 h-52 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-zinc-800/80 hover:border-zinc-700 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/10 group-hover:to-transparent transition-all duration-500" />
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-duration-300 transform translate-y-1 group-hover:translate-y-0 z-20">
                <div className="bg-indigo-500 rounded-full p-2 shadow-lg shadow-indigo-500/30">
                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              </div>
              
              <div className="w-24 h-24 mb-4 rounded-2xl overflow-hidden bg-zinc-950/80 flex-shrink-0 border border-zinc-800/50 group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-300 shadow-inner relative z-10">
                <img 
                  src={`https://tse2.mm.bing.net/th?q=${encodeURIComponent(game.name + ' game icon')}&w=128&h=128&c=7&rs=1&p=0&dpr=1&pid=1.7&mkt=en-IN&adlt=moderate`}
                  alt={`${game.name} logo`}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${game.id}&backgroundType=gradientLinear&backgroundColor=18181b,27272a`;
                  }}
                />
              </div>

              <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors text-center line-clamp-2 z-10 px-1 tracking-wide leading-snug w-full mt-auto">
                {game.name}
              </span>
            </button>
          ))}
        </div>
        )}
        
        {selectedGenre === 'movies' && (
          <div className="flex flex-col gap-6">
            {groupedMovies.map(group => (
              <div key={group.letter} className="relative">
                <div className="sticky top-[152px] md:top-[97px] z-30 bg-zinc-950/95 backdrop-blur-xl py-3 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 flex items-center border-b border-zinc-800/50 sm:bg-zinc-950/90 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.5)] sm:shadow-none text-zinc-100">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent w-8">
                    {group.letter}
                  </h3>
                  <div className="h-px bg-gradient-to-r from-zinc-800 to-transparent flex-1 ml-4 hidden sm:block"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {group.movies.map((movie) => (
                    <button
                      key={movie.id}
                      onClick={() => setPlayingMovie(movie.id)}
                      className="group relative flex flex-col items-center justify-start p-4 h-56 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-zinc-800/80 hover:border-zinc-700 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/10 group-hover:to-transparent transition-all duration-500" />
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-duration-300 transform translate-y-1 group-hover:translate-y-0 z-20">
                        <div className="bg-indigo-500 rounded-full p-2 shadow-lg shadow-indigo-500/30">
                          <Play className="w-3.5 h-3.5 text-white fill-white" />
                        </div>
                      </div>
                      
                      <div className="w-full aspect-[2/3] mb-4 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800/50 group-hover:scale-105 group-hover:-translate-y-1 transition-transform duration-300 shadow-inner relative z-10">
                        <img 
                          src={`https://tse2.mm.bing.net/th?q=${encodeURIComponent(movie.name + ' movie poster')}&w=200&h=300&c=7&rs=1&p=0&dpr=1&pid=1.7&mkt=en-US&adlt=moderate`}
                          alt={`${movie.name} poster`}
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${movie.id}&backgroundType=gradientLinear&backgroundColor=18181b,27272a`;
                          }}
                        />
                      </div>

                      <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors text-center line-clamp-2 z-10 px-1 tracking-wide leading-snug w-full mt-auto">
                        {movie.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {selectedGenre === 'shows' && (
          <div className="flex flex-col gap-6">
            {groupedShows.map(group => (
              <div key={group.letter} className="relative">
                <div className="sticky top-[152px] md:top-[97px] z-30 bg-zinc-950/95 backdrop-blur-xl py-3 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 flex items-center border-b border-zinc-800/50 sm:bg-zinc-950/90 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.5)] sm:shadow-none text-zinc-100">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent w-8">
                    {group.letter}
                  </h3>
                  <div className="h-px bg-gradient-to-r from-zinc-800 to-transparent flex-1 ml-4 hidden sm:block"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {group.shows.map((show) => (
                    <button
                      key={show.id}
                      onClick={() => setPlayingShow(show.id)}
                      className="group relative flex flex-col items-center justify-start p-4 h-56 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl hover:bg-zinc-800/80 hover:border-zinc-700 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/10 group-hover:to-transparent transition-all duration-500" />
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-duration-300 transform translate-y-1 group-hover:translate-y-0 z-20">
                        <div className="bg-indigo-500 rounded-full p-2 shadow-lg shadow-indigo-500/30">
                          <Play className="w-3.5 h-3.5 text-white fill-white" />
                        </div>
                      </div>
                      
                      <div className="w-full aspect-[2/3] mb-4 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 border border-zinc-800/50 group-hover:scale-105 group-hover:-translate-y-1 transition-transform duration-300 shadow-inner relative z-10 flex items-center justify-center">
                        <Tv className="w-8 h-8 text-zinc-800 absolute z-0" />
                        <img 
                          src={show.thumbnail || `https://tse2.mm.bing.net/th?q=${encodeURIComponent(show.name + ' tv show poster')}&w=200&h=300&c=7&rs=1&p=0&dpr=1&pid=1.7&mkt=en-US&adlt=moderate`}
                          alt={`${show.name} poster`}
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity relative z-10"
                          loading="lazy"
                          onError={(e) => {
                            if(!show.thumbnail || e.currentTarget.src !== show.thumbnail) {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = 'none';
                            }
                          }}
                        />
                      </div>

                      <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors text-center line-clamp-2 z-10 px-1 tracking-wide leading-snug w-full mt-auto">
                        {show.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {selectedGenre !== 'movies' && selectedGenre !== 'shows' && filteredGames.length === 0 && (
          <div className="text-center py-20">
            <Gamepad2 className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-zinc-400">No games found</h3>
            <p className="text-zinc-600 mt-2">Try searching with a different term</p>
          </div>
        )}

        {selectedGenre === 'movies' && filteredMovies.length === 0 && (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-zinc-400">No movies found</h3>
            <p className="text-zinc-600 mt-2">Try searching with a different term</p>
          </div>
        )}

        {selectedGenre === 'shows' && filteredShows.length === 0 && (
          <div className="text-center py-20">
            <Tv className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-zinc-400">No shows found</h3>
            <p className="text-zinc-600 mt-2">Try searching with a different term</p>
          </div>
        )}
      </main>

      {playingGame && (
        <GamePlayer gameId={playingGame} onClose={() => setPlayingGame(null)} />
      )}
      
      {playingMovie && (
        <MoviePlayer 
          movie={movies.find(m => m.id === playingMovie)!} 
          onClose={() => setPlayingMovie(null)} 
        />
      )}

      {playingShow && (
        <ShowPlayer 
          show={shows.find(s => s.id === playingShow)!} 
          onClose={() => setPlayingShow(null)} 
        />
      )}
    </div>
  );
}
