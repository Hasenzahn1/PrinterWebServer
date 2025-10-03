import yaml

class Config:
    def __init__(self, file_path = "../config.yml"):
        with open(file_path) as file:
            yaml_file = yaml.safe_load(file)
            self.nc_username = yaml_file["nc_username"]
            self.nc_password = yaml_file["nc_password"]
            self.nc_images_folder = yaml_file["nc_images_folder"]
            self.nc_metadata_folder = yaml_file["nc_metadata_folder"]
            self.nc_check_time = yaml_file["nc_check_time"]

if __name__ == "__main__":
    config = Config()