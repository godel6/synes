"""
Shader Downloader Utility
Downloads and adapts shaders from glslsandbox.com
Run from project root: python -m utils.shader_downloader
"""

import re
import os
from pathlib import Path
import requests

GLSL_SANDBOX_BASE = "https://glslsandbox.com"


def fetch_shader_list(page=0):
    """
    Fetch shader IDs from a specific page of glslsandbox.com gallery.

    Args:
        page: Page number (0, 1, 2, etc.)

    Returns:
        list: List of (shader_id, shader_url) tuples
    """
    if page == 0:
        url = GLSL_SANDBOX_BASE
    else:
        url = f"{GLSL_SANDBOX_BASE}/?page={page}"

    print(f"Fetching page {page}: {url}", flush=True)

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # Parse shader IDs from the page
        # They appear as /e#XXXXX references
        pattern = r'/e#(\d+)'
        matches = re.findall(pattern, response.text)

        # Remove duplicates
        shader_ids = list(set(matches))
        shader_ids.sort()

        # Create tuples with (id, url)
        shaders = [(sid, f"{GLSL_SANDBOX_BASE}/e#{sid}") for sid in shader_ids]

        print(f"  Found {len(shaders)} shaders", flush=True)
        return shaders

    except requests.RequestException as e:
        print(f"Error fetching page {page}: {e}", flush=True)
        return []


def fetch_all_shader_ids(max_pages=10):
    """
    Fetch all shader IDs from all available pages.

    Args:
        max_pages: Maximum number of pages to check

    Returns:
        list: List of unique shader IDs
    """
    all_ids = set()

    for page in range(max_pages):
        shaders = fetch_shader_list(page)
        if not shaders:
            print(f"No more shaders found after page {page-1}", flush=True)
            break

        # Check for new IDs
        new_ids = {sid for sid, _ in shaders}
        all_ids.update(new_ids)
        print(f"  Running total: {len(all_ids)} unique shaders", flush=True)

    return sorted(all_ids)


def download_shader(shader_id_or_url):
    """
    Download a shader from glslsandbox.com by ID or URL.
    Uses the API endpoint /item/{id}.0 to get actual shader code.

    Args:
        shader_id_or_url: Shader ID (e.g., "370395") or full URL

    Returns:
        tuple: (shader_id, shader_source) or (None, None) on failure
    """
    import json

    # Extract shader ID
    if shader_id_or_url.startswith("http"):
        if "/e#" in shader_id_or_url:
            shader_id = shader_id_or_url.split("/e#")[-1].split("/")[0]
        else:
            shader_id = shader_id_or_url
    else:
        shader_id = shader_id_or_url.strip()

    # Remove .0 suffix if present (we'll add it)
    if shader_id.endswith('.0'):
        shader_id = shader_id[:-2]

    # Use the API endpoint to get actual shader code
    url = f"{GLSL_SANDBOX_BASE}/item/{shader_id}.0"
    print(f"Downloading: {url}", flush=True)

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # Parse JSON response
        data = response.json()
        shader_source = data.get('code', '')

        if not shader_source:
            print(f"  No shader code in response", flush=True)
            return None, None

        # Get title/name if available
        shader_name = data.get('name', f"shader_{shader_id}")

        return shader_id, shader_source

    except requests.RequestException as e:
        print(f"  Error: {e}", flush=True)
        return None, None
    except json.JSONDecodeError as e:
        print(f"  JSON Error: {e}", flush=True)
        return None, None


