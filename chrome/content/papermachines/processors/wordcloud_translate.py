#!/usr/bin/env python2.7
import sys, os, logging, traceback, codecs, json
from lib.translate import *
import wordcloud_large

class WordCloudTranslate(wordcloud_large.LargeWordCloud):
    """
    Generate large word cloud using Bing translation
    """
    def _basic_params(self):
        self.width = 960
        self.height = 500
        self.fontsize = [10,72]
        self.name = "wordcloud_translate"
        self.template_filename = os.path.join(self.cwd, "templates", "wordcloud_large.html")
        self.n = 150
        self.tfidf_scoring = self.named_args.get("tfidf", False)
        self.lang_from = self.named_args.get("lang_from", "Hebrew")
        self.lang_to = self.named_args.get("lang_to", "English")
        self.translator = Translator(self.cwd)
        self.translator.setLanguages(self.out_dir, self.lang_from, self.lang_to)

    def process(self):
        logging.info("starting to process")

        self.template_filename = os.path.join(self.cwd, "templates", "wordcloud.html")

        logging.info("finding word frequencies")

        if self.tfidf_scoring:
            self._findTfIdfScores()
            freqs = self._topN(self.filtered_freqs)
        else:
            freqs = self._findWordFreqs(self.files)

        for item in freqs:
            item["original_text"] = item["text"]
            item["text"] = self.translator.translate(item["original_text"])

        self.translator.saveTranslations()

        params = {"DATA": freqs,
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
