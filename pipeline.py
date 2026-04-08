import os
import re
from datetime import datetime
import time
import queue
import shutil
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import csv
from typing import List
import atexit
import logging
from logging.handlers import TimedRotatingFileHandler

from ocr import process_ocr
from cleanup import run_cleanup
import scanner_trigger
import config

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
def get_abs_path(relative_path):
    """Helper to ensure paths are always inside the project folder"""
    return os.path.join(BASE_DIR, relative_path)

def short_path(path):
    return os.path.relpath(path, BASE_DIR)

# folder paths
INCOMING_FOLDER = config.INCOMING_FOLDER
PROCESSING_FOLDER = config.PROCESSING_FOLDER
DONE_FOLDER = config.DONE_FOLDER
OUTPUT_FOLDER = config.OUTPUT_FOLDER
FAILED_FOLDER = config.FAILED_FOLDER
LOG_FOLDER = config.LOG_FOLDER

# recipes name
RECIPES_NAME = config.RECIPES_NAME
recipes_cache = []
recipes_last_modified = None

# create folders if not exist
folders = [INCOMING_FOLDER, PROCESSING_FOLDER, DONE_FOLDER, OUTPUT_FOLDER, FAILED_FOLDER, LOG_FOLDER]
for f in folders:
    os.makedirs(f, exist_ok=True)

# Configure logging
today = datetime.now().strftime("%Y_%m_%d")
log_base_path = os.path.join(LOG_FOLDER, "current.log")

def log_namer(default_name):
    """
    Transforms 'logs/current.log.2026_03_28' -> 'logs/2026_03_28.log'
    """
    # default_name is the path the logger generates automatically
    directory, filename = os.path.split(default_name)
    
    # Split by the dot added during rotation (current.log.YYYY_MM_DD)
    parts = filename.split('.')
    if len(parts) >= 3:
        date_part = parts[-1] # Extract YYYY_MM_DD
        return os.path.join(directory, f"{date_part}.log")
    return default_name

file_handler = TimedRotatingFileHandler(
    log_base_path, 
    when="midnight", 
    interval=1, 
    backupCount=config.RETENTION_DAYS, 
    encoding="utf-8"
)

# Apply the clean naming rule
file_handler.suffix = "%Y_%m_%d"
file_handler.namer = log_namer

# Configure the rest of the logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        file_handler,
        logging.StreamHandler()
    ],
    force=True
)

logger = logging.getLogger("MunchBox") # MunchBox can be changed to restaurant name. Be sure to change it in cleanup.py as well for consistency.


# Global variable
ocr_queue = queue.Queue() # initialize OCR task queue
observer = None
current_date = None
success_counter = 0 # For success ocr(CSV + Done), move processed image to scans/done
failed_counter = 0  # For blank or fail ocr, move failed image to scans/failed
retry_counts = {}
MAX_RETRIES = config.MAX_RETRIES

def initialize_counter(output_folder):
    global current_date, success_counter, failed_counter

    today = datetime.now().strftime("%Y_%m_%d")
    current_date = today

    success_counter = 0
    failed_counter = 0

    # 1. Initialize Success Counter (from output_csv)
    today_dir = os.path.join(output_folder, today)
    if os.path.exists(today_dir):
        for file in os.listdir(today_dir):
            # Find the highest number among "1.csv", "2.csv", etc.
            match = re.match(r"(\d+)\.csv$", file)
            if match:
                success_counter = max(success_counter, int(match.group(1)))

    # 2. Initialize Failed Counter (from scans/failed)
    failed_today_dir = os.path.join(FAILED_FOLDER, today)
    if os.path.exists(failed_today_dir):
        for file in os.listdir(failed_today_dir):
            match = re.match(r"(\d+)\.(png|jpg|jpeg)$", file)
            if match:
                failed_counter = max(failed_counter, int(match.group(1)))

