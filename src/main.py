from queue import Queue

from src.threads.NextcloudFetcherThread import NextcloudFetcherThread
from Config import Config


queue = Queue()

config = Config("../config.yml")
fetcher = NextcloudFetcherThread(config, queue)
fetcher.start()

while True:
    item = queue.get()
    print(item)

