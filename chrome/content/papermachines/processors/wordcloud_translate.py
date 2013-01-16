#!/usr/bin/env python2.7
import sys, os, logging, traceback, codecs, json
from lib.classpath import classPathHacker
from lib.bing_api import *
import wordcloud_large

class WordCloudTranslate(wordcloud_large.LargeWordCloud):
    """
    Generate large word cloud using Bing translation
    """
    def _basic_params(self):
        self.width = "960"
        self.height = "500"
        self.fontsize = "[10,72]"
        self.name = "wordcloud_translate"
        self.template_filename = os.path.join(self.cwd, "templates", "wordcloud_large.html")
        self.n = 150
        self.tfidf_scoring = self.named_args.get("tfidf", False)
        self.translate_file = os.path.join(self.out_dir, "translator.cache")
        if os.path.exists(self.translate_file):
            with codecs.open(self.translate_file, 'r', encoding='utf-8') as f:
                self.translations = json.load(f)
        else:
            self.translations = {}
        self.translator = None
        self.lang_from = self.named_args.get("lang_from", "he")
        self.lang_to = self.named_args.get("lang_to", "en")

    def _translate(self, text):
        return self.translator.execute(text, self.language.HEBREW, self.language.ENGLISH)

    def _init_translator(self, clientid, clientsecret):
        jarLoad = classPathHacker()
        mtjPath = os.path.join(self.cwd, "lib", "mtjapi-0.6.1-deps.jar")
        if os.path.exists(mtjPath):
            jarLoad.addFile(mtjPath)
            from com.memetix.mst.language import Language
            from com.memetix.mst.translate import Translate
            Translate.setClientId(clientid)
            Translate.setClientSecret(clientsecret)
            self.translator = Translate
            self.language = Language

    def process(self):
        logging.info("starting to process")

        self.template_filename = os.path.join(self.cwd, "templates", "wordcloud.html")

        logging.info("finding word frequencies")

        if self.tfidf_scoring:
            self._findTfIdfScores()
            freqs = self._topN(self.filtered_freqs)
        else:
            freqs = self._findWordFreqs(self.files)

        translator = None
        for item in freqs:
            word = item["text"]
            if word not in self.translations:
                if self.translator is None:
                    self._init_translator(client_id, client_secret)
                self.translations[word] = self._translate(word)
                logging.info("translating {:} as {:}".format(word, self.translations[word]).encode('utf-8'))
            item["text"] = self.translations[word]

        with codecs.open(self.translate_file, 'w', encoding='utf-8') as f:
            json.dump(self.translations, f, indent=4)

        params = {"DATA": json.dumps(freqs),
                "WIDTH": self.width,
                "HEIGHT": self.height,
                "FONTSIZE": self.fontsize
        }
        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = WordCloudTranslate(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())