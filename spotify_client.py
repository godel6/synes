"""
Spotify Web API client for the audio visualizer.
Handles OAuth, token management, track polling, and lyrics fetching.
"""

import base64
import json
import re
import threading
import time
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs

import requests


class SpotifyClient:
    """Spotify Web API client with OAuth and lyrics sync."""

    AUTH_URL = "https://accounts.spotify.com/authorize"
    TOKEN_URL = "https://accounts.spotify.com/api/token"
    API_BASE = "https://api.spotify.com/v1"
    LRCLIB_URL = "https://lrclib.net/api/get"

    SCOPES = ["user-read-currently-playing"]

    def __init__(self, config):
        """Initialize with Spotify configuration."""
        self.config = config.get("spotify", {})
        self.enabled = self.config.get("enabled", False)

        if not self.enabled:
            return

        self.client_id = self.config.get("client_id", "")
        self.client_secret = self.config.get("client_secret", "")
        self.redirect_uri = self.config.get("redirect_uri", "http://localhost:8888/callback")

        self.tokens_file = Path(".spotify_tokens.json")

        # Token data
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = 0

        # Track data
        self.current_track_id = None
        self.current_artist = None
        self.current_title = None
        self.is_playing = False
        self.progress_ms = 0
        self.last_poll_time = 0
        self.last_poll_progress = 0

        # Lyrics
        self.lyrics = []  # List of (ms, line) tuples
        self.current_lyric = ""

        # Audio features from Spotify (for reactive visuals)
        self.track_energy = 0.5  # 0-1 energy level
        self.track_tempo = 120  # BPM
        self.track_loudness = -10  # dB
        self.track_valence = 0.5  # 0-1 mood (sad to happy)
        self.track_danceability = 0.5  # 0-1

        # Derived audio values for shaders
        self.spotify_bass = 0.0
        self.spotify_mid = 0.0
        self.spotify_treble = 0.0
        self.spotify_energy = 0.0
        self._last_feature_update = 0

        # Polling thread
        self._poll_thread = None
        self._running = False

    def authenticate(self):
        """Run OAuth flow if needed."""
        if not self.enabled:
            return

        if not self.client_id or not self.client_secret:
            print("Spotify: client_id or client_secret not configured", flush=True)
            return

        # Try to load existing tokens
        if self._load_tokens():
            # Tokens loaded, try to refresh if expired
            self._ensure_valid_token()
            return

        # Need to authenticate
        print("\n" + "=" * 50, flush=True)
        print("Spotify authorization required", flush=True)
        print("=" * 50, flush=True)
        print("Opening browser for Spotify login...", flush=True)

        # Start callback server
        auth_code = self._start_callback_server()

        if auth_code:
            # Exchange code for tokens
            if self._exchange_code(auth_code):
                print("Spotify authorized. You won't need to do this again.", flush=True)
            else:
                print("Spotify: Failed to exchange authorization code", flush=True)
        else:
            print("Spotify: Authorization failed or cancelled", flush=True)

    def _start_callback_server(self):
        """Start HTTP server to catch OAuth callback."""
        auth_code = [None]

        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path == "/callback":
                    params = parse_qs(parsed.query)
                    if "code" in params:
                        auth_code[0] = params["code"][0]
                        self.send_response(200)
                        self.send_header("Content-Type", "text/html")
                        self.end_headers()
                        self.wfile.write(b"<html><body><h1>Authorization successful!</h1><p>You can close this window.</p></body></html>")
                    else:
                        self.send_response(400)
                        self.end_headers()
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, format, *args):
                pass  # Suppress logging

        server = HTTPServer(("localhost", 8888), CallbackHandler)

        # Build auth URL
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.SCOPES),
        }
        auth_url = f"{self.AUTH_URL}?{urlencode(params)}"

        # Open browser
        webbrowser.open(auth_url)

        # Wait for callback (with timeout)
        server.timeout = 120  # 2 minutes
        start_time = time.time()
        while auth_code[0] is None:
            server.handle_request()
            if time.time() - start_time > 120:
                break

        server.server_close()
        return auth_code[0]

    def _exchange_code(self, code):
        """Exchange authorization code for access/refresh tokens."""
        auth_str = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()

        headers = {
            "Authorization": f"Basic {auth_str}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
        }

        try:
            response = requests.post(self.TOKEN_URL, headers=headers, data=data, timeout=10)
            if response.status_code == 200:
                tokens = response.json()
                self.access_token = tokens["access_token"]
                self.refresh_token = tokens["refresh_token"]
                self.token_expires_at = time.time() + tokens["expires_in"]
                self._save_tokens()
                return True
        except Exception as e:
            print(f"Spotify: Token exchange failed: {e}", flush=True)

        return False

    def _save_tokens(self):
        """Save tokens to file."""
        data = {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.token_expires_at,
        }
        with open(self.tokens_file, "w") as f:
            json.dump(data, f)

    def _load_tokens(self):
        """Load tokens from file."""
        if not self.tokens_file.exists():
            return False

        try:
            with open(self.tokens_file, "r") as f:
                data = json.load(f)
            self.access_token = data["access_token"]
            self.refresh_token = data["refresh_token"]
            self.token_expires_at = data.get("expires_at", 0)
            return True
        except Exception:
            return False

    def _refresh_token(self):
        """Refresh the access token."""
        if not self.refresh_token:
            return False

        auth_str = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()

        headers = {
            "Authorization": f"Basic {auth_str}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
        }

        try:
            response = requests.post(self.TOKEN_URL, headers=headers, data=data, timeout=10)
            if response.status_code == 200:
                tokens = response.json()
                self.access_token = tokens["access_token"]
                self.token_expires_at = time.time() + tokens["expires_in"]
                # Save updated tokens
                self._save_tokens()
                return True
        except Exception:
            pass

        return False

    def _ensure_valid_token(self):
        """Ensure we have a valid access token."""
        if time.time() >= self.token_expires_at - 60:  # Refresh 1 minute before expiry
            return self._refresh_token()
        return True

    def start_polling(self):
        """Start polling for current track."""
        if not self.enabled:
            return

        self._running = True
        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()

    def stop_polling(self):
        """Stop polling."""
        self._running = False
        if self._poll_thread:
            self._poll_thread.join(timeout=3)

    def _poll_loop(self):
        """Poll Spotify API every 2 seconds."""
        while self._running:
            self._poll_current_track()
            time.sleep(2)

    def _poll_current_track(self):
        """Poll for currently playing track."""
        if not self._ensure_valid_token():
            return

        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            response = requests.get(
                f"{self.API_BASE}/me/player/currently-playing",
                headers=headers,
                timeout=10
            )

            if response.status_code == 204:
                # No content - nothing playing
                self._update_track_state(None)
                return

            if response.status_code != 200:
                return

            data = response.json()

            if not data or not data.get("item"):
                self._update_track_state(None)
                return

            # Extract track info
            item = data["item"]
            track_id = item.get("id")
            title = item.get("name")
            artist = item["artists"][0].get("name") if item.get("artists") else "Unknown"
            is_playing = data.get("is_playing", False)
            progress_ms = data.get("progress_ms", 0)

            track_info = {
                "id": track_id,
                "title": title,
                "artist": artist,
                "is_playing": is_playing,
                "progress_ms": progress_ms,
            }

            self._update_track_state(track_info)

        except Exception:
            pass  # Silently fail, retry next poll

    def _update_track_state(self, track_info):
        """Update track state and fetch lyrics if needed."""
        if track_info is None:
            self.current_track_id = None
            self.is_playing = False
            self.lyrics = []
            self.current_lyric = ""
            return

        # Check if track changed
        if track_info["id"] != self.current_track_id:
            self.current_track_id = track_info["id"]
            self.current_title = track_info["title"]
            self.current_artist = track_info["artist"]
            self.is_playing = track_info["is_playing"]
            self.progress_ms = track_info["progress_ms"]

            print(f"Now playing: {self.current_artist} - {self.current_title}", flush=True)

            # Fetch lyrics and audio features asynchronously
            threading.Thread(
                target=self._fetch_lyrics,
                args=(self.current_artist, self.current_title),
                daemon=True
            ).start()

            # Fetch audio features for reactive visuals
            threading.Thread(
                target=self._fetch_audio_features,
                args=(self.current_track_id,),
                daemon=True
            ).start()
        else:
            # Same track, just update progress and playing state
            self.is_playing = track_info["is_playing"]
            self.progress_ms = track_info["progress_ms"]

        # Update timing for smooth lyric sync
        current_time = time.time()
        self.last_poll_time = current_time
        self.last_poll_progress = self.progress_ms

    def _fetch_lyrics(self, artist, title):
        """Fetch lyrics from LRCLIB."""
        try:
            params = {
                "artist_name": artist,
                "track_name": title,
            }
            response = requests.get(self.LRCLIB_URL, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()
                # Try different field names
                lrc_text = (
                    data.get("syncedLyrics") or
                    data.get("plainLyrics") or
                    data.get("lyrics") or
                    data.get("text") or
                    ""
                )
                if lrc_text:
                    print(f"Found lyrics for: {artist} - {title}", flush=True)
                    self.lyrics = self.parse_lrc(lrc_text)
                    print(f"Parsed {len(self.lyrics)} lyric lines", flush=True)
                    return
                else:
                    print(f"No lyrics found for: {artist} - {title}", flush=True)
        except Exception as e:
            print(f"Error fetching lyrics: {e}", flush=True)

        # No lyrics found
        self.lyrics = []

    def parse_lrc(self, lrc_text):
        """Parse LRC format into list of (ms, line) tuples."""
        lyrics = []
        pattern = re.compile(r"\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)")

        for line in lrc_text.split("\n"):
            match = pattern.match(line.strip())
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                centiseconds = int(match.group(3).ljust(3, "0")[:3])
                ms = minutes * 60000 + seconds * 1000 + centiseconds
                text = match.group(4).strip()
                if text:
                    lyrics.append((ms, text))

        # Sort by timestamp
        lyrics.sort(key=lambda x: x[0])
        return lyrics

    def get_current_lyric(self):
        """Get the current lyric line based on playback position."""
        if not self.lyrics:
            # print(f"No lyrics loaded. is_playing={self.is_playing}", flush=True)
            return ""

        if not self.is_playing:
            return ""

        # Calculate current position with smooth interpolation
        current_time = time.time()
        elapsed_ms = (current_time - self.last_poll_time) * 1000
        current_position = self.last_poll_progress + elapsed_ms

        # Find the lyric line closest to (not exceeding) current position
        current_lyric = ""
        for ms, line in self.lyrics:
            if ms <= current_position:
                current_lyric = line
            else:
                break

        # print(f"Position: {current_position}, lyric: {current_lyric}", flush=True)
        return current_lyric

    def _fetch_audio_features(self, track_id):
        """Fetch audio features from Spotify API."""
        if not track_id:
            return

        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            response = requests.get(
                f"{self.API_BASE}/audio-features/{track_id}",
                headers=headers,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                self.track_energy = data.get("energy", 0.5)
                self.track_tempo = data.get("tempo", 120)
                self.track_loudness = data.get("loudness", -10)
                self.track_valence = data.get("valence", 0.5)
                self.track_danceability = data.get("danceability", 0.5)

                # Update derived values for shaders
                self._update_spotify_audio_values()
        except Exception:
            pass

    def _update_spotify_audio_values(self):
        """Update derived audio values based on track features and playback position."""
        if not self.is_playing:
            self.spotify_energy = 0.0
            self.spotify_bass = 0.0
            self.spotify_mid = 0.0
            self.spotify_treble = 0.0
            return

        # Use track energy as base
        base_energy = self.track_energy

        # Add some variation based on playback position to make it feel more alive
        # Use tempo to create rhythmic variation
        import math
        beat_phase = (time.time() * self.track_tempo / 60) % 1
        beat_modulation = 0.1 * math.sin(beat_phase * math.pi * 2)

        # Calculate values
        self.spotify_energy = min(1.0, base_energy + beat_modulation * 0.3)
        self.spotify_bass = min(1.0, base_energy * (0.8 + beat_modulation))
        self.spotify_mid = min(1.0, self.track_danceability * (0.7 + beat_modulation * 0.5))
        self.spotify_treble = min(1.0, (1 - self.track_valence) * 0.5 + beat_modulation * 0.3)

    def get_spotify_audio_values(self):
        """Get current audio values from Spotify for shader use."""
        if self.is_playing:
            self._update_spotify_audio_values()
        return {
            "bass": self.spotify_bass,
            "mid": self.spotify_mid,
            "treble": self.spotify_treble,
            "energy": self.spotify_energy,
        }

    def is_available(self):
        """Check if Spotify is enabled and authenticated."""
        return self.enabled and self.access_token is not None
