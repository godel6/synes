#!/usr/bin/env python3
"""
Fullscreen Python Audio Visualizer
Captures microphone input, processes with FFT, renders reactive visuals with ModernGL
"""

import argparse
import json
import os
import sys
import threading
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import moderngl
import moderngl_window as mglw
from moderngl_window.text.bitmapped import TextWriter2D
import pygame

from spotify_client import SpotifyClient
from utils import shader_downloader
from utils.hand_tracker import create_hand_tracker


def run_debug_mode(config):
    """Run in debug mode - no window, just print audio/hand values."""
    print("\n" + "=" * 60, flush=True)
    print("  SYNES DEBUG MODE  |  press Ctrl+C to stop", flush=True)
    print("=" * 60, flush=True)

    # Initialize audio
    audio_lock = threading.Lock()
    bass = 0.0
    mid = 0.0
    treble = 0.0
    energy = 0.0

    audio_gain = config.get("audio", {}).get("gain", 2.5)
    bass_boost = config.get("audio", {}).get("bass_boost", 1.0)
    mid_boost = config.get("audio", {}).get("mid_boost", 1.0)
    treble_boost = config.get("audio", {}).get("treble_boost", 1.0)
    smoothing_factor = config.get("audio", {}).get("smoothing", 0.15)
    bass_divisor = config.get("audio", {}).get("bass_divisor", 300)
    mid_divisor = config.get("audio", {}).get("mid_divisor", 60)
    treble_divisor = config.get("audio", {}).get("treble_divisor", 10)
    energy_divisor = config.get("audio", {}).get("energy_divisor", 0.3)

    sample_rate = config.get("sample_rate", 44100)
    blocksize = config.get("blocksize", 2048)

    def audio_callback(indata, frames, time_info, status):
        nonlocal bass, mid, treble, energy
        if status:
            print(f"Audio status: {status}", flush=True)
            return

        # Compute FFT
        fft = np.fft.rfft(indata[:, 0])
        magnitude = np.abs(fft)
        freqs = np.fft.rfftfreq(blocksize, 1 / sample_rate)

        # Split into frequency bands
        bass_mask = freqs < 200
        mid_mask = (freqs >= 200) & (freqs < 2000)
        treble_mask = freqs >= 2000

        raw_bass = np.mean(magnitude[bass_mask]) if np.any(bass_mask) else 0
        raw_mid = np.mean(magnitude[mid_mask]) if np.any(mid_mask) else 0
        raw_treble = np.mean(magnitude[treble_mask]) if np.any(treble_mask) else 0

        # Apply gains
        raw_bass *= audio_gain * bass_boost
        raw_mid *= audio_gain * mid_boost
        raw_treble *= audio_gain * treble_boost

        # Normalize
        raw_bass = min(1.0, raw_bass / bass_divisor)
        raw_mid = min(1.0, raw_mid / mid_divisor)
        raw_treble = min(1.0, raw_treble / treble_divisor)

        # RMS energy
        raw_energy = np.sqrt(np.mean(indata ** 2)) * 10 / energy_divisor
        raw_energy = min(1.0, raw_energy)

        # Smooth
        with audio_lock:
            bass = bass * smoothing_factor + raw_bass * (1 - smoothing_factor)
            mid = mid * smoothing_factor + raw_mid * (1 - smoothing_factor)
            treble = treble * smoothing_factor + raw_treble * (1 - smoothing_factor)
            energy = energy * smoothing_factor + raw_energy * (1 - smoothing_factor)

    # Start audio stream
    try:
        stream = sd.InputStream(
            device=config.get("device_index", 0),
            channels=1,
            samplerate=sample_rate,
            blocksize=blocksize,
            callback=audio_callback,
            dtype='float32'
        )
        stream.start()
        print(f"[AUDIO] Started using device {config.get('device_index', 0)}", flush=True)
    except Exception as e:
        print(f"ERROR starting audio: {e}", flush=True)
        print("Run 'python -m sounddevice' to list available devices", flush=True)
        return

    # Initialize hand tracker
    hand_tracker = create_hand_tracker(config)
    if hand_tracker:
        hand_tracker.start()

    # Initialize Spotify
    spotify = None
    if config.get("spotify", {}).get("enabled", True):
        try:
            spotify = SpotifyClient(config)
            spotify.authenticate()
            if spotify.is_available():
                spotify.start_polling()
                print("[Spotify] Polling started", flush=True)
        except Exception as e:
            print(f"[Spotify] Init error: {e}", flush=True)

    # Get available shaders
    shaders_dir = Path("shaders")
    available_shaders = sorted(shaders_dir.glob("*.frag")) if shaders_dir.exists() else []
    shader_names = [s.stem for s in available_shaders]

    # Debug tracking
    bass_zero_start = None
    hand_zero_start = None
    all_zero_start = None
    start_time = time.time()
    last_print_time = 0
    print_interval = 1.0

    # Track key press for keeping running
    import msvcrt
    key_pressed = False

    def check_key():
        """Check if a key was pressed (non-blocking on Windows)."""
        return msvcrt.kbhit()

    print("\nStarting debug output... (press any key to keep running after 5s)\n", flush=True)

    try:
        while True:
            current_time = time.time()
            elapsed = current_time - start_time

            # Get values
            with audio_lock:
                current_bass = bass
                current_mid = mid
                current_treble = treble
                current_energy = energy

            hand_x, hand_y, hand_present = 0.5, 0.5, 0.0
            if hand_tracker:
                hand_x, hand_y, hand_present = hand_tracker.get_position()

            # Get Spotify info
            spotify_info = ""
            if spotify and spotify.is_available():
                track = getattr(spotify, 'current_title', None) or "Unknown"
                artist = getattr(spotify, 'current_artist', None) or ""
                pos = spotify.progress_ms or 0
                lyric_line = ""
                if hasattr(spotify, 'current_lyric') and spotify.current_lyric:
                    lyric_line = f'\n  [Lyrics]  "{spotify.current_lyric}"'
                spotify_info = f"\n  [Spotify] {artist} - {track} | pos={pos}ms{lyric_line}"

            # Get current shader (first one for demo)
            current_shader = shader_names[0] if shader_names else "none"

            # Print every second
            if current_time - last_print_time >= print_interval:
                last_print_time = current_time

                # ASCII bar helper
                def make_bar(value, width=10):
                    filled = int(value * width)
                    return "█" * filled + "░" * (width - filled)

                print(f"""
┌─────────────────────────────────────────────────────┐
│  SYNES DEBUG MODE  |  elapsed={elapsed:5.1f}s              │
├──────────┬─────────┬─────────┬─────────┬────────────┤
│  bass    │  mid    │ treble  │ energy  │  hand      │
├──────────┼─────────┼─────────┼─────────┼────────────┤
│  {current_bass:5.2f}  │  {current_mid:5.2f}  │  {current_treble:5.2f}  │  {current_energy:5.2f}  │ x={hand_x:.2f}     │
│  {make_bar(current_bass)} │ {make_bar(current_mid)} │ {make_bar(current_treble)} │ {make_bar(current_energy)} │ y={hand_y:.2f}     │
│          │         │         │         │ present={int(hand_present)} ─┘{spotify_info}
  [Shader]  would render: shaders/{current_shader}.frag""", flush=True)

            # Warnings (only print once when first triggered)
            if current_bass < 0.01:
                if bass_zero_start is None:
                    bass_zero_start = current_time
                elif 3 < current_time - bass_zero_start < 3.2:
                    print(f"  WARN: bass stuck at 0.0 for 3+s -> likely wrong audio device", flush=True)
            else:
                bass_zero_start = None

            if hand_present < 0.5:
                if hand_zero_start is None:
                    hand_zero_start = current_time
                elif 10 < current_time - hand_zero_start < 10.2:
                    print(f"  WARN: hand_present always 0 for 10+s -> likely wrong camera index", flush=True)
            else:
                hand_zero_start = None

            if current_bass < 0.01 and current_mid < 0.01 and current_treble < 0.01 and current_energy < 0.01:
                if all_zero_start is None:
                    all_zero_start = current_time
                elif 3 < current_time - all_zero_start < 3.2:
                    print(f"  WARN: all uniforms at 0.0 -> audio thread may have crashed", flush=True)
            else:
                all_zero_start = None

            # Auto-exit after 5 seconds if no key pressed
            if elapsed > 5 and not key_pressed:
                if check_key():
                    msvcrt.getch()  # Consume the key
                    key_pressed = True
                    print("\n[DEBUG] Key pressed, continuing...", flush=True)

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\n[DEBUG] Stopped by user", flush=True)

    # Cleanup
    stream.stop()
    stream.close()
    if hand_tracker:
        hand_tracker.stop()
    if spotify:
        spotify.stop_polling()

    print("[DEBUG] Cleanup complete", flush=True)


