import logging
import colorama
from colorama import Fore, Style

PRINT_EXCEPTIONS=True

class walletTest:
  """wallet Test class
  """
  def __init__(self, findElementsInstance, driver, metamaskTab, nightfallTab, tests):
    self.findElementsInstance = findElementsInstance
    self.driver = driver
    self.metamaskTab = metamaskTab
    self.nightfallTab = nightfallTab
    self.tests = tests
    self.results = []

    self.startTests()

  def startTests(self):
    for test in self.tests:
      print("Test: " + test['name'].__name__ )
      print(test['description'])
      try:
        self.results.append(test['name'](self.findElementsInstance, self.driver, self.metamaskTab, self.nightfallTab))
        if self.results[-1] is None:
          self.results[-1] = "PASSED\n"
        if self.results[-1].startswith("PASSED"):
          print(Fore.GREEN + "Result: PASSED\n")
        elif self.results[-1].startswith("FAILED"):
          print(Fore.RED + "Result: FAILED\n")
        else:
          print(Fore.BLUE + "Result: " + self.results[-1])
      except Exception as e:
        if PRINT_EXCEPTIONS:
          print("Exception",e)
        print(Fore.RED + "Result: FAILED\n")
      print(Style.RESET_ALL)

  def printResults(self):
    for idx, test in enumerate(self.tests):
      str = "Test Name: " + test['name'] + " => Result: " + self.results[idx]
      print(str)
