#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import shutil
import logging
import tempfile
import time
import subprocess
import math
import re
import urllib
import json
import codecs
import csv
import traceback
import platform
import xml.etree.ElementTree as et
from lib.stemutil import stem
from collections import defaultdict, Counter
from mallet_import import MalletImport
from mallet_dfr_import import MalletDfrImport
from datetime import datetime
import copy
import textprocessor

class Mallet(textprocessor.TextProcessor, MalletImport, MalletDfrImport):

    """
    Base class for MALLET functionality
    """

    def _basic_params(self):
        self.name = 'mallet'

    def _output_text_freqs(self, text_freqs, f, filename):
        itemid = self.metadata[filename]['itemID']
        text_freqs = Counter(text_freqs)
        for word in text_freqs.keys():
            self.index[word].add(itemid)
        f.write(u'\t'.join([filename, self.metadata[filename]['label'],
                u' '.join(text_freqs.elements())]) + u'\n')
        self.docs.append(filename)

    def _import_files(self):
        self.index = defaultdict(set)
        self.docs = []
        self.date_range = getattr(self, 'date_range', '')

        if self.date_range.count('-') == 1:
            parts = self.date_range.split('-')
            start = [int(parts[0]), 1, 1]
            end = [int(parts[1]), 12, 31]
            self.date_range = (datetime(*start), datetime(*end))
        else:
            self.date_range = None

        with codecs.open(self.texts_file, 'w', encoding='utf-8') as f:
            for filename in self.files:
                date_for_doc = self.get_doc_date(filename)
                if date_for_doc is None or (self.date_range is not None and 
                        (date_for_doc < self.date_range[0] or
                         date_for_doc > self.date_range[1])):
                    logging.error(('File {:} out of range' + 
                                  '-- removing...').format(filename))
                    del self.metadata[filename]
                    continue
                self._output_text_freqs(self.getNgrams(filename,
                                  stemming=self.stemming), f, filename)
            if self.dfr:
                self.dois = self.import_dfr_metadata(self.dfr_dir)
                for (doi, text) in self.import_dfr(self.dfr_dir,
                        self.dois):
                    f.write(u'\t'.join([doi, self.metadata[doi]['label'],
                            text]) + u'\n')
                    self.docs.append(doi)

        with codecs.open(os.path.join(self.mallet_out_dir, 'dmap'), 'w'
                         , encoding='utf-8') as dmap:
            dmap.writelines([x + u'\n' for x in self.docs])
        self.doc_count = len(self.docs)

    def _tfidf_filter(self, top_terms=None):
        min_df = getattr(self, 'min_df', 5)
        vocab = {}
        inverse_vocab = {}
        df = {}
        tf = {}
        tf_all_docs = {}
        tfidf = {}
        self.index = defaultdict(set)

        i = 0
        with codecs.open(self.texts_file, 'r', encoding='utf-8') as f:
            for line in f:
                j = 0
                filename = ''
                for part in line.split(u'\t'):
                    if j == 0:
                        filename = part
                    elif j == 2:
                        tf_for_doc = {}
                        flen = 0
                        for word in part.split():
                            if len(word) < 3:
                                continue
                            flen += 1
                            if word not in vocab:
                                vocab[word] = i
                                tf_for_doc[i] = 1
                                tf[i] = 0
                                df[i] = 1
                                i += 1
                            else:
                                index = vocab[word]
                                if index not in tf_for_doc:
                                    tf_for_doc[index] = 0
                                    df[index] += 1
                                tf_for_doc[index] += 1
                        tf_all_docs[filename] = \
                            copy.deepcopy(tf_for_doc)
                        for word_index in tf_for_doc.keys():
                            tf_val = float(tf_for_doc[word_index]) \
                                / flen
                            if tf_val > tf[word_index]:
                                tf[word_index] = tf_val
                    j += 1
            self.tf_all_docs = tf_all_docs
            for index in vocab.values():
                tfidf[index] = tf[index] \
                    * math.log10(float(self.doc_count) / df[index])
            tfidf_values = tfidf.values()

            if top_terms is None:
                top_terms = min(int(len(vocab.keys()) * 0.7), 5000)
            min_score = sorted(tfidf_values,
                               reverse=True)[min(top_terms,
                    len(tfidf_values) - 1)]

        os.rename(self.texts_file, self.texts_file + '-pre_tf-idf')
        inverse_vocab = dict((v, k) for (k, v) in vocab.iteritems())
        new_vocab = {}

        with codecs.open(self.texts_file, 'w', encoding='utf-8') as f:
            for (filename, freqs) in tf_all_docs.iteritems():
                text = u''
                flen = 0
                thisfile_vocab = []
                for (index, count) in freqs.iteritems():
                    if tfidf[index] < min_score or df[index] < min_df:
                        continue
                    word = inverse_vocab[index]
                    if word in self.stopwords:
                        continue
                    if word not in new_vocab:
                        new_vocab[word] = 0
                    new_vocab[word] += count
                    thisfile_vocab.append(word)
                    text += (word + u' ') * count
                    flen += count
                if flen > 25:
                    f.write(u'\t'.join([filename,
                            self.metadata[filename]['label'], text])
                            + u'\n')
                    for word in thisfile_vocab:
                        self.index[word].add(self.metadata[filename]['itemID'
                                ])
                else:
                    self.docs.remove(filename)
        with codecs.open(os.path.join(self.mallet_out_dir, 'dmap'), 'w'
                         , encoding='utf-8') as dmap:
            dmap.writelines([x + u'\n' for x in self.docs])
        logging.info('tf-idf complete; retained {:} of {:} words; minimum tf-idf score: {:}'.format(len(new_vocab.keys()),
                     len(vocab.keys()), min_score))

    def setup_mallet_command(self):
        self.mallet_out_dir = os.path.join(self.out_dir, self.name
                + self.collection + '-' + self.arg_basename)

        if not self.dry_run:
            if os.path.exists(self.mallet_out_dir):
                shutil.rmtree(self.mallet_out_dir)
            os.makedirs(self.mallet_out_dir)

        self.progress_filename = os.path.join(self.out_dir, self.name
                + self.collection + 'progress.txt')
        self.progress_file = file(self.progress_filename, 'w+')

        self.instance_file = os.path.join(self.mallet_out_dir,
                self.collection + '.mallet')

    def import_texts(self):
        logging.info('copying texts into single file')
        self.texts_file = os.path.join(self.mallet_out_dir,
                self.collection + '.txt')

        if not os.path.exists(self.texts_file):
            if not self.dry_run:
                self._import_files()
        else:
            if len(self.extra_args) > 0 and self.dfr:
                self.import_dfr_metadata(self.dfr_dir)
            self.docs = []
            self.index = defaultdict(set)
            with codecs.open(self.texts_file, 'r', 'utf-8') as f:
                for line in f:
                    fields = line.split(u'\t')
                    filename = fields[0]
                    self.docs.append(filename)
                    itemid = self.metadata[filename]['itemID']
                    for word in set(fields[2].split()):
                        self.index[word].add(itemid)
            self.doc_count = len(self.docs)

    def setup_mallet_instances(self, sequence=True, tfidf=False, stemming=True):
        self.use_bulkloader = getattr(self, 'use_bulkloader', False)

        self.stemming = stemming
        self.setup_mallet_command()
        self.import_texts()

        # if self.dfr:
        #     self.import_dfr_new(self.dfr_dir, self.dois)
        # self.write_instances()

        if tfidf and not self.dry_run and not self.use_bulkloader:
            self._tfidf_filter()

        with codecs.open(os.path.join(self.mallet_out_dir, 'metadata.json'), 
                         'w', encoding='utf-8') as meta_file:
            json.dump(self.metadata, meta_file)

        logging.info('beginning text import')

        import_args = [
            '--input',
            self.texts_file,
            '--output',
            self.instance_file,
            '--line-regex',
            '^([^\t]*)[\t]([^\t]*)[\t](.*)$',
            ]
        if sequence:
            import_args.append('--keep-sequence')

        if not self.use_bulkloader:
            import_args += ['--encoding', 'UTF-8', '--token-regex',
                            ("\S+" if tfidf else "[\p{L}\p{M}]+")]
            if not tfidf:
                import_args = ['--remove-stopwords', '--stoplist-file',
                               self.stoplist] + import_args

            if not self.dry_run \
                and not os.path.exists(self.instance_file):
                from cc.mallet.classify.tui.Csv2Vectors import main as Csv2Vectors
                Csv2Vectors(import_args)
        elif not self.dry_run:
            from cc.mallet.util.BulkLoader import main as BulkLoader
            import_args += [
                '--remove-stopwords',
                '--stoplist',
                self.stoplist,
                '--prune-doc-frequency',
                '0.3',
                '--prune-count',
                '3',
                ]
            BulkLoader(import_args)

    def process(self):
        """
        Should be redefined!
        """

        pass


if __name__ == '__main__':
    try:
        processor = Mallet(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
