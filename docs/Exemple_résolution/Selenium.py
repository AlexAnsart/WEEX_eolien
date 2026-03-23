# -*- coding: utf-8 -*-
"""
Created on Fri Jan 28 14:06:47 2022

@author: REMY
"""

#### Importation Bibliothèque ####
from selenium import webdriver


#Déclencher le driver
driver = webdriver.Chrome(executable_path="chromedriver.exe")
driver.get("https://")

#Récupérer la barre de recherche
search_bar = driver.find_element_by_id("")
search_bar.send_keys("")

