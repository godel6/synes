"""
Hand Tracking Module
Uses MediaPipe to detect hand position from webcam.
Runs in a separate thread to avoid blocking the render loop.
"""

import threading
import time
import numpy as np

# MediaPipe imports - using the new tasks API
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2


class HandTracker:
    """
    Hand tracker using MediaPipe Hands.
    Runs detection in a separate thread.
    """

    def __init__(self, camera_index=0, smoothing=0.3):
        """
        Initialize the hand tracker.

        Args:
            camera_index: Index of the camera to use (0 = default webcam)
            smoothing: Smoothing factor for hand position (0.0-1.0, higher = smoother)
        """
        self.camera_index = camera_index
        self.smoothing = smoothing

        # Thread-safe hand data
        self.hand_lock = threading.Lock()
        self.hand_x = 0.5  # Default to center (0.0-1.0)
        self.hand_y = 0.5
        self.hand_present = 0.0  # 0.0 = no hand, 1.0 = hand detected

        # Internal tracking
        self._running = False
        self._thread = None
        self._hand_landmarker = None

    def start(self):
        """Start the hand tracking thread."""
        if self._running:
            return

        # Initialize MediaPipe HandLandmarker
        base_options = python.BaseOptions(model_asset_path='hand_landmarker.task')
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=1,
            running_mode=vision.RunningMode.LIVE_STREAM,
            result_callback=self._on_result
        )
        self._hand_landmarker = vision.HandLandmarker.create_from_options(options)

        self._running = True
        self._thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self._thread.start()
        print("Hand tracking started", flush=True)

    def stop(self):
        """Stop the hand tracking thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        if self._hand_landmarker:
            self._hand_landmarker.close()
        print("Hand tracking stopped", flush=True)

    def get_position(self):
        """
        Get the current hand position (thread-safe).

        Returns:
            tuple: (hand_x, hand_y, hand_present)
                - hand_x: X position 0.0-1.0 (left-right)
                - hand_y: Y position 0.0-1.0 (top-bottom)
                - hand_present: 0.0 if no hand, 1.0 if hand detected
        """
        with self.hand_lock:
            return self.hand_x, self.hand_y, self.hand_present

    def _on_result(self, result, output_image, timestamp_ms):
        """Callback for hand detection results."""
        if result and result.hand_landmarks:
            # Use the first hand detected
            landmarks = result.hand_landmarks[0]

            # Get palm center - use landmark 9 (middle finger MCP)
            # Landmark indices: 0=wrist, 4=thumb tip, 8=index tip, 12=middle tip, 16=ring tip, 20=pinky tip
            # 5=index MCP, 9=middle MCP, 13=ring MCP, 17=pinky MCP
            palm = landmarks[9]  # Middle finger MCP

            # Apply smoothing
            with self.hand_lock:
                # Smooth the position
                self.hand_x = self.hand_x * self.smoothing + palm.x * (1.0 - self.smoothing)
                self.hand_y = self.hand_y * self.smoothing + palm.y * (1.0 - self.smoothing)
                self.hand_present = 1.0
        else:
            # No hand detected - apply decay
            with self.hand_lock:
                self.hand_present = self.hand_present * 0.9

    def _tracking_loop(self):
        """Main tracking loop - runs in separate thread."""
        # Open webcam
        cap = cv2.VideoCapture(self.camera_index)

        if not cap.isOpened():
            print(f"ERROR: Could not open camera {self.camera_index}", flush=True)
            self._running = False
            return

        # Set lower resolution for faster processing
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        frame_count = 0

        while self._running:
            ret, frame = cap.read()
            if not ret:
                continue

            # Flip frame horizontally for mirror effect
            frame = cv2.flip(frame, 1)

            # Convert to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Create MediaPipe image
            mp_image = vision.Image(image_format=vision.ImageFormat.SRGB, data=rgb_frame)

            # Process frame asynchronously
            self._hand_landmarker.detect_async(mp_image, frame_count)
            frame_count += 1

            # Small sleep to prevent CPU hogging
            time.sleep(0.01)

        # Cleanup
        cap.release()


def create_hand_tracker(config):
    """
    Factory function to create a HandTracker from config.

    Args:
        config: Configuration dict with hand_tracking settings

    Returns:
        HandTracker instance or None if disabled
    """
    hand_config = config.get("hand_tracking", {})

    if not hand_config.get("enabled", True):
        return None

    camera_index = hand_config.get("camera_index", 0)
    smoothing = hand_config.get("smoothing", 0.3)

    return HandTracker(camera_index=camera_index, smoothing=smoothing)
