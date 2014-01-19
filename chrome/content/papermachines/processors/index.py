#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import shutil
import logging
import textprocessor
from itertools import izip
from org.papermachines.util import TextList2FeatureSequence, FeatureSequence2Index

class Index(textprocessor.TextProcessor):

    def _basic_params(self):
        self.name = 'index'

    def process(self):
        self.index_out_dir = os.path.join(self.out_dir, self.name
                + self.collection)

        if os.path.exists(self.index_out_dir):
            shutil.rmtree(self.index_out_dir)
        os.makedirs(self.index_out_dir)

        self.instance_file = os.path.join(self.index_out_dir,
                self.collection + '.mallet')
        TextList2FeatureSequence(self.files, self.instance_file,
                                 self.stoplist)
        # self.instance_file = self.instance_file.replace('.mallet',
        #         '_pruned.mallet')

        itemIDs = [self.metadata[fname]['itemID'] for fname in self.files]
        fs2i = FeatureSequence2Index(self.instance_file, itemIDs)
        index = dict(fs2i.getIndex())
        for key in index.keys():
            index[key] = list(index[key])
        corpus = fs2i.getCorpus()
        vocab = list(corpus.getVocab())
        documents = corpus.getDocuments()
        for fname, result in izip(self.files, documents):
            self.metadata[fname]['words'] = result
        self.write_html({'VOCAB': vocab, 'INDEX': index})

if __name__ == '__main__':
    try:
        processor = Index(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())
