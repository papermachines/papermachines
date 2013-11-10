#!/usr/bin/env python2.7
# -*- coding: utf-8 -*-

import sys
import os
import logging
import time
import codecs
import struct
import base64
import traceback
import gzip
from collections import Counter, defaultdict
import xml.etree.ElementTree as et
from lib.utils import *
from operator import itemgetter

import mallet

class MalletLDA(mallet.Mallet):
    """
    Perform LDA using MALLET
    """

    def _basic_params(self):
        self.categorical = False
        self.template_name = "mallet_lda"
        self.name = "mallet_lda"
        self.topics = 50
        self.dry_run = False
        self.dfr = len(self.extra_args) > 0
        if self.dfr:
            self.dfr_dir = self.extra_args[0]

    def _stdev(self, X):
        n = float(len(X))
        xbar = float(sum(X)) / n
        variances = [math.pow(float(x) - xbar, 2.0) for x in X]
        return math.sqrt((1.0 / (n - 1.0)) * sum(variances))

    def _cov(self, X, Y):
        n = float(len(X))
        xbar = sum(X) / n
        ybar = sum(Y) / n
        return (1.0/(n-1.0)) * sum([((x-xbar) * (y-ybar)) for x, y in zip(X, Y)])

    # def _find_proportions(self, topics):
    #     self.proportions = {}
    #     for i in range(len(topics)):
    #         self.proportions[i] = float(sum(topics[i])) / len(topics[i])

    def _find_stdevs(self, topics):
        self.stdevs = {}
        for i in range(len(topics)):
            self.stdevs[i] = self._stdev(topics[i])

    def _find_correlations(self, topics):
        self.correlations = {}
        for i in range(len(topics)):
            for j in range(i+1,len(topics)):
                self.correlations[str(i) + ',' + str(j)] = self._cov(topics[i], topics[j]) / (self.stdevs[i] * self.stdevs[j])

    def process(self):
        """
        run LDA, output graph of topic prevalence over time
        """

        self.tfidf = self.named_args.get("tfidf", True)
        self.min_df = int(self.named_args.get("min_df", 5))
        self.stemming = self.named_args.get("stemming", True)
        self.topics = int(self.named_args.get("topics", 50))
        self.iterations = int(self.named_args.get("iterations", 1000))
        self.alpha = self.named_args.get("alpha", 50.0)
        self.beta = self.named_args.get("beta", 0.01)
        self.symmetric_alpha = str(self.named_args.get("symmetric_alpha", 
                                                       False)).lower()
        self.optimize_interval = int(self.named_args.get("optimize_interval", 
                                                         10))
        self.burn_in = int(self.named_args.get("burn_in", 200))
        self.lang = self.named_args.get("lang", "en")
        self.date_range = self.named_args.get("date_range", '')

        self.setup_mallet_instances(sequence=True, tfidf=self.tfidf, 
                                     stemming=self.stemming)

        self.mallet_files = {
            'state': os.path.join(self.mallet_out_dir, "topic-state.gz"),
            'doc-topics': os.path.join(self.mallet_out_dir, "doc-topics.txt"),
            'topic-keys': os.path.join(self.mallet_out_dir, "topic-keys.txt"),
            'word-topics': os.path.join(self.mallet_out_dir, "word-topics.txt"),
            'diagnostics-file': os.path.join(self.mallet_out_dir, 
                "diagnostics-file.txt"),
            'topic-phrases': os.path.join(self.mallet_out_dir, 
                "topic-phrases.xml")
        }
        from cc.mallet.topics.tui.TopicTrainer import main as TopicTrainer

        process_args = ["--input", self.instance_file,
                "--num-topics", str(self.topics),
                "--num-iterations", str(self.iterations),
                "--optimize-interval", str(self.optimize_interval),
                "--optimize-burn-in", str(self.burn_in),
                "--use-symmetric-alpha", str(self.symmetric_alpha),
                "--alpha", str(self.alpha),
                "--beta", str(self.beta),
                "--output-state", self.mallet_files['state'],
                "--output-doc-topics", self.mallet_files['doc-topics'],
                "--output-topic-keys", self.mallet_files['topic-keys'],
                "--diagnostics-file", self.mallet_files['diagnostics-file'],
                "--word-topic-counts-file", self.mallet_files['word-topics'],
                "--xml-topic-phrase-report", self.mallet_files['topic-phrases']
                ]

        logging.info("begin LDA")

        start_time = time.time()
        if not self.dry_run:
            TopicTrainer(process_args)

        logging.info("LDA complete in " + str(time.time() - start_time) +
                     " seconds")

        coherence = {}
        wordProbs = {}
        phrases = {}
        allocationRatios = {}
        with codecs.open(self.mallet_files['diagnostics-file'], 'r', 
                         encoding='utf-8', errors='ignore') as diagnostics:
            try:
                tree = et.parse(diagnostics)
                for elem in tree.getiterator("topic"):
                    topic = elem.get("id")
                    coherence[topic] = float(elem.get("coherence"))
                    allocationRatios[topic] = float(
                                                elem.get("allocation_ratio"))
                    wordProbs[topic] = []
                    for word in elem.getiterator("word"):
                        wordProbs[topic].append({'text': word.text, 
                                                 'prob': word.get("prob")})
            except:
                logging.error("The diagnostics file could not be parsed!")
                logging.error("The error is reproduced below.")
                logging.error(traceback.format_exc())

        with codecs.open(self.mallet_files['topic-phrases'], 'r', 
                         encoding='utf-8', errors='ignore') as phrase_file:
            try:
                tree = et.parse(phrase_file)
                for elem in tree.getiterator("topic"):
                    topic = elem.get("id")
                    titles = elem.get("titles")
                    phrases[topic] = titles.split(', ')
            except:
                logging.error("The topic phrase report could not be parsed!")
                logging.error("The error is reproduced below.")
                logging.error(traceback.format_exc())

        labels = {x[0]: {"words": wordProbs[x[0]],
                         "allocation_ratio": allocationRatios[x[0]],
                         "phrases": phrases[x[0]]
                        } 
                  for x in [y.split() for y in 
                            codecs.open(self.mallet_files['topic-keys'],
                                        'r', encoding='utf-8').readlines()
                            ]
                }

        topics_fmt = '<' + str(self.topics) + 'f'

        doc_topics = {}

        for line in codecs.open(self.mallet_files['doc-topics'], 'r', 
                                encoding='utf-8'):
            try:
                values = line.split('\t')

                docid = values.pop(0)
                if docid.startswith("#doc"):
                    continue
                filename = self.docs[int(docid)]

                itemid = self.metadata[filename]["itemID"]
                topics = [float(y[1]) for y in sorted(group_by_n(values[1:-1]), 
                                                      key=lambda x: int(x[0]))]
                doc_topics[filename] = topics
                topics_str = base64.b64encode(struct.pack(topics_fmt, *topics))
                self.metadata[filename]["topics"] = topics_str
            except KeyboardInterrupt, SystemExit:
                sys.exit(1)
            except:
                logging.error(traceback.format_exc())

        for filename in self.docs:
            date_for_doc = self.get_doc_date(filename)
            if date_for_doc is not None:
                self.metadata[filename]['date'] = self.format_date(date_for_doc)

        top_words = defaultdict(Counter)
        doc_words_topics = defaultdict(lambda: defaultdict(Counter))
        with gzip.open(self.mallet_files['state'], 'rb') as f:
            for line in f:
                if line.startswith('#'):
                    continue
                parts = line.split(' ')
                docid = parts[0]
                word = parts[4]
                topic = int(parts[5])
                filename = self.docs[int(docid)]
                top_words[filename][word] += 1
                doc_words_topics[filename][word][topic] += 1

        for filename, word_counts in top_words.iteritems():
            my_top_words = []
            for k, v in word_counts.most_common(50):
                my_top_words.append({'text': k, 'topic': doc_words_topics[filename][k].most_common(1)[0][0], 'prob': v})
            self.metadata[filename]["topWords"] = my_top_words

        self.template_filename = os.path.join(self.cwd, "templates", 
                                              self.template_name + ".html")

        # topics_by_year = []
        # for doc, data in self.metadata.iteritems():
        #     topics_by_year

        # self.topics_by_year = topics_by_year
        # self._find_proportions(topics_by_year)
        # try:
        #     self._find_stdevs(topics_by_year)
        #     self._find_correlations(topics_by_year)
        # except:
        #     self.stdevs = {}
        #     self.correlations = {}

        params = {"CATEGORICAL": self.categorical,
                        "TOPIC_LABELS": labels,
                        "TOPIC_COHERENCE": coherence,
                        # "TOPIC_PROPORTIONS": self.proportions,
                        # "TOPIC_STDEVS": self.stdevs,
                        # "TOPIC_CORRELATIONS": self.correlations,
                        "TAGS": getattr(self, "tags", {})
        }

        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = MalletLDA(track_progress = False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
