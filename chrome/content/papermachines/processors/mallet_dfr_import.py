#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import logging
import traceback
from mallet_import import MalletImport
from textprocessor import TextProcessor
from jarray import array
from java.lang import String
from java.util import ArrayList
from java.io import File
from cc.mallet.pipe.iterator import EmptyInstanceIterator
from cc.mallet.pipe import Target2Label, TokenSequenceLowercase, \
    TokenSequenceRemoveStopwords, TokenSequence2FeatureSequence, SerialPipes
from cc.mallet.types import Instance, InstanceList, Token, TokenSequence
from collections import Counter
from lib.stemutil import stem
from lib.utils import *


class DfrIterator(EmptyInstanceIterator):

    def __init__(self, dfr_dir, dois, cwd, stemming=False):
        wordcounts_dir = os.path.join(dfr_dir, 'wordcounts')
        self.total_items = len(dois)
        self.current_count = 0
        self.stemming = stemming
        self.cwd = cwd

        def dfr_iter(caller):
            for i, doi in enumerate(dois):
                caller.current_count = i
                tokens = TokenSequence()
                with file(os.path.join(wordcounts_dir, 'wordcounts_'
                               + doi.replace('/', '_') + '.CSV'), 'rU') as f:
                    csv_reader = unicode_csv_reader(f)
                    # skip header: ['WORDCOUNTS', 'WEIGHT']
                    csv_reader.next() 
                    for row in csv_reader:
                        word = row[0]

                        if caller.stemming:
                            word = stem(lang, caller.cwd, word)
                        count = int(row[1])
                        tokens.addAll(array([word] * count, String))
                yield Instance(
                    tokens,
                    'jstor',
                    doi,
                    None)

        self.dfr_instances = dfr_iter(self)

    def hasNext(self):
        return self.current_count < self.total_items - 1

    def next(self):
        return self.dfr_instances.next()

class MalletDfrImport(TextProcessor, MalletImport):
    def import_dfr_metadata(self, dfr_dir):
        citation_file = os.path.join(dfr_dir, 'citations.CSV')
        dois = []
        for rowdict in parse_csv(citation_file):
            doi = rowdict.pop('id')
            self.metadata[doi] = {
                'title': rowdict.get('title', ''),
                'date': rowdict.get('pubdate', ''),
                'year': rowdict.get('pubdate', '')[0:4],
                'label': 'jstor',
                'itemID': doi,
                }
            dois.append(doi)
        return dois

    def import_dfr_new(self, dfr_dir, dois):
        self.create_instance_list('tokenseq')
        self.instance_list.addThruPipe(DfrIterator(dfr_dir, dois, self.cwd))
        return self.instance_list

    def import_dfr(self, dfr_dir, dois):
        lang = getattr(self, 'lang', 'en')
        wordcounts_dir = os.path.join(dfr_dir, 'wordcounts')

        for doi in dois:
            try:
                this_text = Counter()
                with file(os.path.join(wordcounts_dir, 'wordcounts_'
                               + doi.replace('/', '_') + '.CSV'), 'rU') as f:
                    csv_reader = unicode_csv_reader(f)
                    # skip header: ['WORDCOUNTS', 'WEIGHT']
                    csv_reader.next() 
                    for row in csv_reader:
                        word = row[0]
                        if word in self.stopwords:
                            continue
                        if self.stemming:
                            word = stem(lang, self.cwd, word)

                        this_text[word] += int(row[1])
                if sum(this_text.values()) < 20:
                    continue
                yield (doi, this_text)
            except:
                logging.error(doi)
                logging.error(traceback.format_exc())
