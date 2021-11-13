from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def initializeSelenium():
    # Load options
    chrome_options = Options()
    #chrome_options.add_argument("user-data-dir=/tmp/profile")
    chrome_options.add_extension("./extensions/metamask.crx")
    chrome_options.add_experimental_option('prefs', {'intl.accept_languages': 'en,en_US'})
    #chrome_options.add_argument("log-level=1")
    return webdriver.Chrome(executable_path='drivers/chromedriver',options=chrome_options)