/** Search links for a song on music platforms (opens the app when installed). */
export type SongLink = { id: string; name: string; url: string };

export function songLinks(title: string, artist: string): SongLink[] {
  const q = encodeURIComponent([artist, title].filter(Boolean).join(" "));
  return [
    { id: "apple", name: "Apple Music", url: `https://music.apple.com/th/search?term=${q}` },
    { id: "spotify", name: "Spotify", url: `https://open.spotify.com/search/${q}` },
    { id: "ytmusic", name: "YouTube Music", url: `https://music.youtube.com/search?q=${q}` },
    { id: "youtube", name: "YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
    { id: "tiktok", name: "TikTok", url: `https://www.tiktok.com/search?q=${q}` },
    { id: "lyrics", name: "เนื้อเพลง", url: `https://www.google.com/search?q=${q}+${encodeURIComponent("เนื้อเพลง")}` },
  ];
}