def load_menu_names() -> List[str]:
    global recipes_cache, recipes_last_modified

    try:
        current_modified = os.path.getmtime(RECIPES_NAME)
    except FileNotFoundError:
        logger.warning("[WARNING] Recipe file not found. Using cached recipes.")
        return recipes_cache

    if recipes_last_modified != current_modified:
        logger.info("[RECIPES UPDATED] Reloading menu names...")

        for _ in range(3):
            try:
                recipes = []

                with open(RECIPES_NAME, "r", encoding="utf-8-sig") as f:
                    reader = csv.reader(f)

                    for row in reader:
                        if row:
                            recipes.append(row[0].strip())

                recipes_cache = recipes
                recipes_last_modified = current_modified
                break

            except Exception as e:
                logger.warning(f"[RETRY] Failed loading recipes: {e}")
                time.sleep(0.2)

    return recipes_cache

def wait_until_file_ready(path, delay=0.5,timeout=60):
    """
    Wait until scanner finishes writing the file.
    """
    last_size = -1
    start_time = time.time()

    while True:
        if time.time() - start_time > timeout:
            raise TimeoutError(f"File not ready after {timeout}s: {path}")

        current_size = os.path.getsize(path)

        if current_size == last_size and current_size > 0:
            return

        last_size = current_size
        time.sleep(delay)

def move_to_processing(path):
    filename = os.path.basename(path)
    new_path = os.path.join(PROCESSING_FOLDER, filename)

    shutil.move(path, new_path)

    return new_path

def move_to_done(path, counter):
    """Moves image to scans/done/YYYY_MM_DD/1.png"""
    today = datetime.now().strftime("%Y_%m_%d")
    target_dir = os.path.join(DONE_FOLDER, today)
    os.makedirs(target_dir, exist_ok=True)

    # Keep original extension (.png, .jpg, etc) but rename to counter
    ext = os.path.splitext(path)[1]
    new_name = f"{counter}{ext}"
    new_path = os.path.join(target_dir, new_name)

    shutil.move(path, new_path)
    return new_path

def move_to_failed(path, failed_counter):
    """Moves image to scans/failed/YYYY_MM_DD/1.png"""
    today = datetime.now().strftime("%Y_%m_%d")
    target_dir = os.path.join(FAILED_FOLDER, today)
    os.makedirs(target_dir, exist_ok=True)

    ext = os.path.splitext(path)[1]
    new_path = os.path.join(target_dir, f"{failed_counter}{ext}")

    shutil.move(path, new_path)
    return new_path

def retry_or_fail(path):
    global failed_counter
    if not os.path.exists(path):
        logger.info(f"[SKIP] File no longer exists: {short_path(path)}")
        retry_counts.pop(path, None)
        return
    
    count = retry_counts.get(path, 0) + 1
    retry_counts[path] = count

    if count <= MAX_RETRIES:
        logger.info(f"[RETRY {count}/{MAX_RETRIES}] Re-queueing {short_path(path)}")
        ocr_queue.put(path)
    else:
        failed_counter += 1
        logger.error(f"[FAILED PERMANENTLY] {short_path(path)}")
        move_to_failed(path, failed_counter)
        retry_counts.pop(path, None)

def get_next_success_receipt_filename(output_folder):
    global current_date, success_counter

    today = datetime.now().strftime("%Y_%m_%d")

    if current_date != today:
        current_date = today
        success_counter = 0

    next_success = success_counter + 1

    today_dir = os.path.join(output_folder, today)
    os.makedirs(today_dir, exist_ok=True)
    return os.path.join(today_dir, f"{next_success}.csv")

def get_next_failed_receipt_filename(failed_folder):
    global current_date, failed_counter

    today = datetime.now().strftime("%Y_%m_%d")

    if current_date != today:
        current_date = today
        failed_counter = 0

    next_fail = failed_counter + 1

    today_dir = os.path.join(failed_folder, today)
    os.makedirs(today_dir, exist_ok=True)
    return os.path.join(today_dir, f"{next_fail}.png")

def process_stuck_processing_files():
    """
    Re-queue files left in processing after crash/restart
    """
    for filename in os.listdir(PROCESSING_FOLDER):
        path = os.path.join(PROCESSING_FOLDER, filename)

        if os.path.isfile(path):
            logger.info(f"[RECOVER] Re-queueing stuck file: {short_path(path)}")
            ocr_queue.put(path)