class AudioVisualizer(mglw.WindowConfig):
    gl_version = (3, 3)
    title = "Synesthesia Visualizer"
    window_type = "pygame2"
    aspect_ratio = None
    resizable = True
    vsync = True
    samples = 2

    # Command-line shader selection
    _initial_shader_index = None
    _initial_shader_name = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Load or create config
        self.config = self.load_config()

        # Get default window size from config
        visuals_config = self.config.get("visuals", {})
        self.default_width = visuals_config.get("default_width", 1280)
        self.default_height = visuals_config.get("default_height", 720)
        self.brightness = visuals_config.get("brightness", 1.0)
        self.show_lyrics = visuals_config.get("show_lyrics", False)
        self.debug_output = visuals_config.get("debug_output", False)
        palette_str = visuals_config.get("palette", "default")
        self.palette_map = {"default": 0, "warm": 1, "cool": 2, "neon": 3, "mono": 4}
        self.palette_names = ["default", "warm", "cool", "neon", "mono"]
        self.palette = self.palette_map.get(palette_str, 0)

        # Resize to default after window is created
        self.wnd.size = (self.default_width, self.default_height)

        # Disable ESC from quitting - we handle it ourselves
        self.wnd._exit_key = None

        # Track fullscreen state
        self.is_fullscreen = False

        # Audio parameters from config
        audio_config = self.config.get("audio", {})
        self.audio_gain = audio_config.get("gain", 2.5)
        self.bass_boost = audio_config.get("bass_boost", 1.0)
        self.mid_boost = audio_config.get("mid_boost", 1.0)
        self.treble_boost = audio_config.get("treble_boost", 1.0)
        self.smoothing_factor = audio_config.get("smoothing", 0.15)
        # Normalization divisors
        self.bass_divisor = audio_config.get("bass_divisor", 300)
        self.mid_divisor = audio_config.get("mid_divisor", 60)
        self.treble_divisor = audio_config.get("treble_divisor", 10)
        self.energy_divisor = audio_config.get("energy_divisor", 0.3)

        self.sample_rate = self.config.get("sample_rate", 44100)
        self.blocksize = self.config.get("blocksize", 2048)

        # Thread-safe audio data
        self.audio_lock = threading.Lock()
        self.bass = 0.0
        self.mid = 0.0
        self.treble = 0.0
        self.energy = 0.0

        # For console output every second
        self.last_print_time = 0.0
        self.print_interval = 1.0

        # Shader management
        self.shaders_dir = Path("shaders")
        self.available_shaders = self.load_shaders()
        self.current_shader_idx = 0

        # Handle shader selection (class variables or config)
        target_shader = None

        # Priority: class vars > config > default
        if AudioVisualizer._initial_shader_index is not None:
            idx = AudioVisualizer._initial_shader_index
            if 0 <= idx < len(self.available_shaders):
                self.current_shader_idx = idx
        elif AudioVisualizer._initial_shader_name is not None:
            target_shader = AudioVisualizer._initial_shader_name.lower()
        else:
            # Check config for default_shader
            default_shader = self.config.get("visuals", {}).get("default_shader")
            if default_shader:
                target_shader = default_shader.lower()

        if target_shader:
            for i, s in enumerate(self.available_shaders):
                if s.stem.lower() == target_shader:
                    self.current_shader_idx = i
                    break

        if not self.available_shaders:
            print("ERROR: No shaders found in shaders/ folder", flush=True)
            sys.exit(1)

        # Print startup message
        print("\n" + "=" * 50, flush=True)
        print("Synesthesia Visualizer", flush=True)
        print("=" * 50, flush=True)
        print("Controls:", flush=True)
        print("  F11 or Maximize = Toggle fullscreen", flush=True)
        print("  Double-click title bar = Fullscreen", flush=True)
        print("  ESC = Exit fullscreen (return to windowed)", flush=True)
        print("  Q or Ctrl+Q = Quit", flush=True)
        print("  LEFT/RIGHT arrows = Cycle shaders", flush=True)
        print("  UP/DOWN arrows = Cycle color palettes", flush=True)
        print("  B = Browse shaders from glslsandbox.com", flush=True)
        print("  D = Download a shader from glslsandbox.com", flush=True)
        print("=" * 50 + "\n", flush=True)

        print(f"Found {len(self.available_shaders)} shader(s)", flush=True)
        print(f"Default window size: {self.default_width}x{self.default_height}", flush=True)

        # Load initial shader (use the one we selected)
        self.load_shader(self.available_shaders[self.current_shader_idx])

        # Start audio capture in background thread
        self.start_audio()

        # Initialize text writers for overlays
        self.writer = TextWriter2D()  # For shader name
        self._last_shader_display_time = 0
        self._current_lyric = ""
        self._lyric_texture = None
        self._lyric_vao = None

        # Initialize Spotify client
        self.spotify = SpotifyClient(self.config)
        self.spotify.authenticate()
        if self.spotify.is_available():
            self.spotify.start_polling()

        # Initialize hand tracker
        self.hand_tracker = create_hand_tracker(self.config)
        if self.hand_tracker:
            self.hand_tracker.start()
            print("Hand tracking enabled", flush=True)

        # Set initial resolution uniform
        self.update_resolution()

    def load_config(self):
        """Load config from JSON or create with defaults"""
        config_path = Path("config.json")

        if not config_path.exists():
            default_config = {
                "device_index": 0,
                "sample_rate": 44100,
                "blocksize": 2048,
                "visuals": {
                    "default_width": 1280,
                    "default_height": 720,
                    "brightness": 1.0,
                    "palette": "default",
                    "debug_output": False
                },
                "audio": {
                    "gain": 1.5,
                    "bass_boost": 1.0,
                    "mid_boost": 1.0,
                    "treble_boost": 1.0,
                    "smoothing": 0.3
                }
            }
            with open(config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            print("\n" + "=" * 50, flush=True)
            print("config.json created with defaults", flush=True)
            print("Please check that device_index is correct for your mic", flush=True)
            print("Run 'python -m sounddevice' to list devices", flush=True)
            print("=" * 50 + "\n", flush=True)

        with open(config_path, 'r') as f:
            return json.load(f)

    def load_shaders(self):
        """Find all .frag shader files in shaders folder"""
        shaders = []
        if self.shaders_dir.exists():
            shaders = sorted(self.shaders_dir.glob("*.frag"))
        return shaders

    def load_shader(self, frag_path):
        """Load a fragment shader and its companion vertex shader"""
        vert_path = frag_path.with_suffix(".vert")

        if not vert_path.exists():
            print(f"ERROR: Vertex shader not found: {vert_path}", flush=True)
            return

        with open(vert_path, 'r') as f:
            vert_src = f.read()

        with open(frag_path, 'r') as f:
            frag_src = f.read()

        # Print fragment shader source to verify it's loaded
        print(f"Shader source length: {len(frag_src)} chars", flush=True)
        if "if (u_lyrics > 0.5)" in frag_src:
            print("  -> u_lyrics check FOUND in shader", flush=True)
        else:
            print("  -> WARNING: u_lyrics check NOT in shader!", flush=True)

        # Create program
        try:
            self.program = self.ctx.program(
                vertex_shader=vert_src,
                fragment_shader=frag_src,
            )
            # Check if u_lyrics is in the program
            if 'u_lyrics' in self.program:
                print(f"  -> u_lyrics uniform found", flush=True)
            else:
                print(f"  -> WARNING: u_lyrics uniform NOT FOUND", flush=True)
            self.current_shader_name = frag_path.stem
            self.shader_name_start_time = time.time()  # For fade-out
            print(f"Loaded shader: {self.current_shader_name}", flush=True)
            # Update window title to show shader name
            shader_num = self.current_shader_idx + 1
            total = len(self.available_shaders)
            self.wnd.title = f"Synesthesia [{shader_num}/{total}: {self.current_shader_name}]"
        except Exception as e:
            print(f"ERROR loading shader {frag_path}: {e}", flush=True)
            if hasattr(self, 'program'):
                return  # Keep previous shader
            else:
                sys.exit(1)

        # Create fullscreen quad
        quad = self.ctx.buffer(np.array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
             1.0,  1.0,
        ], dtype='f4'))

        self.vbo = quad
        self.vao = self.ctx.vertex_array(
            self.program,
            [(quad, '2f', 'in_vert')],
        )

        # Update resolution uniform for new shader
        self.update_resolution()

    def update_resolution(self):
        """Update the u_resolution uniform for current window size"""
        if hasattr(self, 'program'):
            if 'u_resolution' in self.program:
                width, height = self.wnd.size
                self.program['u_resolution'].value = (width, height)
            if 'u_palette' in self.program:
                self.program['u_palette'].value = self.palette

    def toggle_fullscreen(self):
        """Toggle between fullscreen and windowed mode"""
        self.is_fullscreen = not self.is_fullscreen
        self.wnd.fullscreen = self.is_fullscreen
        # Update resolution after fullscreen toggle
        self.update_resolution()
        mode = "fullscreen" if self.is_fullscreen else "windowed"
        print(f"Switched to {mode}", flush=True)

    def resize(self, width, height):
        """Handle window resize - update resolution uniform"""
        self.update_resolution()
        return super().resize(width, height)

    def browse_shaders(self):
        """Browse available shaders from glslsandbox.com"""
        print("\n" + "=" * 50, flush=True)
        print("GLSL Sandbox Shader Browser", flush=True)
        print("=" * 50, flush=True)

        # Fetch shader list from gallery
        shaders = shader_downloader.fetch_shader_list()
        if shaders:
            print(f"Found {len(shaders)} shaders in gallery", flush=True)
            print("First 10 shader IDs:", flush=True)
            for i, (sid, url) in enumerate(shaders[:10], 1):
                print(f"  {i}. {sid}: {url}", flush=True)
        else:
            # Fallback to example IDs
            examples = shader_downloader.get_example_shader_ids()
            print("Example shader IDs:", flush=True)
            for i, sid in enumerate(examples, 1):
                print(f"  {i}. {sid}", flush=True)

        print("\nTo download a shader:", flush=True)
        print("  1. Press D to download shader ID 109691", flush=True)
        print("  2. Or use Python console:", flush=True)
        print("     >>> import shader_downloader", flush=True)
        print("     >>> shader_downloader.download_and_save('SHADER_ID', 'shaders')", flush=True)
        print("=" * 50 + "\n", flush=True)

    def download_shader_interactive(self):
        """Download a shader from glslsandbox.com interactively"""
        print("\n" + "=" * 50, flush=True)
        print("Download Shader from glslsandbox.com", flush=True)
        print("=" * 50, flush=True)

        # Download an example shader
        shader_id = "109691"  # Good demo shader
        print(f"Downloading shader ID '{shader_id}'...", flush=True)

        frag_path = shader_downloader.download_and_save(shader_id, "shaders")

        if frag_path:
            print(f"Successfully downloaded: {frag_path.name}", flush=True)
            # Reload shaders
            self.available_shaders = self.load_shaders()
            print(f"Total shaders now: {len(self.available_shaders)}", flush=True)
            print("Use LEFT/RIGHT to find and select the new shader", flush=True)
        else:
            print("Failed to download shader", flush=True)

        print("=" * 50 + "\n", flush=True)

    def start_audio(self):
        """Start audio capture in background thread"""
        # List available audio devices
        try:
            devices = sd.query_devices()
            print("[AUDIO] Available input devices:", flush=True)
            if isinstance(devices, dict):
                # Single device
                print(f"  Device {devices['index']}: {devices['name']} (channels: {devices['max_input_channels']})", flush=True)
            else:
                # Multiple devices
                for i, dev in enumerate(devices):
                    if dev['max_input_channels'] > 0:
                        marker = " <-- USING THIS" if dev['index'] == self.config.get("device_index", 0) else ""
                        print(f"  Device {dev['index']}: {dev['name']} (channels: {dev['max_input_channels']}){marker}", flush=True)
        except Exception as e:
            print(f"[AUDIO] Could not query devices: {e}", flush=True)

        try:
            self.stream = sd.InputStream(
                device=self.config.get("device_index", 0),
                channels=1,
                samplerate=self.sample_rate,
                blocksize=self.blocksize,
                callback=self.audio_callback,
                dtype='float32'
            )
            self.stream.start()
            print(f"[AUDIO] Started using device {self.config.get('device_index', 0)}", flush=True)
        except Exception as e:
            print(f"ERROR starting audio: {e}", flush=True)
            print("Run 'python -m sounddevice' to list available devices", flush=True)
            sys.exit(1)

    def audio_callback(self, indata, frames, time_info, status):
        """Process audio in separate thread - callback from sounddevice"""
        if status:
            print(f"Audio status: {status}", flush=True)

        # Get mono audio (average if stereo)
        audio = indata[:, 0] if indata.ndim > 1 else indata

        # Compute FFT
        fft = np.fft.rfft(audio)
        magnitudes = np.abs(fft)

        # Frequency bins
        freqs = np.fft.rfftfreq(frames, 1.0 / self.sample_rate)

        # Define frequency ranges
        bass_mask = freqs < 200
        mid_mask = (freqs >= 200) & (freqs < 2000)
        treble_mask = freqs >= 2000

        # Compute band energies (normalized)
        bass_val = np.mean(magnitudes[bass_mask]) if bass_mask.any() else 0.0
        mid_val = np.mean(magnitudes[mid_mask]) if mid_mask.any() else 0.0
        treble_val = np.mean(magnitudes[treble_mask]) if treble_mask.any() else 0.0
        energy_val = np.sqrt(np.mean(audio ** 2))

        # Apply gain to FFT output before normalization
        bass_val *= self.audio_gain
        mid_val *= self.audio_gain
        treble_val *= self.audio_gain
        energy_val *= self.audio_gain

        # Normalize to 0-1 using configurable divisors
        bass_norm = np.clip(bass_val / self.bass_divisor, 0.0, 1.0)
        mid_norm = np.clip(mid_val / self.mid_divisor, 0.0, 1.0)
        treble_norm = np.clip(treble_val / self.treble_divisor, 0.0, 1.0)
        energy_norm = np.clip(energy_val / self.energy_divisor, 0.0, 1.0)

        # Apply band boosts after normalization
        bass_norm *= self.bass_boost
        mid_norm *= self.mid_boost
        treble_norm *= self.treble_boost

        # Clamp after boosts
        bass_norm = np.clip(bass_norm, 0.0, 1.0)
        mid_norm = np.clip(mid_norm, 0.0, 1.0)
        treble_norm = np.clip(treble_norm, 0.0, 1.0)
        energy_norm = np.clip(energy_norm, 0.0, 1.0)

        # Apply smoothing (exponential moving average)
        with self.audio_lock:
            self.bass = self.bass * (1 - self.smoothing_factor) + bass_norm * self.smoothing_factor
            self.mid = self.mid * (1 - self.smoothing_factor) + mid_norm * self.smoothing_factor
            self.treble = self.treble * (1 - self.smoothing_factor) + treble_norm * self.smoothing_factor
            self.energy = self.energy * (1 - self.smoothing_factor) + energy_norm * self.smoothing_factor

    def on_key_event(self, key, action, modifiers):
        """Handle keyboard input"""
        keys = self.wnd.keys

        if action == keys.ACTION_PRESS:
            # Q or Ctrl+Q to quit
            if key == keys.Q:
                self.close()
            # F11 for fullscreen toggle
            elif key == keys.F11:
                self.toggle_fullscreen()
            # ESC to exit fullscreen (not quit)
            elif key == keys.ESCAPE:
                if self.is_fullscreen:
                    self.toggle_fullscreen()
                # In windowed mode, ESC does nothing
            elif key == keys.LEFT:
                # Cycle to previous shader
                self.current_shader_idx = (self.current_shader_idx - 1) % len(self.available_shaders)
                self.load_shader(self.available_shaders[self.current_shader_idx])
            elif key == keys.RIGHT:
                # Cycle to next shader
                self.current_shader_idx = (self.current_shader_idx + 1) % len(self.available_shaders)
                self.load_shader(self.available_shaders[self.current_shader_idx])
            elif key == keys.UP:
                # Cycle to next palette
                self.palette = (self.palette + 1) % 5
                print(f"Palette: {self.palette_names[self.palette]}", flush=True)
                self.update_resolution()
            elif key == keys.DOWN:
                # Cycle to previous palette
                self.palette = (self.palette - 1) % 5
                print(f"Palette: {self.palette_names[self.palette]}", flush=True)
                self.update_resolution()
            elif key == keys.B:
                # Browse shaders - show available shaders from glslsandbox.com
                self.browse_shaders()
            elif key == keys.D:
                # Download shader from glslsandbox.com
                self.download_shader_interactive()

    def mouse_press_event(self, x, y, button):
        """Handle mouse press - detect double-click for fullscreen"""
        # Button 1 is left click
        if button == 1:
            # Check if this is a double-click (clicked twice quickly)
            current_time = time.time()
            if hasattr(self, 'last_click_time'):
                if current_time - self.last_click_time < 0.5:
                    # Double click - toggle fullscreen
                    if not self.is_fullscreen:
                        self.toggle_fullscreen()
                    self.last_click_time = 0  # Reset to prevent triple-click
                    return
            self.last_click_time = current_time

    def window_maximized_event(self):
        """Handle maximize button - enter fullscreen"""
        if not self.is_fullscreen:
            self.toggle_fullscreen()

    def on_render(self, time_value, frame_time):
        """Main render loop - called every frame"""
        # Get audio values from mic (thread-safe)
        with self.audio_lock:
            mic_bass = self.bass
            mic_mid = self.mid
            mic_treble = self.treble
            mic_energy = self.energy

        # Get Spotify audio values if available
        spotify_values = {"bass": 0, "mid": 0, "treble": 0, "energy": 0}
        spotify_active = False
        if hasattr(self, 'spotify') and self.spotify.is_available() and self.spotify.is_playing:
            spotify_values = self.spotify.get_spotify_audio_values()
            spotify_active = True

        # Blend mic and Spotify values (Spotify boosts when playing)
        # Use max of mic and spotify to make Spotify's energy more impactful
        bass = max(mic_bass, spotify_values["bass"] * 1.2)
        mid = max(mic_mid, spotify_values["mid"] * 1.2)
        treble = max(mic_treble, spotify_values["treble"] * 1.2)
        energy = max(mic_energy, spotify_values["energy"] * 1.2)

        # Determine which source is dominating for debug
        dominant = "MIC"
        if spotify_active:
            if spotify_values["bass"] * 1.2 > mic_bass:
                dominant = "SPOTIFY"

        # Clamp to 0-1
        bass = min(1.0, bass)
        mid = min(1.0, mid)
        treble = min(1.0, treble)
        energy = min(1.0, energy)

        # Print values every second for debugging (only if debug_output enabled)
        current_time = time.time()
        if self.debug_output and current_time - self.last_print_time >= self.print_interval:
            mic_str = f"MIC: B={mic_bass:.2f} M={mic_mid:.2f} T={mic_treble:.2f} E={mic_energy:.2f}"
            if spotify_active:
                spotify_str = f" | SPOTIFY: B={spotify_values['bass']:.2f} M={spotify_values['mid']:.2f} T={spotify_values['treble']:.2f} E={spotify_values['energy']:.2f} [{dominant}]"
            else:
                spotify_str = " | SPOTIFY: inactive"
            shader_name = getattr(self, 'current_shader_name', 'unknown')
            print(f"[{shader_name}] {mic_str}{spotify_str}", flush=True)
            self.last_print_time = current_time

        # Apply brightness to energy
        effective_energy = energy * self.brightness

        # Determine if lyrics should be shown (must be outside program block for access)
        lyric_active = 0.0
        if (self.show_lyrics and
            hasattr(self, 'spotify') and
            self.spotify.is_available() and
            self.spotify.is_playing and
            len(self.spotify.lyrics) > 0):
            lyric_active = 1.0

        # Set uniforms (with safe checks for each uniform)
        if hasattr(self, 'program'):
            if 'u_time' in self.program:
                self.program['u_time'].value = time_value
            if 'u_bass' in self.program:
                self.program['u_bass'].value = bass
            if 'u_mid' in self.program:
                self.program['u_mid'].value = mid
            if 'u_treble' in self.program:
                self.program['u_treble'].value = treble
            if 'u_energy' in self.program:
                self.program['u_energy'].value = effective_energy

            if 'u_lyrics' in self.program:
                self.program['u_lyrics'].value = lyric_active

            # Pass palette if shader supports it
            if 'u_palette' in self.program:
                self.program['u_palette'].value = self.palette

            # Pass hand tracking data if available
            if hasattr(self, 'hand_tracker') and self.hand_tracker:
                hand_x, hand_y, hand_present = self.hand_tracker.get_position()
                if 'u_hand_x' in self.program:
                    self.program['u_hand_x'].value = hand_x
                if 'u_hand_y' in self.program:
                    self.program['u_hand_y'].value = hand_y
                if 'u_hand_present' in self.program:
                    self.program['u_hand_present'].value = hand_present

            # Render fullscreen quad
            self.ctx.clear(0, 0, 0, 1)
            self.vao.render(moderngl.TRIANGLE_STRIP)

        # Render shader name overlay with fade-out
        self.render_shader_name(current_time)

        # Render lyrics text overlay if active
        if lyric_active > 0.5:
            self.render_lyrics(current_time)

    def render_shader_name(self, current_time):
        """Render shader name briefly - lyrics handled by shader"""
        width, height = self.wnd.size

        # Brief shader name flash
        if hasattr(self, 'shader_name_start_time'):
            elapsed = current_time - self.shader_name_start_time
            if elapsed <= 0.8:
                shader_num = self.current_shader_idx + 1
                total = len(self.available_shaders)
                text = f"{shader_num}/{total}"
                try:
                    self.writer.text = text
                    size = int(16 * min(1.0, width / 1280))
                    self.writer.draw((15, height - 20), size=size)
                except Exception:
                    pass

    def render_lyrics(self, current_time):
        """Render current lyric line at bottom of screen"""
        width, height = self.wnd.size

        # Get current lyric from Spotify
        lyric_line = ""
        if (hasattr(self, 'spotify') and
            self.spotify.is_available() and
            len(self.spotify.lyrics) > 0):
            lyric_line = self.spotify.get_current_lyric() or ""

        # Update texture if lyric changed
        texture_needs_update = (lyric_line != self._current_lyric)
        self._current_lyric = lyric_line

        # Render lyric text using pygame (with glow effect)
        if self._current_lyric and len(self._current_lyric) > 0:
            try:
                # Initialize pygame font if needed
                if not hasattr(self, '_lyric_font'):
                    pygame.font.init()
                    self._lyric_font = pygame.font.Font(None, 56)

                # Render text with black outline for visibility against any background
                # First render black (shadow/outline)
                text_shadow = self._lyric_font.render(self._current_lyric, True, (0, 0, 0))
                # Then render white (main text)
                text_surface = self._lyric_font.render(self._current_lyric, True, (255, 255, 255))

                # Create a surface with both shadow and text
                final_surface = pygame.Surface((text_surface.get_width() + 4, text_surface.get_height() + 4), pygame.SRCALPHA)
                final_surface.blit(text_shadow, (2, 2))  # Shadow offset
                final_surface.blit(text_surface, (0, 0))   # Main text

                # Convert to RGBA texture
                texture_data = pygame.image.tostring(final_surface, "RGBA", True)
                tex_w, tex_h = final_surface.get_size()
                # Convert to RGBA texture
                texture_data = pygame.image.tostring(text_surface, "RGBA", True)
                tex_w, tex_h = text_surface.get_size()

                # Create or recreate texture if text changed
                if texture_needs_update or not hasattr(self, '_lyric_texture') or self._lyric_texture is None:
                    if hasattr(self, '_lyric_texture') and self._lyric_texture:
                        self._lyric_texture.release()
                    if hasattr(self, '_lyric_vao') and self._lyric_vao:
                        self._lyric_vao.release()
                    self._lyric_texture = self.ctx.texture((tex_w, tex_h), 4)
                    self._lyric_vao = None

                self._lyric_texture.write(texture_data)

                # Create texture program if needed
                if not hasattr(self, '_lyric_program'):
                    self._lyric_program = self.ctx.program(
                        vertex_shader='''
                            #version 330
                            in vec2 in_vert;
                            in vec2 in_uv;
                            out vec2 v_uv;
                            void main() {
                                gl_Position = vec4(in_vert, 0.0, 1.0);
                                v_uv = in_uv;
                            }
                        ''',
                        fragment_shader='''
                            #version 330
                            uniform sampler2D tex;
                            in vec2 v_uv;
                            out vec4 f_color;
                            void main() {
                                f_color = texture(tex, v_uv);
                            }
                        '''
                    )

                # Position at bottom center (in NDC)
                x_ndc = ((width // 2 - tex_w // 2) / width) * 2.0 - 1.0
                y_ndc = -1.0 + (60.0 / height) * 2.0  # 60 pixels from bottom
                w_ndc = tex_w / width * 2.0
                h_ndc = tex_h / height * 2.0

                # Create quad vertices (NDC)
                quad_data = np.array([
                    x_ndc, y_ndc, 0.0, 0.0,
                    x_ndc + w_ndc, y_ndc, 1.0, 0.0,
                    x_ndc, y_ndc + h_ndc, 0.0, 1.0,
                    x_ndc + w_ndc, y_ndc + h_ndc, 1.0, 1.0,
                ], dtype='f4')

                vbo = self.ctx.buffer(quad_data)
                if hasattr(self, '_lyric_vao') and self._lyric_vao:
                    self._lyric_vao.release()

                self._lyric_vao = self.ctx.vertex_array(
                    self._lyric_program,
                    [(vbo, '2f 2f', 'in_vert', 'in_uv')],
                )

                # Render with blending for transparency
                self.ctx.enable(moderngl.BLEND)
                self._lyric_texture.use(0)
                self._lyric_vao.render(moderngl.TRIANGLE_STRIP)

            except Exception as e:
                print(f"Lyrics render error: {e}", flush=True)

            except Exception:
                pass

    def close(self):
        """Clean exit"""
        if hasattr(self, 'stream'):
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
        if hasattr(self, 'spotify'):
            self.spotify.stop_polling()
        if hasattr(self, 'hand_tracker') and self.hand_tracker:
            self.hand_tracker.stop()
        self.wnd.close()


def load_config():
    """Load config from JSON or create with defaults"""
    config_path = Path("config.json")

    if not config_path.exists():
        default_config = {
            "device_index": 0,
            "sample_rate": 44100,
            "blocksize": 2048,
            "visuals": {
                "default_width": 1280,
                "default_height": 720,
                "brightness": 1.0,
                "palette": "default",
                "debug_output": False
            },
            "audio": {
                "gain": 1.5,
                "bass_boost": 1.0,
                "mid_boost": 1.0,
                "treble_boost": 1.0,
                "smoothing": 0.3
            }
        }
        with open(config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
        print("\n" + "=" * 50, flush=True)
        print("config.json created with defaults", flush=True)
        print("Please check that device_index is correct for your mic", flush=True)
        print("Run 'python -m sounddevice' to list available devices", flush=True)
        print("=" * 50 + "\n", flush=True)

    with open(config_path, 'r') as f:
        return json.load(f)


if __name__ == "__main__":
    # Quick check for --debug flag before moderngl imports
    debug_mode = "--debug" in sys.argv

    if debug_mode:
        config = load_config()
        run_debug_mode(config)
    else:
        # Start in windowed mode - moderngl-window handles its own args
        mglw.run_window_config(AudioVisualizer)
