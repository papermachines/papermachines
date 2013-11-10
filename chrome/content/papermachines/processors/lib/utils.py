#!/usr/bin/python
# -*- coding: utf-8 -*-

import csv
import operator
import collections
import functools
from itertools import izip


def group_by_n(seq, n=2):
    ''' Return seq in chunks of length n (omitting any leftover elements) '''
    return izip(*(iter(seq), ) * n)


def argmax(obj):
    if hasattr(obj, 'index'):
        return obj.index(max(obj))
    elif hasattr(obj, 'iteritems'):
        return max(obj.iteritems(), key=operator.itemgetter(1))[0]


def argsort(seq, reverse=False):
    '''Sort indexes/keys from least to greatest'''

    if hasattr(seq, 'index'):
        return sorted(range(len(seq)), key=seq.__getitem__,
                      reverse=reverse)
    elif hasattr(seq, 'iteritems'):
        return sorted(seq.keys(), key=seq.__getitem__, reverse=reverse)


def unicode_csv_reader(utf8_data, dialect=csv.excel, **kwargs):
    csv_reader = csv.reader(utf8_data, dialect=dialect, **kwargs)
    for row in csv_reader:
        yield [unicode(cell, 'utf-8') for cell in row]


def parse_csv(filename, dialect=csv.excel, **kwargs):
    ''' Yield a dict for each row of a UTF-8 CSV file '''

    with file(filename, 'rU') as f:
        csv_rows = unicode_csv_reader(f, dialect=dialect, **kwargs)
        header = csv_rows.next()
        for row in csv_rows:
            if len(row) > 0:
                rowdict = dict(zip(header, row))
                yield rowdict

class memoize(object):

    '''Decorator. Caches a function's return value each time it is called.
   If called later with the same arguments, the cached value is returned
   (not reevaluated).
   '''

    def __init__(self, func):
        self.func = func
        self.cache = {}

    def __call__(self, *args):
        if not isinstance(args, collections.Hashable):

         # uncacheable. a list, for instance.
         # better to not cache than blow up.

            return self.func(*args)
        if args in self.cache:
            return self.cache[args]
        else:
            value = self.func(*args)
            self.cache[args] = value
            return value

    def __repr__(self):
        '''Return the function's docstring.'''

        return self.func.__doc__

    def __get__(self, obj, objtype):
        '''Support instance methods.'''

        return functools.partial(self.__call__, obj)
