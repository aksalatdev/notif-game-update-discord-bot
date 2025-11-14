# notif-game-update-discord-bot

## Overview

`notif-game-update-discord-bot` keeps your gaming group informed when published updates land for titles like **Valorant** (or any other game with a publicly scraped feed). The bot polls the configured update sources, filters for relevant platform or region updates, and posts a concise notice to one or more Discord channels so teammates know a new patch has arrived and they can jump back into the queue faster.

## Features

-   Watches multiple games/feeds in a single run (Valorant, League, Dota, etc.)
-   Sends lightweight update cards that include the patch title, release time, and a short summary
-   Supports automatic refresh intervals so the group never misses a drop
-   Allows per-game toggles so you can silence titles that are off-season
-   Posts to one or many channels (support for role tagging or pinned announcements)
-   Optional webhook to remind players in voice or text channels

## Getting Started

### Prerequisites

1. Clone this repository locally.
2. Create and activate a Python virtual environment (if using Python) or install the dependencies for the bot implementation you favor.
3. Obtain a Discord bot token and invite the bot to your server with the proper permissions to send messages and embed links.

```powershell
git clone <repo-url>
cd notif-game-update-discord-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Configuration

Create a `.env` file or set the following environment variables before running the bot.

| Variable              | Description                                                                    | Example                                 |
| --------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| `DISCORD_TOKEN`       | Bot token from the Discord Developer Portal                                    | `NzI1...`                               |
| `DISCORD_CHANNEL_IDS` | Comma-separated list of channel IDs to post updates into                       | `123456789012345678,987654321098765432` |
| `CHECK_INTERVAL`      | Seconds between checks for new updates                                         | `300`                                   |
| `GAMES`               | JSON string describing each game to watch (source URL, friendly name, filters) | See below                               |
| `ROLE_MENTION`        | Optional role mention to include in each announcement                          | `@ValorantTeam`                         |

Example `GAMES` structure (stored as JSON or read from a YAML/JSON file):

```json
[
    {
        "name": "Valorant",
        "url": "https://playvalorant.com/en-us/news/patch-notes/",
        "selector": ".patch-note",
        "keywords": ["update", "patch"]
    },
    {
        "name": "Other Game",
        "url": "https://example.com/updates",
        "selector": "article",
        "keywords": ["client patch"]
    }
]
```

> The `selector` is the CSS selector or API endpoint used to locate the most recent entry. `keywords` help you filter out noise like beta announcements unless they explicitly identify new patches.

## Running the Bot

After configuration, start the bot with the following command:

```powershell
python bot.py
```

The bot will log each poll, report when it detects an update, and send a notification embed to every configured channel. If you add new games, restart the bot or reload the configuration if your runner supports it.

## Notification Format

-   **Title:** Name of the game plus the patch title (e.g., `Valorant – Patch 7.07`)
-   **Description:** Release window, key changes, or the first paragraph of the patch notes
-   **Link:** Direct link to the patch notes on the official site
-   **Footer:** Timestamp and optional reminder tag (e.g., `@DiscordRole`)

## Customization Ideas

-   Add a “ready check” reaction prompt after posting an update
-   Track multiple regions and announce based on the user’s preferred locale
-   Integrate with a scheduling service to only send updates during prime play times
-   Persist seen update IDs to avoid re-posting the same announcement on restart

## Contributing

1. Fork the repo and create a feature branch.
2. Follow the existing structure for feed scrapers and notification helpers.
3. Write or update tests/documentation for new functionality.

Pull requests are welcome — keep them focused on a single game feed or integration so it’s easy to review.

## License

This project is provided `as-is` without warranty. Choose a license that matches your distribution intentions (MIT, Apache, etc.) and add it if not already present.
