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
                "diagnostics-file.txt")
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
                "--word-topic-counts-file", self.mallet_files['word-topics']]

        logging.info("begin LDA")

        start_time = time.time()
        if not self.dry_run:
            TopicTrainer(process_args)

        logging.info("LDA complete in " + str(time.time() - start_time) +
                     " seconds")

        coherence = {}
        wordProbs = {}
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

        labels = {x[0]: {"words": wordProbs[x[0]],
                         "allocation_ratio": allocationRatios[x[0]]
                        } 
                  for x in [y.split() for y in 
                            codecs.open(self.mallet_files['topic-keys'],
                                        'r', encoding='utf-8').readlines()
                            ]
                }

        topics_fmt = '<' + str(self.topics) + 'f'

        for line in codecs.open(self.mallet_files['doc-topics'], 'r', 
                                encoding='utf-8'):
            try:
                values = line.split('\t')

                docid = values.pop(0)
                if docid.startswith("#doc"):
                    continue
                filename = self.docs[int(docid)]
                del values[0]

                itemid = self.metadata[filename]["itemID"]
                topics = [float(y[1]) for y in sorted(group_by_n(values), 
                                                      key=itemgetter(0))]
                topics_str = base64.b64encode(struct.pack(topics_fmt, *topics))
                self.metadata[filename]["topics"] = topics_str
            except KeyboardInterrupt, SystemExit:
                sys.exit(1)
            except:
                logging.error(traceback.format_exc())

        for filename in self.docs:
            date_for_doc = self.get_doc_date(filename)
            self.metadata[filename]['date'] = self.format_date(date_for_doc)

        self.template_filename = os.path.join(self.cwd, "templates", 
                                              self.template_name + ".html")

        params = {"CATEGORICAL": self.categorical,
                        "TOPIC_LABELS": labels,
                        "TOPIC_COHERENCE": coherence,
                        "TAGS": getattr(self, "tags", {})
        }

        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = MalletLDA(track_progress = False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
