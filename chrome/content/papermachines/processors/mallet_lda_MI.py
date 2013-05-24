#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import codecs
import logging
import traceback
import json
import math
import mallet_lda


class MalletLDAMutualInformation(mallet_lda.MalletLDA):

    """
    Calculate mutual information for groups of topics
    """

    def _basic_params(self):
        self.name = 'mallet_lda_MI'
        self.categorical = True
        self.template_name = 'mallet_lda_MI'
        self.dry_run = False
        self.mallet_out_dir = self.extra_args[0]

    def _mutualInformation(self, X, Y):
        probs = {}
        marginal_x = {}
        marginal_y = {}

        n = 0
        for (interval, x_topic_vals) in X.iteritems():
            if not interval in Y:
                continue
            y_topic_vals = Y[interval]

            if len(x_topic_vals.keys()) == 0 \
                or len(y_topic_vals.keys()) == 0:
                continue

            # what is being most discussed in each group?

            x = argmax(x_topic_vals)
            y = argmax(y_topic_vals)

            if not x in marginal_x:
                marginal_x[x] = 0
            marginal_x[x] += 1
            if not y in marginal_y:
                marginal_y[y] = 0
            marginal_y[y] += 1

            if not x in probs:
                probs[x] = {}
            if not y in probs[x]:
                probs[x][y] = 0
            probs[x][y] += 1
            n += 1

        n_x = float(sum(marginal_x.values()))
        for x in marginal_x.keys():
            marginal_x[x] /= n_x

        n_y = float(sum(marginal_y.values()))
        for y in marginal_y.keys():
            marginal_y[y] /= n_y

        for (x, y_probs) in probs.iteritems():
            for y in y_probs.keys():
                probs[x][y] /= float(n)

        mi = 0.0
        for (x, y_probs) in probs.iteritems():
            for y in y_probs.keys():
                mi += probs[x][y] * math.log(probs[x][y]
                        / (marginal_x[x] * marginal_y[y]), 2)
        return mi

    def process(self):
        self.metadata = \
            json.load(codecs.open(os.path.join(self.mallet_out_dir,
                      'metadata.json'), 'r', encoding='utf-8'))
        self.files = self.metadata.keys()

        self.classify_file = os.path.join(self.out_dir,
                'mallet_classify-file' + self.collection + '.json')
        if os.path.exists(self.classify_file):
            with codecs.open(self.classify_file, 'r', encoding='utf-8'
                             ) as f:
                self.classified = json.load(f)
            for filename in self.files:
                label = self.classified.get(filename)
                if label is not None:
                    self.metadata[filename]['label'] = label

        self.labels = set([x['label'] for x in self.metadata.values()])

        self.doc_topics = os.path.join(self.mallet_out_dir,
                'doc-topics.txt')
        self.docs = [x.strip() for x in
                     codecs.open(os.path.join(self.mallet_out_dir,
                     'dmap'), 'r', encoding='utf-8')]

        self.split_into_intervals()
        self.labels_years_topics = {}

        for label in self.labels:
            self.labels_years_topics[label] = dict((i, {}) for i in
                    self.intervals)

        for line in file(self.doc_topics):
            try:
                values = line.split('\t')

                id = values.pop(0)
                if id.startswith('#doc'):
                    continue
                filename = self.docs[int(id)]
                del values[0]

                itemid = self.metadata[filename]['itemID']

                label = self.metadata[filename]['label']

                freqs = dict((int(y[0]), float(y[1])) for y in
                             xpartition(values))
                main_topic = None
                topic_max = 0.0
                for i in freqs.keys():
                    if freqs[i] > topic_max:
                        main_topic = i
                        topic_max = freqs[i]
                if main_topic is None:
                    continue
                if not main_topic \
                    in self.labels_years_topics[label][self.fname_to_interval[filename]]:
                    self.labels_years_topics[label][self.fname_to_interval[filename]][main_topic] = \
                        0
                self.labels_years_topics[label][self.fname_to_interval[filename]][main_topic] += \
                    1
            except KeyboardInterrupt:
                sys.exit(1)
            except:
                logging.error(traceback.format_exc())

        self.MIs = {}
        labels = sorted(self.labels)
        n = len(labels)
        for i in range(n):
            for j in range(i + 1, n):
                X = self.labels_years_topics[labels[i]]
                Y = self.labels_years_topics[labels[j]]

                # all_topics = []

                # for A in [X,Y]:
                #       this_set = set()
                #       for interval, topic_vals in A.iteritems():
                #               this_set.update([topic for topic, val in topic_vals.iteritems() if val > 0])
                #       all_topics.append(this_set)

                # topics_of_interest = all_topics[0].intersection(all_topics[1])

                result = self._mutualInformation(X, Y)
                self.MIs[str(i) + ',' + str(j)] = result

        self.nodes = []
        self.edges = []
        node_index = {}

        for (key, mi) in self.MIs.iteritems():
            (a, b) = [int(x) for x in key.split(',')]
            for i in [a, b]:
                if i not in node_index:
                    node_index[i] = len(self.nodes)
                    self.nodes.append(labels[i])
            edge = {'source': node_index[a], 'target': node_index[b],
                    'mi': mi}
            self.edges.append(edge)

        params = {'NODES': json.dumps(self.nodes),
                  'EDGES': json.dumps(self.edges)}
        self.write_html(params)


if __name__ == '__main__':
    try:
        processor = MalletLDAMutualInformation(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
