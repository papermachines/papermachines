#!/usr/bin/env python
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

from ptstemmer.support.datastructures.LRUCache import LRUCache 

class Stemmer(object):
    '''
    Class that provides the main features to all the stemmers
    @author: Pedro Oliveira
    '''
    
    def __init__(self):
        self.__cacheStems = False
        self.__lruCache = None
        self.__toIgnore = set()
        
    def enableCaching(self,size):
        '''
        Create a LRU Cache, caching the last size stems
        '''
        self.__cacheStems = True
        self.__lruCache = LRUCache(size)
    
    def disableCaching(self):
        '''
        Disable and deletes the LRU Cache
        '''
        self.__cacheStems = False
        self.__lruCache = None
    
    def isCachingEnabled(self):
        '''
        Check if LRU Cache is enabled
        '''
        return self.__cacheStems
    
    def ignore(self,words):
        '''
        Add list of words to ignore list
        '''
        if type(words) is basestring:
            self.__toIgnore.add(words)
        else:
            self.__toIgnore.update(words)
        
    def clearIgnoreList(self):
        '''
        Clear the contents of the ignore list
        '''
        self.__toIgnore.clear()
        
    def getPhraseStems(self,phrase):
        '''
        Performs stemming on the phrase, using a simple space tokenizer
        '''
        return [self.getWordStem(word) for word in phrase.split(' ')]
         
    def getWordStem(self,word):
        '''
        Performs stemming on the word
        '''
        word = word.strip().lower()
        if self.__cacheStems and word in self.__lruCache:
            return self.__lruCache[word]
        if word in self.__toIgnore:
            return word
        
        res = self._stem(word)
        if self.__cacheStems:
            self.__lruCache[word] = res
        return res
    
    def _stem(self,word):
        '''
        Stems a word without any preprocessing(lowercasing, cache, ignoreList, etc)
        '''
        pass
    
if __name__ == '__main__':
    s = Stemmer()
    s.enableCaching(10)
    s.ignore(['as','ads'])
    print s.getWordStem('ab')