def maintenance_loop():
    """
    Background thread that keeps the cleanup running 
    every 24 hours if the app is never closed.
    """
    while True:
        # run then wait 24 hours
        run_cleanup()
        time.sleep(86400) 

class ScanHandler(FileSystemEventHandler):
    def on_created(self, event):
        try:
            if event.is_directory:
                return

            # Ignore temp files from scanner_trigger.py
            if os.path.basename(event.src_path).startswith(".tmp_"):
                return

            if not event.src_path.lower().endswith(
                (".jpg", ".jpeg", ".png", ".pdf")
            ):
                return

            logger.info(f"[NEW FILE] {short_path(event.src_path)}")

            wait_until_file_ready(event.src_path)

            processing_path = move_to_processing(event.src_path)

            logger.info(f"[QUEUED] {short_path(processing_path)}")

            ocr_queue.put(processing_path)

        except Exception as e:
            logger.error(f"[WATCHER ERROR] {short_path(event.src_path)}: {e}")

def ocr_worker():
    global success_counter
    while True:
        file_path = ocr_queue.get()

        try:
            recipes_name = load_menu_names()

            logger.info(f"[OCR] Processing: {short_path(file_path)}")

            start_time = time.time()
            status, result = process_ocr(
                image=file_path,
                recipes_name=recipes_name,
            )
            duration = time.time() - start_time

            if status == 1:
                output_csv = get_next_success_receipt_filename(OUTPUT_FOLDER)
                with open(output_csv, 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.writer(f)
                    writer.writerow(['Quantity', 'Recipe Name'])
                    for qty, name in result:
                        writer.writerow([qty, name])

                logger.info(f"[SUCCESS] CSV saved: {short_path(output_csv)} - Processed in {duration:.2f} seconds.")
                retry_counts.pop(file_path, None)
                success_counter += 1
                move_to_done(file_path, success_counter)

            elif status == 2:
                logger.info(f"[NO TEXT DETECTED] {short_path(file_path)} - Processed in {duration:.2f} seconds.")
                retry_counts.pop(file_path, None)
                retry_or_fail(file_path)
            else:
                logger.error(f"[FAILED] OCR processing failed: {short_path(file_path)} - Processed in {duration:.2f} seconds.")
                retry_or_fail(file_path)

        except Exception as e:
            logger.exception(f"[CRITICAL ERROR] {short_path(file_path)}")
            retry_or_fail(file_path)

        finally:
            ocr_queue.task_done()

def process_existing_files():
    """
    Process old files already in incoming folder when system starts.
    """
    for filename in os.listdir(INCOMING_FOLDER):
        path = os.path.join(INCOMING_FOLDER, filename)

        if os.path.isfile(path):
            processing_path = move_to_processing(path)
            ocr_queue.put(processing_path)

def shutdown_handler():
    """This runs whenever the script exits (Normal, Ctrl+C, or Crash)"""
    global observer
    logger.info("[SHUTDOWN] MunchBox OCR Pipeline is closing safely.")
    
    if observer is not None:
        observer.stop()
        logger.info("[SHUTDOWN] Folder watcher stopped.")

def start_pipeline():
    global observer
    
    initialize_counter(OUTPUT_FOLDER)

    # Pass queue to scanner_trigger before starting thread
    scanner_trigger.set_queue(ocr_queue)


    # Starts the Arduino sensor listener
    threading.Thread(target=scanner_trigger.listen_for_trigger, daemon=True).start()

    # clean up thread
    threading.Thread(target=maintenance_loop, daemon=True).start()

    # Start worker thread
    threading.Thread(target=ocr_worker, daemon=True).start()

    # Process backlog files
    process_existing_files()
    process_stuck_processing_files()

    # Start folder watcher
    observer = Observer()
    observer.schedule(ScanHandler(), INCOMING_FOLDER, recursive=False)
    observer.start()

    today_str = datetime.now().strftime("%Y-%m-%d")
    logger.info(f"[START] OCR Pipeline started on {today_str}. Watching for new scans...")

    try:
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        logger.info("[USER SIGNAL] Ctrl+C detected. Shutting down...")

atexit.register(shutdown_handler)

if __name__ == "__main__":
    start_pipeline()