import operator
from itertools import izip

def xpartition(seq, n=2):
    return izip(*(iter(seq), ) * n)

def argmax(obj):
    if hasattr(obj, 'index'):
        return obj.index(max(obj))
    elif hasattr(obj, 'iteritems'):
        return max(obj.iteritems(), key=operator.itemgetter(1))[0]

def argsort(seq, reverse=False):
    '''sorted indexes/keys from least to greatest'''

    if hasattr(seq, 'index'):
        return sorted(range(len(seq)), key=seq.__getitem__,
                      reverse=reverse)
    elif hasattr(seq, 'iteritems'):
        return sorted(seq.keys(), key=seq.__getitem__, reverse=reverse)
