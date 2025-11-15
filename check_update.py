import feedparser
import requests
import json
import os
import re

WEBHOOK = os.getenv("WEBHOOK_URL")
DATA_FILE = "latest.json"

VALORANT_RSS = "https://valorantinfo.com/updates/rss"
CS2_STEAMDB = "https://steamdb.info/app/730/"


def send(message):
    payload = {"content": message}
    requests.post(WEBHOOK, json=payload)


def load_last():
    if not os.path.exists(DATA_FILE):
        return {}
    return json.load(open(DATA_FILE))


def save_last(data):
    json.dump(data, open(DATA_FILE, "w"))


def check_valorant(last):
    feed = feedparser.parse(VALORANT_RSS)
    latest_title = feed.entries[0].title

    if last.get("valorant") != latest_title:
        send(f"🟣 **Valorant Patch Update Detected!**\n{latest_title}")
        last["valorant"] = latest_title


def check_cs2(last):
    r = requests.get(CS2_STEAMDB).text
    m = re.search(r"BuildID: </td><td>(\d+)", r)
    if not m:
        return
    build_id = m.group(1)

    if last.get("cs2") != build_id:
        send(f"🟢 **CS2 Patch Update Detected!**\nBuild ID baru: `{build_id}`")
        last["cs2"] = build_id


def main():
    last = load_last()
    check_valorant(last)
    check_cs2(last)
    save_last(last)


main()
