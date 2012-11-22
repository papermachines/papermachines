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

class LRUCache(object):
    '''
    Simple Least Recently Used (LRU) Cache implementation
    @author: Pedro Oliveira
    '''

    def __init__(self,size):
        self.size = size
        self.__cache = {}
        self.__lru = []
        
    def __len__(self):
        return len(self.__lru)
    
    def __contains__(self, key):
        return self.__cache.has_key(key)
    
    def __setitem__(self, key, obj):
        if self.__cache.has_key(key):
            self.__lru.remove(key)
        else:
            if len(self.__lru) == self.size:
                self.__cache.pop(self.__lru.pop())
        self.__cache[key] = obj
        self.__lru.insert(0, key)
    
    def __getitem__(self, key):
        if self.__cache.has_key(key):
            n = self.__cache[key]
            self.__lru.remove(key)
            self.__lru.insert(0, key)
            return n
        return None

if __name__ == "__main__":
    cache = LRUCache(10)
    for i in range(11):
        cache[i] = str(i)   
    print cache[0], cache[1]
        