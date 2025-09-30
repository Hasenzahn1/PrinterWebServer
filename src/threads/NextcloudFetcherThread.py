import json
import os
import threading
import time
import uuid
import owncloud

from datetime import datetime
from queue import Queue
from PIL import Image
from owncloud import FileInfo, ResponseError
from src.Config import Config


class NextcloudFetcherThread(threading.Thread):
    IMAGES_FOLDER = "../downloads/images/"
    METADATA_FOLDER = "../downloads/metadata/"
    TEMP_FOLDER = "../downloads/temp/"

    def __init__(self, config: Config, queue: Queue):
        super().__init__(name="NextcloudFetcherThread")
        self.config = config
        self.oc = owncloud.Client("https://storage.canstein-berlin.de")
        self.oc.login(config.nc_username, config.nc_password)

        self.is_running = True
        self.queue = queue

    def run(self):
        self.create_base_folders()
        self.clear_files_from_last_day(self.config.nc_images_folder)
        self.clear_files_from_last_day(self.config.nc_metadata_folder)

        while self.is_running:
            time.sleep(self.config.nc_check_time)
            self.fetch_files()

    def fetch_files(self):
        """
        Fetches all new files from the nextcloud.
        """
        print("Fetching files...")
        files = self.oc.list(self.config.nc_images_folder)
        for file in files:
            name = file.get_name()
            if not name.endswith(".jpg") and not name.endswith(".png"):
                self.oc.delete(file)
                continue

            new_file_name = str(uuid.uuid4())

            # Download Image
            downloaded_image = self.download_image_to_png(file, new_file_name)
            self.oc.delete(file)

            metadata, filename = self.check_and_download_metadata(file, new_file_name)
            metadata["metadata_path"] = filename

            self.queue.put({
                "image_path": downloaded_image,
                "metadata": metadata,
            })

    def check_and_download_metadata(self, image_file: FileInfo, new_file_name: str) -> (dict, str):
        """
        Downloads the corresponding metadata file if it exists and parses it's content
        :param image_file: The image file that corresponds to the metadata file
        :param new_file_name:
        :return: Parsed Metadata
        """
        name_to_check_for = image_file.get_name().split(".")[0] + ".json"
        path_to_check_for = self.config.nc_metadata_folder + name_to_check_for

        if not self.file_exists(path_to_check_for): return {}

        self.download_file(path_to_check_for, new_file_name + ".json", self.METADATA_FOLDER)

        return self.parse_metadata(self.METADATA_FOLDER + new_file_name + ".json"), self.METADATA_FOLDER + new_file_name + ".json"


    def download_image_to_png(self, file: FileInfo, new_name: str) -> str:
        """
        Downloads an image file to the temp folder and converts it to PNG.
        The converted file will be saved under a new name in the images folder
        :param file: The Nextcloud file to download
        :param new_name: The new filename
        :return: The path to the downloaded image
        """
        if not os.path.exists(self.TEMP_FOLDER): os.makedirs(self.TEMP_FOLDER)

        self.download_file(file.path, file.get_name(), self.TEMP_FOLDER)
        image = Image.open(self.TEMP_FOLDER + file.get_name())
        image.save(self.IMAGES_FOLDER + new_name + ".png")
        os.remove(self.TEMP_FOLDER + file.get_name())
        return self.IMAGES_FOLDER + new_name + ".png"

    def parse_metadata(self, metadata_file):
        if len(metadata_file) == 0: return {}
        try:
            with open(metadata_file, "r") as f:
                data = json.load(f)
                data["metadata_path"] = metadata_file
                return data
        except Exception as e:
            print("Error loading Metadata!, Skipping " + metadata_file)
        return {}

    def download_file(self, file: FileInfo|str, filename: str, download_folder: str):
        print("Downloading file...")
        if not os.path.exists(download_folder):
            os.makedirs(download_folder)

        try:
            path = file
            if isinstance(file, FileInfo):
                path = file.path

            self.oc.get_file(path, download_folder + filename)
        except ResponseError as e:
            print(e)

    def file_exists(self, filename):
        try:
            self.oc.file_info(filename)
            return True
        except owncloud.HTTPResponseError:
            return False

    def create_base_folders(self):
        print("Creating base folders...")
        if not self.file_exists(self.config.nc_images_folder):
            self.oc.mkdir(self.config.nc_images_folder)
            print("Successfully created folder: " + self.config.nc_images_folder)

        if not self.file_exists(self.config.nc_metadata_folder):
            self.oc.mkdir(self.config.nc_metadata_folder)
            print("Successfully created folder: " + self.config.nc_metadata_folder)

    def clear_files_from_last_day(self, folder: str):
        print("Clearing files from last day")
        files = self.oc.list(folder)
        for file in files:
            file_time = file.get_last_modified()
            adjusted_file_time = self.datetime_to_utc(file_time)
            current_time = datetime.now()
            if(current_time - adjusted_file_time).days >= 1:
                deleted = self.oc.delete(file)
                if deleted:
                    print("Deleted file: " + file.get_name())
                else: print("Error deleting file: " + file.get_name())

    def stop(self):
        self.is_running = False

    @staticmethod
    def datetime_to_utc(utc_datetime):
        now_timestamp = time.time()
        offset = datetime.fromtimestamp(now_timestamp) - datetime.utcfromtimestamp(now_timestamp)
        return utc_datetime + offset