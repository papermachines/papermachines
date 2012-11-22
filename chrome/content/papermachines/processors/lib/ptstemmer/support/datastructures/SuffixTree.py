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

class SuffixTreeNode(object):
    '''
    Object-oriented Suffix Tree node
    @author: Pedro Oliveira
    '''

    def __init__(self,value=None):
        self.__edges = {}
        self.value = value
    
    def addEdge(self, key, value):
        try:
            node = self.__edges[key]
        except:
            node = SuffixTreeNode(value)
            self.__edges[key] = node
        return node
    
    def __getitem__(self, key):
        return self.__edges[key]

class SuffixTree(object):
    '''
    Object-oriented Suffix Tree implementation
    @author: Pedro Oliveira
    '''
    
    def __init__(self,value=None, suffixes=[]):
        self.__root = SuffixTreeNode()
        self.properties = {}
        if value != None:
            [self.__setitem__(suffix, value) for suffix in suffixes]
    
    def __setitem__(self, suffix, value):
        node = self.__root
        for char in suffix[::-1]:
            node = node.addEdge(char,None)
        node.value = value
        
    def __contains__(self, word):   
        node = self.__root
        for char in word[::-1]:
            try:
                node = node[char]
            except:
                return False
        if node != None and node.value != None:
            return True
        return False

    def getLongestSuffixValue(self,word):
        '''
        Get value saved on the longest suffix of the word
        '''
        res = self.getLongestSuffixAndValue(word)
        return res[1] if res else None  #Python 2.5
    
    def getLongestSuffix(self,word):
        '''
        Get word's longest suffix present in the tree
        '''
        res = self.getLongestSuffixAndValue(word)
        return res[0] if res else ''  #Python 2.5
    
    def getLongestSuffixAndValue(self,word):
        '''
        Get word's longest suffix and value
        '''
        res = self.getLongestSuffixesAndValues(word)
        return res.pop() if len(res) > 0 else None  #Python 2.5
    
    def getLongestSuffixesAndValues(self,word):
        '''
        Get all the suffixes in the word and their values
        '''
        node = self.__root
        res = []
        for i,char in enumerate(word[::-1]):
            try:
                node = node[char]
                if node.value != None:
                    res.append((word[len(word)-i-1:],node.value))
            except:
                break
        return res
    
if __name__ == "__main__":
    tree = SuffixTree()
    tree['abc'] = 1
    tree['eabc'] = 2
    tree = SuffixTree(True,['abc','wabc'])
    print tree.getLongestSuffixesAndValues('adaeabc')
    print 'abc' in tree