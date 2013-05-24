#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import logging
import tempfile
import time
import math
import re
import urllib
import json
import codecs
import csv
import traceback
import xml.etree.ElementTree as et
from utils import *
import gzip
from lib.stemutil import stem
import mallet_lda


class MalletDMR(mallet_lda.MalletLDA):

    """
    Perform DMR using MALLET
    """

    def _basic_params(self):
        self.categorical = False
        self.template_name = 'mallet_dmr'
        self.name = 'mallet_dmr'
        self.topics = 50
        self.dry_run = False
        self.dfr = len(self.extra_args) > 0
        if self.dfr:
            self.dfr_dir = self.extra_args[0]
        self.features = self.named_args.get('features', 'decade')

    def metadata_to_feature_string(self, doc):
        my_features = []
        metadata = self.metadata[doc]
        if 'decade' in self.features:
            year = float(metadata['year'])
            if year != 0:
                decade = int(round(year, -1))
                my_features.append(u'decade{:}'.format(decade))
        if 'place' in self.features:
            place = metadata['place']
            my_features.append(self._sanitize_feature(place))
        if 'label' in self.features:
            label = metadata['label']
            my_features.append(self._sanitize_feature(label))
        return u' '.join(my_features)

    def _sanitize_feature(self, text):
        return re.sub('[\W_]+', '', text, re.UNICODE)

    def _setup_mallet_instances(self, tfidf=False, stemming=True):
        self.stemming = stemming

        self._setup_mallet_command()
        self._import_texts()

        self.instance_file = os.path.join(self.mallet_out_dir,
                self.collection + '.mallet')

        logging.info('beginning text import')

        if tfidf and not self.dry_run:
            self._tfidf_filter()

        self.split_into_intervals()

        os.rename(self.texts_file, self.texts_file + '-pre_dmr')

        with codecs.open(self.texts_file + '-pre_dmr', 'r',
                         encoding='utf-8') as texts_file_old:
            with codecs.open(self.texts_file, 'w', encoding='utf-8') as \
                texts_file:
                for line in texts_file_old:
                    parts = line.split(u'\t')
                    if parts[0] in self.metadata:
                        texts_file.write(parts[-1])
                    else:
                        self.docs.remove(parts[0])

        with codecs.open(os.path.join(self.mallet_out_dir,
                         'metadata.json'), 'w', encoding='utf-8') as \
            meta_file:
            json.dump(self.metadata, meta_file)

        self.features_file = os.path.join(self.mallet_out_dir,
                'features.txt')

        self.features_list = []
        for doc in self.docs:
            self.features_list.append(self.metadata_to_feature_string(doc))

        with codecs.open(self.features_file, 'w', encoding='utf-8') as \
            features_file:
            features_file.writelines([x + u'\n' for x in
                    self.features_list])

        from cc.mallet.topics.tui.DMRLoader import main as DMRLoader
        import_args = [self.texts_file, self.features_file, self.instance_file]

        DMRLoader(import_args)

    def process(self):
        """
        run DMR, creating an output file divided by time
        """

        self.tfidf = self.named_args.get('tfidf', True)
        self.min_df = int(self.named_args.get('min_df', 5))
        self.stemming = self.named_args.get('stemming', True)
        self.topics = int(self.named_args.get('topics', 50))
        self.lang = self.named_args.get('lang', 'en')

        self._setup_mallet_instances(tfidf=self.tfidf,
                stemming=self.stemming)

        os.chdir(self.mallet_out_dir)

        # from cc.mallet.topics.DMRTopicModel import main as DMRTopicModel
        from cc.mallet.topics import DMRTopicModel
        process_args = [self.instance_file, str(self.topics)]
        logging.info('begin DMR')

        start_time = time.time()
        self.parameter_file = os.path.join(self.mallet_out_dir,
                         'dmr.parameters')
        self.state_file = os.path.join(self.mallet_out_dir,
                         'dmr.state.gz')
        if not self.dry_run:
            # DMRTopicModel(process_args)
            from java.io import File, PrintStream, FileOutputStream
            from java.lang import System

            self.progress_file.close()
            progress_file = File(self.progress_filename)
            System.setOut(PrintStream(FileOutputStream(progress_file)))

            from cc.mallet.types import InstanceList
            training = InstanceList.load(File(self.instance_file))
            numTopics = int(self.topics)
            lda = DMRTopicModel(numTopics)
            lda.setOptimizeInterval(100)
            lda.setTopicDisplay(100, 10)
            lda.addInstances(training)
            lda.estimate()
            lda.writeParameters(File(self.parameter_file))
            lda.printState(File(self.state_file))

        logging.info('DMR complete in ' + str(time.time() - start_time)
                     + ' seconds')

        self.topic_features = {}
        with codecs.open(self.parameter_file, 'r', encoding='utf-8') as f:
            topic = 0
            for line in f:
                new_topic = re.match('FEATURES FOR CLASS topic([0-9]+)'
                        , line)
                if new_topic is not None:
                    topic = int(new_topic.group(1))
                else:
                    if not topic in self.topic_features:
                        self.topic_features[topic] = {}
                    this_line = line.split(' ')
                    feature = this_line[1]
                    self.topic_features[topic][feature] = \
                        float(this_line[2])

        self.progress_file = file(self.progress_filename, 'r')
        self.progress_file.seek(0, os.SEEK_SET)
        self.alphas = {}
        for line in self.progress_file:
            if re.match('[0-9]+\t[0-9.]+', line) is not None:
                this_line = line.split('\t')
                topic = int(this_line[0])
                alpha = float(this_line[1])
                tokens = int(this_line[2])

                self.alphas[topic] = alpha

        self.alpha_sum = sum(self.alphas.values())

        self.topic_words = {}
        self.doc_topics = {}

        with gzip.open(self.state_file, 'rb') as state_file:
            state_file.next()
            for line in state_file:
                this_line = line.split(' ')
                topic = int(this_line[5])
                word = this_line[4]
                doc = int(this_line[0])
                position = int(this_line[2])

                if not doc in self.doc_topics:
                    self.doc_topics[doc] = {}
                if not topic in self.doc_topics[doc]:
                    self.doc_topics[doc][topic] = 0
                self.doc_topics[doc][topic] += 1

                if not topic in self.topic_words:
                    self.topic_words[topic] = {}
                if not word in self.topic_words[topic]:
                    self.topic_words[topic][word] = 0
                self.topic_words[topic][word] += 1

        # total_tokens = float(sum([sum(y.values()) for x, y in self.topic_words.iteritems()]))

        for topic in self.topic_words.keys():
            total = float(sum(self.topic_words[topic].values()))
            for k in self.topic_words[topic].keys():
                self.topic_words[topic][k] /= total

        top_N = 20
        top_topic_words = dict((x, dict((word, y[word]) for word in
                               argsort(y, reverse=True)[:top_N]))
                               for (x, y) in
                               self.topic_words.iteritems())
        wordProbs = [[{'text': word, 'prob': prob} for (word, prob) in
                     y.iteritems()] for (x, y) in
                     top_topic_words.iteritems()]

        DEFAULT_DOC_PROPORTIONS = [
            0.01,
            0.02,
            0.05,
            0.1,
            0.2,
            0.3,
            0.5,
            ]
        numDocumentsAtProportions = dict((topic, dict((k, 0.0) for k in
                DEFAULT_DOC_PROPORTIONS)) for topic in
                self.topic_words.keys())
        for (doc, topics) in self.doc_topics.iteritems():
            doc_length = sum(topics.values())
            for (topic, count) in topics.iteritems():
                proportion = (self.alphas[topic] + count) \
                    / (self.alpha_sum + doc_length)
                for min_proportion in DEFAULT_DOC_PROPORTIONS:
                    if proportion < min_proportion:
                        break
                    numDocumentsAtProportions[topic][min_proportion] += \
                        1

        allocationRatios = dict((topic, proportions[0.5]
                                / proportions[0.02]) for (topic,
                                proportions) in
                                numDocumentsAtProportions.iteritems()
                                if proportions[0.02] > 0.0)

        labels = dict((topic, {'label': argsort(words,
                      reverse=True)[:3], 'fulltopic': wordProbs[topic],
                      'allocation_ratio': allocationRatios.get(topic,0)})
                      for (topic, words) in top_topic_words.iteritems())

        doc_metadata = {}

        for doc in self.doc_topics.keys():
            total = float(sum(self.doc_topics[doc].values()))
            for k in self.doc_topics[doc].keys():
                self.doc_topics[doc][k] /= total

        for (id, topics) in self.doc_topics.iteritems():
            try:
                filename = self.docs[int(id)]

                itemid = self.metadata[filename]['itemID']

                doc_metadata[itemid] = \
                    {'label': self.metadata[filename]['label'],
                     'title': self.metadata[filename]['title']}

                freqs = topics
                main_topic = None
                topic_max = 0.0
                for i in freqs.keys():
                    if freqs[i] > topic_max:
                        main_topic = i
                        topic_max = freqs[i]
                doc_metadata[itemid]['main_topic'] = main_topic
                self.metadata[filename]["topics"] = freqs
            except KeyboardInterrupt:
                sys.exit(1)
            except:
                logging.error(traceback.format_exc())

        self.template_filename = os.path.join(self.cwd, 'templates',
                self.template_name + '.html')

        if getattr(self, "index", None) is not None:
            for term in self.index:
                if isinstance(self.index[term], set):
                    self.index[term] = list(self.index[term])
            self.index = dict(self.index)

        params = {"CATEGORICAL": self.categorical,
                        "TOPIC_LABELS": labels,
                        "TOPIC_COHERENCE": {},
                        "TAGS": getattr(self, "tags", {}),
                        "INDEX": getattr(self, "index", {})
        }

        self.write_html(params)


if __name__ == '__main__':
    try:
        processor = MalletDMR(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
