# Kaldara Music Bot
A Discord bot that plays music on Discord voice channels using the YouTube API. It also has advanced playlist features that allow for the creation of easily manageable custom playlists. It uses a caching system to store recently played songs to limit API usage and increase command response time.

## Technology Used
- **Typescript**: Main programming language for type safety and modern JS features
- **Node.js**: JavaScript runtime environment for running the bot
- **DiscordJS**: Library for interacting with the Discord API
- **MongoDB**: Database for storing playlists, settings, and song history
- **Mongoose**: MongoDB ORM for schema and data management
- **Express**: Web server for health checks and API endpoints
- **FFmpeg**: Audio processing and streaming
- **Fluent-ffmpeg**: Node.js wrapper for FFmpeg
- **Play-DL**: Music streaming and metadata from YouTube, Spotify, and SoundCloud
- **Prism Media**: Audio transcoding and manipulation
- **Stream Buffers**: Buffering audio streams for playback
- **Youtube-DL-Exec**: Downloading and processing YouTube audio
- **@discordjs/voice**: Discord voice connection and audio playback
- **@discordjs/opus**: Opus audio codec for Discord voice
- **@discordjs/builders**: Utilities for building Discord slash commands
- **Nodemon**: Development tool for auto-restarting the bot on code changes
- **ts-node**: Run TypeScript directly in Node.js for development

## How the Bot Works
Kaldara Music Bot is a Discord bot that joins voice channels and plays music from YouTube, Spotify, and SoundCloud. It supports advanced playlist management, queue control, and custom settings for each server. MongoDB is used for persistent storage of playlists, settings, and song history.

### Main Features
- Play songs from YouTube, Spotify, and SoundCloud
- Create, edit, and play custom playlists
- View and manage the current music queue
- Configure bot settings (DJ role, music channel, volume, skip)
- Help command for usage instructions

## Commands
The bot uses Discord slash commands. Some of the main commands include:

- `/play song <url>`: Play a song from a URL
- `/play playlist <url>`: Play a playlist from a URL
- `/play search <keywords>`: Search for a song and play it
- `/play custom_playlist <playlist_id>`: Play a custom playlist
- `/play skip|stop|pause|unpause|seek`: Control playback
- `/playlist create|edit|delete|add_song|remove_song|view`: Manage playlists
- `/queue view|clear|shuffle|repeat_single|repeat_all|autoplay|move_song|remove_song`: Manage the queue
- `/settings set channel|dj_role|volume|skip_enabled|volume_enabled`: Configure bot settings
- `/nowplaying`: Show the currently playing song
- `/help`: Show help and usage instructions

## Packages
The bot relies on the following main npm packages:
- `discord.js`: Discord API wrapper
- `@discordjs/voice`, `@discordjs/opus`, `@discordjs/builders`: Voice and command utilities
- `play-dl`: Music streaming and metadata
- `mongoose`: MongoDB ORM
- `express`: Web server for health checks
- `fluent-ffmpeg`, `youtube-dl-exec`, `prism-media`, `stream-buffers`: Audio processing
- `nodemon`, `ts-node`, `typescript`: Development tools

## Getting Started
1. Install dependencies: `npm install`
2. Configure your bot in `src/config.json` (add Discord bot token, MongoDB URI, etc.)
    - A template has been prepared for renaming to "config.json".
3. Start the bot: `npm run dev` (for development) or `npm start` (for production)

For more details, see the comments at the top of each source file.
