import feedparser
import requests
import json
import os
import re

WEBHOOK = os.getenv("WEBHOOK_URL")
DATA_FILE = "latest.json"

VALORANT_RSS = "https://valorantinfo.com/updates/rss"
CS2_STEAMDB = "https://steamdb.info/app/730/"
