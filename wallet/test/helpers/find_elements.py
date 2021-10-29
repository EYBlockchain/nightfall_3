
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By


class findElements:
    def __init__(self, wait):
        self.wait = wait 

    # search by xpath, use this ""!!!
    # new WebDriverWait(driver, 20).until(ExpectedConditions.elementToBeClickable(By.xpath("//button[@class='signup-button' and text()='Get Started!']"))).click();
    def element_exist_xpath(self, xpath, wait = None):
        if wait is None:
             wait = self.wait
        try:
            return wait.until(EC.presence_of_element_located((By.XPATH, xpath)))
        except TimeoutException:
            return False

    def button_clickable_xpath(self, xpath, wait = None):
        if wait is None:
             wait = self.wait
        try:
            return wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
        except TimeoutException:
            return False


    #new WebDriverWait(driver, 20).until(ExpectedConditions.elementToBeClickable(By.cssSelector("button.signup-button"))).click();
    #EC.presence_of_element_located((By.CSS_SELECTOR, ".ng-binding.ng-scope")))
    def element_exist_css(self, css, wait = None):
        if wait is None:
             wait = self.wait
        try:
            return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, css)))
        except TimeoutException:
            return False
        
    def element_exist_class(self, className, wait = None):
        if wait is None:
             wait = self.wait
        try:
            return wait.until(EC.visibility_of_all_elements_located((By.CLASS_NAME, className)))
        except TimeoutException:
            return False