def convert_shader(source, shader_id):
    """
    Convert a glslsandbox shader to work with our visualizer.

    We'll use compatibility mode - keep gl_FragColor and don't force version.
    This avoids GLSL version conflicts with reserved keywords like 'smooth'.
    """
    # Build header with uniforms - use compatibility style
    header = f"""// Auto-converted from glslsandbox.com (ID: {shader_id})
// Adapted for Synesthesia Visualizer

#ifdef GL_ES
precision mediump float;
#endif

// Our app's uniforms
uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_lyrics;
uniform float u_palette;
uniform vec2 u_resolution;

// Aliases for glslsandbox compatibility
#define time u_time
#define resolution u_resolution
#define mouse vec2(0.5)

// Audio-reactive values (can be used in shaders)
float bass = u_bass;
float mid = u_mid;
float treble = u_treble;
float energy = u_energy;

"""

    # Process the original shader source
    # Remove version directive (causes conflicts)
    source = re.sub(r'#version\s+\d+\s*\w*\n', '', source)
    # Remove extensions we don't need
    source = re.sub(r'#extension.*\n', '', source)
    source = re.sub(r'#ifdef GL_ES.*?#endif\s*', '', source, flags=re.DOTALL)
    source = re.sub(r'precision\s+(highp|mediump|lowp)\s+float;?\n?', '', source)

    # Remove duplicate defines we might add
    source = re.sub(r'#define time.*\n', '', source)
    source = re.sub(r'#define resolution.*\n', '', source)

    # Remove duplicate uniform declarations
    source = re.sub(r'uniform\s+float\s+time;\s*\n', '', source)
    source = re.sub(r'uniform\s+vec2\s+resolution;\s*\n', '', source)
    source = re.sub(r'uniform\s+vec2\s+mouse;\s*\n', '', source)

    # Fix deprecated keywords (varying -> in)
    source = re.sub(r'varying\s+', 'in ', source)
    source = re.sub(r'attribute\s+', 'in ', source)

    # Keep gl_FragColor as-is (works in compatibility mode)
    # Don't convert to f_color

    return header + source


def save_shader(shader_id, shader_source, shaders_dir="shaders"):
    """
    Save a shader to the shaders directory.
    """
    safe_name = f"glsl_{shader_id}"
    frag_path = Path(shaders_dir) / f"{safe_name}.frag"

    if frag_path.exists():
        print(f"  Already exists: {frag_path.name}", flush=True)
        return frag_path

    try:
        with open(frag_path, 'w', encoding='utf-8') as f:
            f.write(shader_source)
        print(f"  Saved: {frag_path.name}", flush=True)
        return frag_path
    except IOError as e:
        print(f"  Error saving: {e}", flush=True)
        return None


def download_and_save(shader_id_or_url, shaders_dir="shaders"):
    """
    Complete workflow: download and save a shader.
    """
    shader_id, shader_source = download_shader(shader_id_or_url)
    if shader_source is None:
        return None

    converted_source = convert_shader(shader_source, shader_id)
    return save_shader(shader_id, converted_source, shaders_dir)


def download_all_shaders(shaders_dir="shaders", max_pages=10):
    """
    Download all available shaders from glslsandbox.com.

    Args:
        shaders_dir: Directory to save shaders
        max_pages: Maximum pages to fetch

    Returns:
        tuple: (success_count, fail_count)
    """
    import time

    print("=" * 50, flush=True)
    print("Fetching all shader IDs...", flush=True)

    all_ids = fetch_all_shader_ids(max_pages)
    print(f"Total unique shaders found: {len(all_ids)}", flush=True)
    print("=" * 50, flush=True)

    success = 0
    failed = 0

    for i, shader_id in enumerate(all_ids, 1):
        print(f"[{i}/{len(all_ids)}] Downloading {shader_id}...", end=' ', flush=True)

        try:
            result = download_and_save(shader_id, shaders_dir)
            if result:
                success += 1
            else:
                failed += 1
        except Exception as e:
            print(f"ERROR: {e}", flush=True)
            failed += 1

        time.sleep(0.2)  # Rate limiting

    print("=" * 50, flush=True)
    print(f"Done! Success: {success}, Failed: {failed}", flush=True)
    return success, failed


if __name__ == "__main__":
    import sys

    # Change to project root if running from utils/
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)

    print("GLSL Sandbox Shader Downloader", flush=True)
    print("=" * 50, flush=True)

    # Download all shaders
    download_all_shaders("shaders", max_pages=10)

    print("\nCreating vertex files for new shaders...", flush=True)
    shaders_dir = Path("shaders")
    template = shaders_dir / "template.vert"

    if template.exists():
        for frag in shaders_dir.glob("glsl_*.frag"):
            vert = frag.with_suffix(".vert")
            if not vert.exists():
                import shutil
                shutil.copy(template, vert)
        print("Done!", flush=True)
