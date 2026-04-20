import serial
import subprocess
import time
import logging
import os
import config

logger = logging.getLogger("MunchBox")

# --- CONFIGURE THESE ---
SERIAL_PORT = "/dev/ttyACM0"
BAUD_RATE = 9600
INCOMING_FOLDER = config.INCOMING_FOLDER
# -----------------------

receipt_counter = 0
_ocr_queue = None

def set_queue(q):
    global _ocr_queue
    _ocr_queue = q

def trigger_scan():
    global receipt_counter
    receipt_counter += 1

    logger.info(f"[SCANNER] Receipt #{receipt_counter} detected — waiting for paper to load...")
    time.sleep(1)

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"scan_{timestamp}.png"
    temp_path = os.path.join(INCOMING_FOLDER, f".tmp_{filename}")
    final_path = os.path.join(INCOMING_FOLDER, filename)

    logger.info(f"[SCANNER] Receipt #{receipt_counter} triggering scan...")

    try:
        result = subprocess.run([
            "scanimage",
            "--device-name=brother5:bus1;dev3",
            "--format=png",
            "--resolution=300",
            "--AutoDocumentSize=yes",
            "-x", "80",
            "-y", "355.567",
            f"--output-file={temp_path}"
        ], capture_output=True, text=True, timeout=60)

        if result.returncode == 0 or "rounded value" in result.stderr:
            os.rename(temp_path, final_path)
            logger.info(f"[SCANNER] Receipt #{receipt_counter} scan saved: {final_path}")
            if _ocr_queue:
                _ocr_queue.put(final_path)
        else:
            logger.error(f"[SCANNER] Receipt #{receipt_counter} scan failed: {result.stderr.strip()}")
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except subprocess.TimeoutExpired:
        logger.error(f"[SCANNER] Receipt #{receipt_counter} scan timed out.")
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except FileNotFoundError:
        logger.error("[SCANNER] 'scanimage' not found. Install with: sudo apt install sane-utils")

def listen_for_trigger():
    logger.info(f"[SENSOR] Listening on {SERIAL_PORT} at {BAUD_RATE} baud...")

    while True:
        try:
            with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1) as ser:
                logger.info("[SENSOR] Serial connection established.")
                while True:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if line.startswith("TRIGGERED"):
                        logger.info(f"[SENSOR] Beam broken — receipt #{receipt_counter + 1} incoming!")
                        trigger_scan()
                        ser.reset_input_buffer()

        except serial.SerialException as e:
            logger.error(f"[SENSOR] Serial error: {e}. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            logger.error(f"[SENSOR] Unexpected error: {e}. Retrying in 5s...")
            time.sleep(5)

if __name__ == "__main__":
    listen_for_trigger()