"""
api_client.py - Munchbox Intake API Client

Handles communication between the hardware OCR pipeline and the Munchbox Intake API.
- Fetches menu list and caches it
- Matches OCR recipe names to menu IDs (fuzzy matching)
- Sends sale data to the API after successful OCR
"""

import csv
import os
import time
import logging
from datetime import datetime
from difflib import SequenceMatcher
from typing import List, Dict, Optional, Tuple

import requests

import config

logger = logging.getLogger("MunchBox")


class MunchboxAPIClient:
    def __init__(
        self,
        base_url: str = None,
        api_key: str = None,
        restaurant_id: int = None,
        fuzzy_cutoff: float = None,
    ):
        self.base_url = (base_url or config.API_BASE_URL).rstrip("/")
        self.api_key = api_key or config.API_KEY
        self.restaurant_id = restaurant_id or config.RESTAURANT_ID
        self.fuzzy_cutoff = fuzzy_cutoff or config.FUZZY_MATCH_CUTOFF

        # Cache: menu_name (lowercase, stripped) -> menu_id
        self._menu_cache: Dict[str, int] = {}
        # Full menu list for fuzzy matching
        self._menu_list: List[dict] = []
        self._menu_last_fetched: float = 0
        self._menu_cache_ttl: int = config.MENU_CACHE_TTL  # seconds

        self._session = requests.Session()
        self._session.headers.update({
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        })

    # ------------------------------------------------------------------ #
    #  Menu fetching & caching
    # ------------------------------------------------------------------ #

    def fetch_menu(self, force: bool = False) -> List[dict]:
        """
        Fetch menu list from API. Uses cache if still valid.
        Returns list of dicts: [{"menu_id", "menu_name", "type", "price"}, ...]
        """
        now = time.time()
        if not force and self._menu_list and (now - self._menu_last_fetched < self._menu_cache_ttl):
            return self._menu_list

        url = f"{self.base_url}/menu/list"
        payload = {"restaurant_id": self.restaurant_id}

        try:
            resp = self._session.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            if data.get("message") != "success":
                logger.error(f"[API] Menu fetch failed: {data}")
                return self._menu_list  # return stale cache

            self._menu_list = data.get("Data", [])
            self._menu_cache = {}
            for item in self._menu_list:
                key = item["menu_name"].strip().lower()
                self._menu_cache[key] = item["menu_id"]

            self._menu_last_fetched = now
            logger.info(f"[API] Menu fetched: {len(self._menu_list)} items")

            # Update recipes_name.csv so OCR pipeline uses latest menu names
            self._update_recipes_csv()

            return self._menu_list

        except requests.RequestException as e:
            logger.error(f"[API] Menu fetch error: {e}")
            return self._menu_list  # return stale cache

    def _update_recipes_csv(self):
        """
        Write menu names from API into recipes/recipes_name.csv
        so the OCR pipeline always has the latest menu names.
        pipeline.py watches this file's mtime and auto-reloads.
        """
        if not self._menu_list:
            return

        recipes_path = config.RECIPES_NAME

        try:
            # Only include menu items with non-empty names (skip combo sub-items starting with " -")
            menu_names = []
            for item in self._menu_list:
                name = item["menu_name"].strip()
                if name and not name.startswith("-"):
                    menu_names.append(name)

            # Read current file to check if update is needed
            current_names = []
            if os.path.exists(recipes_path):
                with open(recipes_path, "r", encoding="utf-8-sig") as f:
                    reader = csv.reader(f)
                    for row in reader:
                        if row:
                            current_names.append(row[0].strip())

            if set(current_names) == set(menu_names):
                logger.info("[API] recipes_name.csv already up to date")
                return

            # Write updated menu names
            os.makedirs(os.path.dirname(recipes_path), exist_ok=True)
            with open(recipes_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                for name in menu_names:
                    writer.writerow([name])

            logger.info(f"[API] recipes_name.csv updated with {len(menu_names)} menu names")

        except Exception as e:
            logger.error(f"[API] Failed to update recipes_name.csv: {e}")

    def _fuzzy_match(self, name: str) -> Optional[int]:
        """
        Try to match a recipe name to a menu_id.
        1. Exact match (case-insensitive)
        2. Fuzzy match using SequenceMatcher
        Returns menu_id or None
        """
        clean = name.strip().lower()

        # Exact match
        if clean in self._menu_cache:
            return self._menu_cache[clean]

        # Fuzzy match
        best_score = 0.0
        best_id = None

        for menu_item in self._menu_list:
            menu_name = menu_item["menu_name"].strip().lower()
            score = SequenceMatcher(None, clean, menu_name).ratio()
            if score > best_score:
                best_score = score
                best_id = menu_item["menu_id"]

        if best_score >= self.fuzzy_cutoff and best_id is not None:
            logger.info(f"[MATCH] '{name}' -> menu_id {best_id} (score: {best_score:.2f})")
            return best_id

        logger.warning(f"[NO MATCH] '{name}' (best score: {best_score:.2f})")
        return None

    # ------------------------------------------------------------------ #
    #  Sending sales
    # ------------------------------------------------------------------ #

    def send_sale(
        self,
        items: List[Dict],
        sale_date: str = None,
    ) -> dict:
        """
        Send sale data to the intake API.

        Args:
            items: list of {"menu_id": int, "amount": int}
            sale_date: optional "YYYY-MM-DD", defaults to today on server

        Returns:
            API response dict or error dict
        """
        url = f"{self.base_url}/receive"
        payload = {
            "restaurant_id": self.restaurant_id,
            "items": items,
        }
        if sale_date:
            payload["sale_date"] = sale_date

        try:
            resp = self._session.post(url, json=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"[API] Sale sent: {data}")
            return data

        except requests.RequestException as e:
            logger.error(f"[API] Send sale error: {e}")
            return {"message": "error", "detail": str(e)}

    # ------------------------------------------------------------------ #
    #  CSV -> API  (main integration point)
    # ------------------------------------------------------------------ #

    def send_csv(self, csv_path: str, sale_date: str = None) -> dict:
        """
        Read a CSV file from the OCR pipeline output and send it to the API.

        CSV format:
            Quantity,Recipe Name
            2,เป๊ปซี่
            1,ผักสลัด

        Args:
            csv_path: path to the output CSV
            sale_date: optional "YYYY-MM-DD"

        Returns:
            API response dict
        """
        # Make sure menu cache is loaded
        self.fetch_menu()

        if not self._menu_list:
            logger.error("[API] No menu data available. Cannot send CSV.")
            return {"message": "error", "detail": "no menu data"}

        items = []
        unmatched = []

        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                header = next(reader, None)  # skip header row

                for row in reader:
                    if len(row) < 2:
                        continue

                    try:
                        qty = int(row[0].strip())
                    except ValueError:
                        logger.warning(f"[CSV] Invalid quantity '{row[0]}' in {csv_path}")
                        continue

                    recipe_name = row[1].strip()
                    menu_id = self._fuzzy_match(recipe_name)

                    if menu_id is not None:
                        items.append({"menu_id": menu_id, "amount": qty})
                    else:
                        unmatched.append(recipe_name)

        except Exception as e:
            logger.error(f"[CSV] Error reading {csv_path}: {e}")
            return {"message": "error", "detail": str(e)}

        if unmatched:
            logger.warning(f"[CSV] Unmatched items: {unmatched}")

        if not items:
            logger.warning(f"[CSV] No matched items to send from {csv_path}")
            return {"message": "error", "detail": "no matched items"}

        # Derive sale_date from folder name if not provided
        if not sale_date:
            # csv_path like: output_csv/2025_04_20/1.csv
            parent_dir = os.path.basename(os.path.dirname(csv_path))
            try:
                dt = datetime.strptime(parent_dir, "%Y_%m_%d")
                sale_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass  # let server default to today

        return self.send_sale(items, sale_date=sale_date)

    # ------------------------------------------------------------------ #
    #  Health check
    # ------------------------------------------------------------------ #

    def health_check(self) -> bool:
        """Ping the API health endpoint."""
        url = f"{self.base_url}/health"
        try:
            resp = self._session.get(url, timeout=5)
            return resp.status_code == 200
        except requests.RequestException:
            return False


# ------------------------------------------------------------------ #
#  Singleton instance for use in pipeline.py
# ------------------------------------------------------------------ #

_client: Optional[MunchboxAPIClient] = None


def get_client() -> MunchboxAPIClient:
    """Get or create the singleton API client."""
    global _client
    if _client is None:
        _client = MunchboxAPIClient()
    return _client


def send_csv_to_api(csv_path: str, sale_date: str = None) -> dict:
    """Convenience function for pipeline.py to call after OCR success."""
    return get_client().send_csv(csv_path, sale_date)