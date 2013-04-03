#! /usr/bin/env python
# -*- coding: utf-8 -*-
'''
        Multi-Word Units (MWUs) Extractor based on (Silva and Lopes, 1999)
                    Luís Gomes <luismsgomes@gmail.com>

                    http://creativecommons.org/licenses/by/3.0/

                Modified by Chris Johnson-Roberson for Paper Machines

Bibliography:

Joaquim Ferreira da Silva and Gabriel Pereira Lopes. A Local Maxima method
  and a Fair Dispersion Normalization for extracting multi-word units from
  corpora. In Sixth Meeting on Mathematics of Language, pages 369–381,
  Orlando, USA, 1999.
'''
import collections, os, sys, logging, codecs

logging.basicConfig(level="DEBUG")

class MWUFinder:
    def __init__(self, gf, max_n, text_filename, output_dir = None):
        self.glue_fun = self.scp if gf == 'scp' else self.dice
        self.text_filename = text_filename
        self.maxn = int(max_n)
        self.output_dir = os.path.dirname(self.text_filename) if output_dir is None else output_dir
        if not os.path.isdir(output_dir):
            os.mkdir(self.output_dir)
        assert os.path.isfile(self.text_filename)
        assert os.path.isdir(self.output_dir)

    def process(self):
        self.compute_freqs_for_all_ngrams()
        self.cascade_freqs_for_all_ngrams()
        self.compute_glues_for_all_ngrams()
        self.cascade_glues_for_all_ngrams()
        self.select_local_maxima_for_all_ngrams()

    def avg(self, ls):
        return sum(ls) / len(ls)

    def dice(self, freq, pref_freqs, suff_freqs):
        return 2 * freq / (self.avg(pref_freqs) + self.avg(suff_freqs))

    def scp(self, freq, pref_freqs, suff_freqs):
        return freq ** 2 / self.avg([pref_freq * suff_freq for pref_freq, suff_freq in zip(pref_freqs, suff_freqs)])

    def compute_ngram_glues(self, n):
        ngram_glues_filename = self.get_ngram_glues_filename(n)
        with codecs.open(ngram_glues_filename + '.tmp', 'w', encoding='utf-8') as output:
            for ngram, freq, pref_freqs, suff_freqs in self.read_ngram_freqs(n):
                glue = self.glue_fun(freq, pref_freqs, suff_freqs)
                output.write(u'\t'.join([unicode(x) for x in [' '.join(ngram), glue, 0, 0]]) + u'\n')
        os.rename(ngram_glues_filename + '.tmp', ngram_glues_filename)   

    def compute_glues_for_all_ngrams(self):
        logging.info('computing glues for all ngrams...')
        for n in range(2, self.maxn+2):
            logging.info(n)
            self.compute_ngram_glues(n)
        logging.info('done')

    def get_ngrams_in_line(self, n, line):
        tokens = line.split()
        for i in range(len(tokens) - n):
            yield tuple(tokens[i:i+n])

    def get_ngrams(self, n):
        with codecs.open(self.text_filename, 'r', encoding='utf-8') as lines:
            for line in lines:
                for ngram in self.get_ngrams_in_line(n, line):
                    yield ngram

    def compute_ngram_freqs(self, n):
        freqs = collections.Counter(self.get_ngrams(n))
        ngram_freqs_filename = self.get_ngram_freqs_filename(n)
        with codecs.open(ngram_freqs_filename + '.tmp', 'w', encoding='utf-8') as output:
            for ngram, freq in freqs.items():
                output.write(u'\t'.join([unicode(x) for x in [u' '.join(ngram), freq, u'', u'']]) + u'\n')
        os.rename(ngram_freqs_filename + '.tmp', ngram_freqs_filename)

    def compute_freqs_for_all_ngrams(self):
        logging.info('computing frequencies for all ngrams...')
        for n in range(1, self.maxn+2):
            logging.info(n)
            self.compute_ngram_freqs(n)
        logging.info('done')

    def cascade_ngram_freqs(self, subngram_freqs, subn, n):
        ngram_freqs_filename = self.get_ngram_freqs_filename(n)
        with codecs.open(ngram_freqs_filename + '.tmp', 'w', encoding='utf-8') as output:
            for ngram, freq, pref_freqs, suff_freqs in self.read_ngram_freqs(n):
                pref_freqs.append(subngram_freqs.get(ngram[:subn], 1))
                suff_freqs.insert(0, subngram_freqs.get(ngram[-subn:], 1)) # prepend
                output.write(u'\t'.join([unicode(x) for x in [' '.join(ngram), freq, ' '.join(map(str, pref_freqs)), ' '.join(map(str, suff_freqs))]]) + u'\n')
        os.rename(ngram_freqs_filename + '.tmp', ngram_freqs_filename)

    def cascade_freqs_for_all_ngrams(self):
        logging.info('cascading frequencies for all ngrams...')
        for subn in range(1, self.maxn+1):
            freqs = self.load_ngram_freqs(subn)
            for n in range(subn + 1, self.maxn+2):
                logging.info('{}=>{}'.format(subn, n))
                self.cascade_ngram_freqs(freqs, subn, n)
        logging.info('done')

    def cascade_ngram_glues(self, n):
        subngram_glues = self.load_ngram_glues(n-1)
        ngram_glues_filename = self.get_ngram_glues_filename(n)
        with codecs.open(ngram_glues_filename + '.tmp', 'w', encoding='utf-8') as output:
            for ngram, glue, _, max_superngram_glue in self.read_ngram_glues(n):
                pref = ngram[:-1]
                suff = ngram[1:]
                pref_glue, _, pref_max_supergram_glue = subngram_glues[pref]
                suff_glue, _, suff_max_supergram_glue = subngram_glues[suff]
                max_subngram_glue = max(pref_glue, suff_glue)
                output.write('\t'.join([unicode(x) for x in [' '.join(ngram), glue, max_subngram_glue, max_superngram_glue]]) + u'\n')
                if glue > pref_max_supergram_glue:
                    subngram_glues[pref][2] = glue
                if glue > suff_max_supergram_glue:
                    subngram_glues[suff][2] = glue
        os.rename(ngram_glues_filename + '.tmp', ngram_glues_filename)
        subngram_glues_filename = self.get_ngram_glues_filename(n-1)
        with codecs.open(subngram_glues_filename + '.tmp', 'w', encoding='utf-8') as output:
            for ngram, (glue, max_subngram_glue, max_superngram_glue) in subngram_glues.items():
                output.write('\t'.join([unicode(x) for x in [' '.join(ngram), glue, max_subngram_glue, max_superngram_glue]]) + u'\n')
        os.rename(subngram_glues_filename + '.tmp', subngram_glues_filename)

    def cascade_glues_for_all_ngrams(self):
        logging.info('cascading glues for all ngrams...')
        for n in range(3, self.maxn+2):
            logging.info('{}<=>{}'.format(n-1, n))
            self.cascade_ngram_glues(n)
        logging.info('done')

    def select_local_maxima(self, n):
        output_filename = self.get_output_filename(n)
        with codecs.open(output_filename + '.tmp', 'w', encoding='utf-8') as output:
            for ngram, glue, max_subgrams_glue, max_supergrams_glue in self.read_ngram_glues(n):
                if glue > (max_subgrams_glue + max_supergrams_glue) / 2:
                    output.write(u' '.join(ngram) + u'\n')
        os.rename(output_filename + '.tmp', output_filename)

    def select_local_maxima_for_all_ngrams(self):
        logging.info('selecting local maxima...')
        for n in range(2, self.maxn+1):
            logging.info(n)
            self.select_local_maxima(n)
        logging.info('done')

    def load_ngram_glues(self, n):
        glues = dict()
        with codecs.open(self.get_ngram_glues_filename(n), 'r', encoding='utf-8') as lines:
            for line in lines:
                cols = line.split('\t')
                if not cols:
                    continue
                assert len(cols) == 4
                ngram = tuple(cols[0].split())
                glue, max_subngram_glue, max_supngram_glue = map(float, cols[1:])
                glues[ngram] = [glue, max_subngram_glue, max_supngram_glue]
        return glues

    def read_ngram_glues(self, n):
        with codecs.open(self.get_ngram_glues_filename(n), 'r', encoding='utf-8') as lines:
            for line in lines:
                cols = line.split('\t')
                if not cols:
                    continue
                assert len(cols) == 4
                ngram = tuple(cols[0].split())
                glue, max_subngram_glue, max_supngram_glue = map(float, cols[1:])
                yield ngram, glue, max_subngram_glue, max_supngram_glue

    def load_ngram_freqs(self, n):
        freqs = dict()
        with codecs.open(self.get_ngram_freqs_filename(n), 'r', encoding='utf-8') as lines:
            for line in lines:
                cols = line.split('\t')
                if not cols:
                    continue
                assert len(cols) == 4
                ngram, freq = cols[:2]
                freqs[tuple(ngram.split())] = int(freq)
        return freqs

    def read_ngram_freqs(self, n):
        with codecs.open(self.get_ngram_freqs_filename(n), 'r', encoding='utf-8') as lines:
            for line in lines:
                cols = line.split('\t')
                if not cols:
                    continue
                assert len(cols) == 4
                ngram, freq, pref_freqs, suff_freqs = cols
                yield tuple(ngram.split()), int(freq), list(map(int, pref_freqs.split())), list(map(int, suff_freqs.split()))

    def get_ngram_freqs_filename(self, n):
        return os.path.join(self.output_dir, str(n) + 'gram_freqs.txt')

    def get_ngram_glues_filename(self, n):
        return os.path.join(self.output_dir, str(n) + 'gram_glues.txt')

    def get_output_filename(self, n):
        return os.path.join(self.output_dir, str(n) + 'mwus.txt')

if __name__ == '__main__':
    if 5 != len(sys.argv) or sys.argv[1] not in ('dice', 'scp'):
        logging.info('usage: multiwords (dice|scp) self.maxn TEXT OUTDIR')
        sys.exit(1)
    a = MWUFinder(*sys.argv[1:])
    a.process()
