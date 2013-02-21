#!/usr/bin/env python2.7
import sys, os, logging, traceback, codecs, json
from lib.translate import *
import wordcloud_multiple

class WordCloudTranslateMultiple(wordcloud_multiple.MultipleWordClouds):
    """
    Generate large word cloud using Bing translation
    """
    def _basic_params(self):
        self.name = "wordcloud_translate_multiple"
        self.width = "300"
        self.height = "150"
        self.fontsize = "[10,32]"
        self.n = 50
        self.tfidf_scoring = False
        self.MWW = False
        self.dunning = False
        self.template_filename = os.path.join(self.cwd, "templates", "wordcloud_multiple.html")
        if len(self.extra_args) > 0:
            if self.extra_args[0] == "tfidf":
                self.tfidf_scoring = True
            elif self.extra_args[0] == "mww":
                self.tfidf_scoring = True
                self.MWW = True
            elif self.extra_args[0] == "dunning":
                self.tfidf_scoring = True
                self.dunning = True
        self.tfidf_scoring = self.named_args.get("tfidf", False)
        self.lang_from = self.named_args.get("lang_from", "Hebrew")
        self.lang_to = self.named_args.get("lang_to", "English")
        self.translator = Translator(self.cwd)
        self.translator.setLanguages(self.out_dir, self.lang_from, self.lang_to)

    def process(self):
        logging.info("splitting into labeled sets")
        self.labels = {}
        self._split_into_labels()

        clouds = {}

        all_files = set(self.files)
        if self.tfidf_scoring:
            if self.dunning:
                self._findTfIdfScores(scale=False)
            else:
                self._findTfIdfScores()
            # self.top_tfidf_words = [item["text"] for item in self._topN(self.filtered_freqs, 150)]
            self.top_tfidf_words = self.filtered_freqs.keys()

        self.label_order = sorted(self.labels.keys())
        for label in self.label_order:
            filenames = self.labels[label]
            logging.info("finding word frequencies for " + str(label))
            if self.tfidf_scoring and self.MWW:
                label_set = set(filenames)
                other_set = all_files - label_set
                word_rho = {}
                for word in self.top_tfidf_words:
                    word_rho[word] = self._held_out(word, label_set, other_set)
                clouds[label] = self._topN(word_rho)
            elif self.tfidf_scoring and self.dunning:
                label_set = set(filenames)
                other_set = all_files - label_set
                word_G2 = {}
                self.total_word_count = sum(self.freqs.values())
                for word in self.top_tfidf_words:
                    G2 = self._dunning_held_out(word, label_set, other_set)
                    # G2 = self._dunning(word, label_set)
                    if G2 > 15.13: # critical value for p < 0.001
                        word_G2[word] = G2
                clouds[label] = self._topN(word_G2)

            elif self.tfidf_scoring:
                tf_maxes = {}
                for filename in filenames:
                    for term, weight in self.tf_by_doc[filename].iteritems():
                        if term not in tf_maxes:
                            tf_maxes[term] = weight
                        else:
                            if weight > tf_maxes[term]:
                                tf_maxes[term] = weight
                tfidf_for_labelset = dict((term, weight * self.idf[term]) for term, weight in tf_maxes.iteritems())
                filtered_freqs_for_labelset = dict((term, freq) for term, freq in self.filtered_freqs.iteritems() if term in tfidf_for_labelset)
                clouds[label] = self._topN(filtered_freqs_for_labelset)
            else:
                clouds[label] = self._findWordFreqs(filenames)


        for label in clouds:
            for item in clouds[label]:
                item["original_text"] = item["text"]
                item["text"] = self.translator.translate(item["original_text"])

        self.translator.saveTranslations()

        params = {"CLOUDS": json.dumps(clouds),
                "ORDER": json.dumps(self.label_order),
                "WIDTH": self.width,
                "HEIGHT": self.height,
                "FONTSIZE": self.fontsize
        }

        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = WordCloudTranslateMultiple(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())