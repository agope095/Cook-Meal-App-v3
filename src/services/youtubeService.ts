/// <reference types="vite/client" />

export async function getYouTubeVideoId(query: string): Promise<string> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("YouTube API key is missing. Please add VITE_YOUTUBE_API_KEY to your environment variables.");
    return "";
  }

  try {
    // Append "recipe" to ensure cooking tutorials.
    // Use videoDuration=medium to filter out Shorts (< 1m) and get landscape videos (4-20m).
    const searchQuery = query.toLowerCase().includes('recipe') ? query : `${query} recipe`;
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
        searchQuery
      )}&type=video&regionCode=IN&videoDuration=medium&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.error) {
      console.error("YouTube API Error:", data.error.message);
      return "";
    }
    
    if (data.items && data.items.length > 0) {
      return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
    }
  } catch (error) {
    console.error("Error fetching YouTube video:", error);
  }
  return "";
}
