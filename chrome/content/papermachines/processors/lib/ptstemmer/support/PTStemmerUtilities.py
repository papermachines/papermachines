#!/usr/bin/env python
# -*- coding: LATIN-1 -*-
'''
 * PTStemmer - A Stemming toolkit for the Portuguese language (C) 2008-2010 Pedro Oliveira
 * 
 * This file is part of PTStemmer.
 * PTStemmer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * PTStemmer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with PTStemmer. If not, see <http://www.gnu.org/licenses/>.
'''

import unicodedata

def fileToSet(filename):
    '''
    Parse text file (one word per line) to set 
    '''
    f = open(filename,'r')
    s = set()
    for line in f:
        s.add(line.strip())
    f.close()
    return s

def removeDiacritics(word):
    '''
    Remove diacritics (i.e., accents) from string
    '''
    nfd = unicodedata.normalize('NFD', unicode(word))
    return ''.join([c for c in nfd if not unicodedata.combining(c)])

if __name__ == '__main__':
    print removeDiacritics('ãáàâ')