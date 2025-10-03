class Overlay:
    def __init__(self, file_path: str = "", name: str = "None"):
        self.file_path = file_path
        self.name = name

    def __str__(self):
        return f"Overlay(path='{self.file_path}', name='{self.name}')"