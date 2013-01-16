#!/usr/bin/python

import sys, os, inspect, logging, re, json, codecs, traceback

from classpath import classPathHacker
from bing_api import *

class Translator:
    def __init__(self, cwd, clientid = client_id, clientsecret=client_secret):
        jarLoad = classPathHacker()
        mtjPath = os.path.join(cwd, "lib", "mtjapi-0.6.1-deps.jar")
        if os.path.exists(mtjPath):
            jarLoad.addFile(mtjPath)
            from com.memetix.mst.language import Language
            from com.memetix.mst.translate import Translate
            Translate.setClientId(clientid)
            Translate.setClientSecret(clientsecret)
            self.translator = Translate
            self.language = Language

    def setLanguages(self, out_dir, from_lang="Hebrew", lang_to="English"):
        from_lang = from_lang.upper()
        lang_to = lang_to.upper()
        self.from_lang = getattr(self.language, from_lang, "HEBREW")
        self.lang_to = getattr(self.language, lang_to, "ENGLISH")
        joint_lang = re.sub(r"\W+", '', from_lang + lang_to, flags=re.UNICODE)
        self.translate_file = os.path.join(out_dir, "translator" + joint_lang + ".cache")
        if os.path.exists(self.translate_file):
            with codecs.open(self.translate_file, 'r', encoding='utf-8') as f:
                self.translations = json.load(f)
        else:
            self.translations = {}

    def translate(self, text):
        try:
            if text not in self.translations:
                self.translations[text] = self.translator.execute(text, self.from_lang, self.lang_to)
                logging.info("translating {:} as {:}".format(word, self.translations[word]).encode('utf-8'))
            return self.translations[text]
        except:
            logging.error(traceback.format_exc())
            return ""

    def saveTranslations(self):
        with codecs.open(self.translate_file, 'w', encoding='utf-8') as f:
            json.dump(self.translations, f, indent=4)
