# Synesthesia Visualizer

A fullscreen audio visualizer that captures microphone input and renders reactive visuals using ModernGL shaders.

## Features

- Real-time FFT audio analysis
- Extracts bass (0-200Hz), mid (200-2000Hz), treble (2000Hz+) frequency bands
- Smooth normalization to prevent flickering
- ModernGL-powered rendering with custom GLSL shaders
- Resizable window with proper aspect ratio handling
- Multiple fullscreen toggle methods

## Requirements

- Python 3.8+
- A working microphone

## Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. (Optional) Check your audio device index:

```bash
python -m sounddevice
```

This will list available audio devices. Note the index of your microphone.

3. Configure your device (if not using default):

Edit `config.json` and set `device_index` to your microphone's index.

## Usage

Run the visualizer:

```bash
python main.py
```

The app starts in windowed mode at 1280x720 (configurable in config.json).

### Controls

| Key | Action |
|-----|--------|
| **F11** | Toggle fullscreen |
| **Maximize button** | Enter fullscreen |
| **Double-click title bar** | Enter fullscreen |
| **ESC** | Exit fullscreen (return to windowed) |
| **Q** or **Ctrl+Q** | Quit application |
| **LEFT/RIGHT arrows** | Cycle through shaders |
| **UP/DOWN arrows** | Cycle through color palettes |

## Configuration

Edit `config.json` to customize:

```json
{
  "device_index": 0,
  "sample_rate": 44100,
  "blocksize": 2048,
  "visuals": {
    "default_width": 1280,
    "default_height": 720
  }
}
```

- `device_index`: Audio input device (0 = default)
- `sample_rate`: Audio sample rate (44100 is standard)
- `blocksize`: Audio buffer size (smaller = faster, larger = more accurate)
- `visuals.default_width/height`: Default window size

## Available Shaders

The visualizer comes with 8 built-in shaders:

| # | Name | Description |
|---|------|-------------|
| 1 | aurora | Flowing northern lights effect |
| 2 | fractal_zoom | Zooming fractal patterns |
| 3 | plasma | Colorful flowing plasma |
| 4 | ripple_rings | Expanding concentric rings |
| 5 | star_field | Starfield with nebula background |
| 6 | torus_morph | Morphing torus shapes |
| 7 | tunnel_fractal | Fractal tunnel |
| 8 | waves | Ocean wave patterns |

## Custom Shaders

Add custom shaders to the `shaders/` folder:

- Each shader needs a `.frag` (fragment) and `.vert` (vertex) file
- Vertex shader should output a fullscreen quad with `v_uv` coordinates

### Available Uniforms

Shaders receive these uniforms:

| Uniform | Type | Description |
|---------|------|-------------|
| `u_time` | float | Elapsed time in seconds |
| `u_bass` | float | Bass level (0.0-1.0) |
| `u_mid` | float | Mid frequency level (0.0-1.0) |
| `u_treble` | float | Treble level (0.0-1.0) |
| `u_energy` | float | Overall audio energy (0.0-1.0) |
| `u_lyrics` | float | 1.0 if lyrics are displaying, 0.0 otherwise |
| `u_palette` | float | Color palette index (0-3) |
| `u_resolution` | vec2 | Window size in pixels (optional) |

### Color Palettes

The visualizer supports 4 color palettes:

| Index | Palette | Colors |
|-------|---------|--------|
| 0 | Default | Cyan / Pink |
| 1 | Warm | Orange / Red |
| 2 | Cool | Blue / Purple |
| 3 | Neon | Green / Purple |

Use `getNeonColor(u_palette)` helper function in your shader:

```glsl
vec3 getNeonColor(float idx) {
    if (idx < 0.5) return vec3(0.0, 1.0, 0.8);  // Cyan
    else if (idx < 1.5) return vec3(1.0, 0.0, 0.5);  // Pink
    else if (idx < 2.5) return vec3(0.3, 0.8, 1.0);  // Blue
    else return vec3(1.0, 0.2, 0.8);  // Purple
}
```

### Example Vertex Shader

```glsl
#version 330

in vec2 in_vert;
out vec2 v_uv;

void main() {
    v_uv = in_vert * 0.5 + 0.5;
    gl_Position = vec4(in_vert, 0.0, 1.0);
}
```

## Troubleshooting

### No audio input detected

- Check that your microphone is connected and working
- Run `python -m sounddevice` to verify device detection
- Update `config.json` with correct `device_index`

### Low frame rate

- Try reducing blocksize in `config.json` (smaller = faster but less accurate)
- Ensure hardware acceleration is enabled for OpenGL

## Spotify Integration (Optional)

The visualizer can display currently playing Spotify tracks and synced lyrics.

### Setup

1. **Create a Spotify Developer App**:
   - Go to [developer.spotify.com](https://developer.spotify.com/dashboard)
   - Log in and click "Create App"
   - Fill in the app name and description
   - Click "Edit Settings"
   - Add `http://localhost:8888/callback` to **Redirect URIs**
   - Save settings

2. **Get Credentials**:
   - From your app dashboard, copy the **Client ID**
   - Click "Show Client Secret" and copy the secret

3. **Configure the Visualizer**:
   Edit `config.json` and add your Spotify credentials:

   ```json
   "spotify": {
     "enabled": true,
     "client_id": "your_client_id_here",
     "client_secret": "your_client_secret_here",
     "redirect_uri": "http://localhost:8888/callback"
   }
   ```

4. **First Run**:
   Run `python main.py`. A browser window will open for Spotify login.
   - Log in and authorize the app
   - Tokens are saved to `.spotify_tokens.json`
   - You won't need to do this again

5. **Subsequent Runs**:
   The app starts silently with no browser. Lyrics appear automatically
   when playing a track that has lyrics on LRCLIB.net.

### How It Works

- Polls Spotify every 2 seconds for the currently playing track
- Fetches synced lyrics from LRCLIB.net
- Displays lyrics at the bottom of the screen
- Lyrics hide when paused, stopped, or unavailable
