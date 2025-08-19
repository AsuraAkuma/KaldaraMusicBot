// Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
export async function verifyYoutubeURL(url: string): Promise<boolean> {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
}

// Example: https://open.spotify.com/track/7GhIk7Il098yCjg4BQjzvb
export async function verifySpotifyURL(url: string): Promise<boolean> {
    const spotifyRegex = /^(https?:\/\/)?(www\.)?(spotify\.com)\/.+$/;
    return spotifyRegex.test(url);
}

// Example: https://soundcloud.com/forss/flickermood
export async function verifySoundCloudURL(url: string): Promise<boolean> {
    const soundCloudRegex = /^(https?:\/\/)?(www\.)?(soundcloud\.com)\/.+$/;
    return soundCloudRegex.test(url);
}