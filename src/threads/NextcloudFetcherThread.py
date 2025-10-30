import json
import os
import threading
import time
import uuid
import owncloud
from typing import TYPE_CHECKING
from datetime import datetime
from PIL import Image
from owncloud import FileInfo, ResponseError
from src.PrintJob import PrintJob

if TYPE_CHECKING:
    from src.PrintManager import PrintManager

class NextcloudFetcherThread(threading.Thread):
    IMAGES_FOLDER = "downloads/images/"
    METADATA_FOLDER = "downloads/metadata/"
    TEMP_FOLDER = "downloads/temp/"

    DELETE_METADATA_FILES = True

    def __init__(self, state: "PrintManager"):
        super().__init__(name="NextcloudFetcherThread")
        self.state = state
        self.config = state.config
        self.is_running = False

        self.oc = owncloud.Client("https://storage.canstein-berlin.de")

    def run(self):
        self.is_running = True
        self.oc.login(self.config.nc_username, self.config.nc_password)

        self._create_base_folders()
        self._clear_files_from_last_day(self.config.nc_images_folder)
        self._clear_files_from_last_day(self.config.nc_metadata_folder)

        while self.is_running:
            time.sleep(self.config.nc_check_time)
            self.fetch_files()

    def fetch_files(self):
        """
        Fetches all new files from the nextcloud.
        """
        self.state.log("Fetching files...")
        files = self.oc.list(self.config.nc_images_folder)
        if len(files) != 0: print("Files: " + str(files))
        for file in files:
            print("#####################################")
            name = file.get_name()
            print("File: " + str(name))
            if not name.endswith(".jpg") and not name.endswith(".png"):
                self.oc.delete(file)
                continue
            new_file_name = str(uuid.uuid4())

            # Download Image
            downloaded_image = self.download_image_to_png(file, new_file_name)
            if not self.oc.delete(file):
                self.state.log("Failed to delete file: " + str(file))

            metadata, nc_metadata_filename = self.check_and_download_metadata(file, new_file_name)
            if self.DELETE_METADATA_FILES and len(nc_metadata_filename) > 1: self.oc.delete(nc_metadata_filename)

            self.state.add_new_job(PrintJob(new_file_name, downloaded_image, metadata))

    def check_and_download_metadata(self, image_file: FileInfo, new_file_name: str) -> (dict, str):
        """
        Downloads the corresponding metadata file if it exists and parses it's content
        :param image_file: The image file that corresponds to the metadata file
        :param new_file_name:
        :return: Parsed Metadata
        """
        name_to_check_for = ".".join(image_file.get_name().split(".")[:-1]) + ".json"
        path_to_check_for = self.config.nc_metadata_folder + name_to_check_for

        print(path_to_check_for)

        if not self._file_exists(path_to_check_for): return {}, ""

        print("File Exists")

        self._download_file(path_to_check_for, new_file_name + ".json", self.METADATA_FOLDER)

        return self._parse_metadata(self.METADATA_FOLDER + new_file_name + ".json"), path_to_check_for


    def download_image_to_png(self, file: FileInfo, new_name: str) -> str:
        """
        Downloads an image file to the temp folder and converts it to PNG.
        The converted file will be saved under a new name in the images folder
        :param file: The Nextcloud file to download
        :param new_name: The new filename
        :return: The path to the downloaded image
        """
        if not os.path.exists(self.TEMP_FOLDER): os.makedirs(self.TEMP_FOLDER)

        self._download_file(file.path, file.get_name(), self.TEMP_FOLDER)
        image = Image.open(self.TEMP_FOLDER + file.get_name())
        image.save(self.IMAGES_FOLDER + new_name + ".png")
        os.remove(self.TEMP_FOLDER + file.get_name())
        return self.IMAGES_FOLDER + new_name + ".png"

    def _parse_metadata(self, metadata_file):
        if len(metadata_file) == 0: return {}
        try:
            with open(metadata_file, "r") as f:
                data = json.load(f)
                data["metadata_path"] = metadata_file
                return data
        except Exception as e:
            self.state.app.logger.exception("Error loading Metadata!, Skipping " + metadata_file)
        return {}

    def _download_file(self, file: FileInfo | str, filename: str, download_folder: str):
        self.state.log("Downloading file...")
        if not os.path.exists(download_folder):
            os.makedirs(download_folder)

        try:
            path = file
            if isinstance(file, FileInfo):
                path = file.path

            self.oc.get_file(path, download_folder + filename)
        except ResponseError as e:
            print(e)

    def _file_exists(self, filename):
        try:
            self.oc.file_info(filename)
            return True
        except owncloud.HTTPResponseError:
            return False

    def _create_base_folders(self):
        self.state.log("Creating base folders... " + str(threading.current_thread().ident))
        if not self._file_exists(self.config.nc_images_folder):
            self.oc.mkdir(self.config.nc_images_folder)
            self.state.log("Successfully created folder: " + self.config.nc_images_folder)

        if not self._file_exists(self.config.nc_metadata_folder):
            self.oc.mkdir(self.config.nc_metadata_folder)
            self.state.log("Successfully created folder: " + self.config.nc_metadata_folder)

    def _clear_files_from_last_day(self, folder: str):
        self.state.log("Clearing files from last day")
        files = self.oc.list(folder)
        for file in files:
            file_time = file.get_last_modified()
            adjusted_file_time = self._datetime_to_utc(file_time)
            current_time = datetime.now()
            if(current_time - adjusted_file_time).days >= 1:
                deleted = self.oc.delete(file)
                if deleted:
                    self.state.log("Deleted file: " + file.get_name())
                else: self.state.log("Error deleting file: " + file.get_name())

    def stop(self):
        self.is_running = False

    @staticmethod
    def _datetime_to_utc(utc_datetime):
        now_timestamp = time.time()
        offset = datetime.fromtimestamp(now_timestamp) - datetime.utcfromtimestamp(now_timestamp)
        return utc_datetime + offset